// Discrete molecule bookkeeping for the vessel picture.  The ENGINE (chem.js) is authoritative; this module only decides how many
// whole molecules of each species are drawn and which reaction events to show, so that
//   * every drawn event is stoichiometric (atom-conserving by construction: m_i = M_i + nu_i * xi),
//   * the drawn net extent follows the engine's extent to within one event, and
//   * at (near) equilibrium the picture keeps showing forward AND reverse events at a rate drawn from the engine's rates
//     (dynamic equilibrium), with the forward : reverse odds equal to r_f : r_r.
// One drawn molecule stands for `unit` mol (reaction.run.unit).  Concentrations and graphs always come from the engine, never from here.
import { REACTIONS } from "./reactions.js";
import { amountsOf } from "./chem.js";
import { nextOpen } from "./rng.js";

export const MAX_TRACK_EVENTS_PER_S = 14;   // visual rate limit for events that follow the engine's net change
export const MAX_CHURN_PER_S = 3;           // visual rate limit for equilibrium exchange events (forward/reverse flicker)

const refSpecies = (rx) => Object.keys(rx.nu).find((id) => rx.nu[id] !== 0);

export function createVisual(ch, seed = 7) {
  const rx = REACTIONS[ch.rid]; const unit = rx.run.unit; const n = amountsOf(ch); const M = {};
  for (const s of rx.species) M[s.id] = Math.round(n[s.id] / unit);
  return { rid: ch.rid, unit, M, xi: 0, anchorN: n, anchorLedger: { ...ch.ledger }, rng: seed >>> 0, credit: 0, seq: 0, recent: [] };
}

/** Current whole-molecule counts. */
export function visualCounts(v) { const rx = REACTIONS[v.rid]; const m = {}; for (const s of rx.species) m[s.id] = v.M[s.id] + rx.nu[s.id] * v.xi; return m; }

/** The engine's net extent since the anchor, in drawn-event units (float). */
export function targetExtent(v, ch) {
  const rx = REACTIONS[v.rid]; const ref = refSpecies(rx); const n = ch.c[ref] * ch.V;
  const ext = ch.ledger[ref] - v.anchorLedger[ref];
  return (n - v.anchorN[ref] - ext) / (rx.nu[ref] * v.unit);
}

/** After a concentration disturbance the engine ledger changed by dn mol of `id`: fold it into the integer counts and re-anchor. */
export function visualDisturbed(v, ch, id, dn) {
  const rx = REACTIONS[v.rid]; const m = visualCounts(v); const M = { ...m };
  const dp = Math.round(dn / v.unit); M[id] = Math.max(0, m[id] + dp);
  void rx;
  return { ...v, M, xi: 0, anchorN: amountsOf(ch), anchorLedger: { ...ch.ledger } };
}

const can = (v, dir) => { const rx = REACTIONS[v.rid]; const m = visualCounts(v); for (const id of Object.keys(rx.nu)) { const need = dir === "f" ? -rx.nu[id] : rx.nu[id]; if (need > 0 && m[id] < need) return false; } return true; };

/** One drawn reaction event: returns the new state (xi +/- 1). */
export function applyEvent(v, dir, kind = "track") {
  const seq = v.seq + 1; const recent = [...v.recent, { seq, dir, kind }];
  return { ...v, xi: v.xi + (dir === "f" ? 1 : -1), seq, recent: recent.length > 24 ? recent.slice(recent.length - 24) : recent };
}

/**
 * Advance the picture by dtReal real seconds.  `snap` is chemSnapshot(ch) (for r_f, r_r); `simPerReal` converts engine seconds to real
 * seconds for the churn rate.  Returns { v, events: [{dir}] } -- events must be animated in order.
 */
export function stepVisual(v, ch, snap, dtReal, simPerReal = 1) {
  const rx = REACTIONS[v.rid]; const events = []; let cur = { ...v };
  cur.credit = Math.min(MAX_TRACK_EVENTS_PER_S * 0.5, cur.credit + MAX_TRACK_EVENTS_PER_S * dtReal);
  // 1. follow the engine's net change
  for (let guard = 0; guard < 400 && cur.credit >= 1; guard += 1) {
    const dev = targetExtent(cur, ch) - cur.xi;
    const dir = dev >= 1 ? "f" : dev <= -1 ? "r" : null; if (!dir || !can(cur, dir)) break;
    cur = applyEvent(cur, dir, "track"); cur.credit -= 1; events.push({ dir, kind: "track" });
  }
  // 2. dynamic-equilibrium exchange: gross events at a rate drawn from the engine's gross rate, odds r_f : r_r
  const gross = Math.min(snap.rf, snap.rr) * ch.V / v.unit;                       // events per engine second, each direction
  const lam = Math.min(MAX_CHURN_PER_S, gross * simPerReal * 2) * dtReal;          // expected exchange events this tick
  let left = lam;
  for (let guard = 0; guard < 8 && left > 0; guard += 1) {
    const r = nextOpen(cur.rng); cur.rng = r.seed;
    if (r.value > Math.min(1, left)) break;
    const r2 = nextOpen(cur.rng); cur.rng = r2.seed;
    const dir = r2.value < snap.rf / (snap.rf + snap.rr) ? "f" : "r";
    if (can(cur, dir)) { cur = applyEvent(cur, dir, "exchange"); events.push({ dir, kind: "exchange" }); }
    left -= 1;
  }
  void rx;
  return { v: cur, events };
}

/** Element totals of the drawn molecules (for the atom-conservation test). */
export function visualAtoms(v) {
  const rx = REACTIONS[v.rid]; const m = visualCounts(v); const out = {};
  for (const s of rx.species) for (const [el, k] of Object.entries(s.atoms)) out[el] = (out[el] ?? 0) + k * m[s.id];
  return out;
}

/** Jump straight to the engine's composition (used for Step Forward / fast-forward / tests): no events are drawn. */
export function snapVisual(v, ch) {
  let cur = { ...v };
  for (let guard = 0; guard < 5000; guard += 1) {
    const dev = targetExtent(cur, ch) - cur.xi; const dir = dev >= 1 ? "f" : dev <= -1 ? "r" : null;
    if (!dir || !can(cur, dir)) break;
    cur = { ...cur, xi: cur.xi + (dir === "f" ? 1 : -1) };
  }
  return cur;
}
