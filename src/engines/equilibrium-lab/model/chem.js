// Chemical-model run state and its operations (pure functions: (state, ...) -> new state).
// State:  { rid, c: {id: mol dm-3}, V (dm3), T (K), cat (bool), kfRef, krRef, ledger: {id: mol added (+) / removed (-)}, atoms0: {el: mol} }
// Amounts n_i = c_i * V.  A volume change keeps every n_i and rescales every c_i by V_old / V_new (ideal gas); a concentration
// disturbance changes n_i by a stated number of moles.  Element totals therefore obey  atoms(now) = atoms0 + sum(ledger_i * atoms_i).
import { EQ_TOL_ATTAINED, EQ_TOL_NEAR, Q_EQ_TOL } from "./constants.js";
import { REACTIONS, gasCoefficients } from "./reactions.js";
import { rateConstants } from "./thermo.js";
import { forwardRate, reverseRate, reactionQuotient, integrate } from "./kinetics.js";

export function createChem(rid, overrides = {}) {
  const rx = REACTIONS[rid]; if (!rx) throw new Error(`unknown reaction ${rid}`);
  const run = rx.run; const V = overrides.V ?? run.V; const c = {};
  for (const s of rx.species) c[s.id] = (overrides.amounts?.[s.id] ?? run.amounts[s.id]) / V;
  const ch = {
    rid, c, V, V0: V, T: overrides.T ?? run.T, cat: false,
    kfRef: overrides.kfRef ?? rx.kinetics.kfRef, krRef: overrides.krRef ?? rx.kinetics.krRef ?? null,
    ledger: Object.fromEntries(rx.species.map((s) => [s.id, 0])), atoms0: null, h: null,
  };
  ch.atoms0 = atomTotals(ch);
  return ch;
}

export const amountsOf = (ch) => Object.fromEntries(Object.entries(ch.c).map(([id, v]) => [id, v * ch.V]));

/** Element totals (mol) present right now. */
export function atomTotals(ch) {
  const rx = REACTIONS[ch.rid]; const out = {};
  for (const s of rx.species) for (const [el, k] of Object.entries(s.atoms)) out[el] = (out[el] ?? 0) + k * ch.c[s.id] * ch.V;
  return out;
}
/** Element totals that SHOULD be present: initial + everything the student added - everything removed. */
export function expectedAtoms(ch) {
  const rx = REACTIONS[ch.rid]; const out = { ...ch.atoms0 };
  for (const s of rx.species) for (const [el, k] of Object.entries(s.atoms)) out[el] = (out[el] ?? 0) + k * ch.ledger[s.id];
  return out;
}
export function atomConservationError(ch) {
  const a = atomTotals(ch); const e = expectedAtoms(ch); let worst = 0;
  for (const el of new Set([...Object.keys(a), ...Object.keys(e)])) worst = Math.max(worst, Math.abs((a[el] ?? 0) - (e[el] ?? 0)) / Math.max(1e-12, Math.abs(e[el] ?? 0) + 1e-12));
  return worst;
}

const params = (ch) => ({ kfRef: ch.kfRef, krRef: ch.krRef });

/** Instantaneous kinetic / thermodynamic snapshot. */
export function chemSnapshot(ch) {
  const rx = REACTIONS[ch.rid]; const { kf, kr, Kc } = rateConstants(rx, ch.T, ch.cat, params(ch));
  const rf = forwardRate(rx, ch.c, kf); const rr = reverseRate(rx, ch.c, kr); const Q = reactionQuotient(rx, ch.c);
  return { kf, kr, Kc, rf, rr, Q, ...equilibriumStatus(rf, rr), direction: netDirection(Q, Kc, rf, rr) };
}

/** Relative rate mismatch -> status.  Numerical tolerances only (never exact floating-point equality). */
export function equilibriumStatus(rf, rr) {
  const top = Math.max(rf, rr);
  if (!(top > 1e-15)) return { mismatch: 0, status: "empty" };
  const mismatch = Math.abs(rf - rr) / top;
  return { mismatch, status: mismatch < EQ_TOL_ATTAINED ? "attained" : mismatch < EQ_TOL_NEAR ? "near" : "approaching" };
}

export function netDirection(Q, K, rf, rr) {
  if (Number.isNaN(Q)) return "none";
  const lq = Q === 0 ? -Infinity : Q === Infinity ? Infinity : Math.log(Q / K);
  if (Math.abs(lq) < Q_EQ_TOL) return "equilibrium";
  return lq < 0 ? "forward" : "reverse";
}

/** Advance by dt (simulation seconds) with the controlled-error RK45 integrator. */
export function advanceChem(ch, dt) {
  if (!(dt > 0)) return ch;
  const rx = REACTIONS[ch.rid]; const { kf, kr } = rateConstants(rx, ch.T, ch.cat, params(ch));
  const r = integrate(rx, ch.c, kf, kr, dt);
  return { ...ch, c: r.c };
}

// ---- disturbances ----
export function addAmount(ch, id, dn) {
  const rx = REACTIONS[ch.rid]; if (!rx.species.some((s) => s.id === id) || !(dn > 0)) return ch;
  return { ...ch, c: { ...ch.c, [id]: ch.c[id] + dn / ch.V }, ledger: { ...ch.ledger, [id]: ch.ledger[id] + dn } };
}
/** Removes up to dn mol; returns the unchanged state if nothing is there. */
export function removeAmount(ch, id, dn) {
  const have = ch.c[id] * ch.V; const take = Math.min(dn, have); if (!(take > 0)) return ch;
  const left = have - take;
  return { ...ch, c: { ...ch.c, [id]: left <= 1e-14 ? 0 : left / ch.V }, ledger: { ...ch.ledger, [id]: ch.ledger[id] - take } };
}
export function setTemperature(ch, T) { return { ...ch, T }; }
export function setCatalyst(ch, on) { return { ...ch, cat: !!on }; }
/** Ideal-gas volume change at constant n and T: every concentration scales by V_old / V_new. */
export function setVolume(ch, V) {
  if (!(V > 0) || V === ch.V) return ch;
  const f = ch.V / V; const c = {}; for (const id of Object.keys(ch.c)) c[id] = ch.c[id] * f;
  return { ...ch, V, c };
}

/** Solve the equilibrium composition reachable from the current state at the CURRENT (T, V, catalyst).  Bisection on the extent. */
export function solveEquilibrium(ch) {
  const rx = REACTIONS[ch.rid]; const { Kc } = rateConstants(rx, ch.T, ch.cat, params(ch));
  const ids = Object.keys(rx.nu); let lo = -Infinity; let hi = Infinity;
  for (const id of ids) { const n = rx.nu[id]; const lim = -ch.c[id] / n; if (n > 0) lo = Math.max(lo, lim); else hi = Math.min(hi, lim); }
  const at = (x) => { const c = {}; for (const id of ids) c[id] = Math.max(0, ch.c[id] + rx.nu[id] * x); return c; };
  // g(x) = ln(Q/K): decreasing in -x ... monotone increasing in x
  const g = (x) => { const c = at(x); const Q = reactionQuotient(rx, c); return Q === 0 ? -1e9 : !Number.isFinite(Q) ? 1e9 : Math.log(Q / Kc); };
  let a = lo; let b = hi; if (!Number.isFinite(a) || !Number.isFinite(b)) return { c: { ...ch.c }, xi: 0, Kc };
  for (let i = 0; i < 200; i += 1) { const m = 0.5 * (a + b); if (g(m) < 0) a = m; else b = m; }
  const xi = 0.5 * (a + b); return { c: at(xi), xi, Kc };
}

/** Volume / pressure reasoning helper: which side has fewer gas moles. */
export const volumeEffect = (rid) => { const rx = REACTIONS[rid]; return rx.gas ? gasCoefficients(rx) : null; };

/** Total gas pressure in bar (ideal gas): p = sum(n) R T / V  with c in mol dm-3. */
export function totalPressureBar(ch) {
  const rx = REACTIONS[ch.rid]; if (!rx.gas) return null;
  let sum = 0; for (const s of rx.species) sum += ch.c[s.id]; return sum * 0.08314462618 * ch.T;
}
