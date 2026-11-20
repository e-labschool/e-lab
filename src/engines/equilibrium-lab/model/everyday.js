// Everyday analogy: two cities, two buses.  A reversible-transfer model of A <=> B with
//   propensities  a_f = k_f A   and   a_r = k_r B     (people per time unit)
// simulated two ways side by side from the SAME events/disturbances:
//   * stochastic passengers (exact Gillespie SSA; binomial tau-leaping only when a single tick would need > SSA_MAX_EVENTS events):
//     integer populations A, B -- never more people leave a city than are in it.  This is what the buses and the counters show.
//   * the deterministic mean field dA/dt = -kf A + kr B, solved EXACTLY:  A(t) = A_eq + (A_0 - A_eq) exp(-(kf+kr) t).
//     For a linear reversible system it is exactly the expected value of the stochastic process, so the graph and the
//     equilibrium indicator use it ("the underlying equilibrium condition"), while measured event counts are shown as a check.
// The state is pure data; the PRNG state is part of it so a seed reproduces a run exactly (tests, Replay).
import { SSA_MAX_EVENTS, TAU_LEAP_MAX_FRACTION } from "./constants.js";
import { binomial, nextOpen } from "./rng.js";
import { exactAB } from "./kinetics.js";
import { equilibriumStatus } from "./chem.js";

export const PRESETS = Object.freeze({
  towardsA: { id: "towardsA", label: "Towards A", kf: 0.25, kr: 1.0 },
  center: { id: "center", label: "Center", kf: 1.0, kr: 1.0 },
  towardsB: { id: "towardsB", label: "Towards B", kf: 1.0, kr: 0.25 },
});
export const PRESET_IDS = Object.freeze(["towardsA", "center", "towardsB"]);
export const DEFAULT_SEED = 20251;
export const BIN = 0.1;           // time units per measured-rate bin
export const BINS_KEPT = 120;     // 12 time units of history for measured rates
export const ADD_STEP = 20;       // people moved by one press of an add / remove button

export function createEveryday({ preset = "towardsA", kf, kr, A = 100, B = 0, seed = DEFAULT_SEED } = {}) {
  const p = PRESETS[preset] ?? PRESETS.towardsA;
  return {
    preset: PRESETS[preset] ? preset : null, kf: kf ?? p.kf, kr: kr ?? p.kr, A, B, N0: A + B, t: 0, seed0: seed, rng: seed >>> 0, tNext: null,
    nF: 0, nR: 0, bins: [], det: { t0: 0, A0: A, B0: B }, added: { A: 0, B: 0 },
  };
}

const addBin = (bins, t, dir, n) => {
  const k = Math.floor(t / BIN + 1e-9); const out = bins.length && bins[bins.length - 1].k === k ? bins.slice() : [...bins, { k, f: 0, r: 0 }];
  const last = { ...out[out.length - 1] }; last[dir] += n; out[out.length - 1] = last;
  return out.length > BINS_KEPT ? out.slice(out.length - BINS_KEPT) : out;
};

export function advanceEveryday(ev, dt) {
  if (!(dt > 0)) return ev;
  let { A, B, t, rng, tNext, nF, nR, bins } = ev; const { kf, kr } = ev; const tEnd = t + dt;
  if ((kf * A + kr * B) * dt > SSA_MAX_EVENTS) {
    // tau-leaping: simultaneous binomial draws -> neither city can go negative
    const tau = Math.max(1e-9, Math.min(dt, TAU_LEAP_MAX_FRACTION / (kf + kr)));
    while (t < tEnd - 1e-12) {
      const h = Math.min(tau, tEnd - t);
      const bf = binomial(A, 1 - Math.exp(-kf * h), rng); const br = binomial(B, 1 - Math.exp(-kr * h), bf.seed); rng = br.seed;
      A += br.value - bf.value; B += bf.value - br.value; nF += bf.value; nR += br.value; t += h;
      if (bf.value) bins = addBin(bins, t, "f", bf.value); if (br.value) bins = addBin(bins, t, "r", br.value);
    }
    return { ...ev, A, B, t: tEnd, rng, tNext: null, nF, nR, bins };
  }
  const draw = (from) => {
    const a0 = kf * A + kr * B; if (!(a0 > 0)) return null;
    const r = nextOpen(rng); rng = r.seed; return from - Math.log(r.value) / a0;
  };
  if (tNext == null) tNext = draw(t);
  while (tNext != null && tNext <= tEnd) {
    t = tNext; const af = kf * A; const a0 = af + kr * B;
    const r = nextOpen(rng); rng = r.seed;
    if (r.value * a0 < af) { A -= 1; B += 1; nF += 1; bins = addBin(bins, t, "f", 1); } else { A += 1; B -= 1; nR += 1; bins = addBin(bins, t, "r", 1); }
    tNext = draw(t);
  }
  return { ...ev, A, B, t: tEnd, rng, tNext, nF, nR, bins };
}

/** Exact mean-field populations right now. */
export function detNow(ev) { const r = exactAB(ev.det.A0, ev.det.B0, ev.kf, ev.kr, ev.t - ev.det.t0); return r; }

/** Add (n > 0) or remove (n < 0) people in one city; returns the new state and how many actually moved. */
export function changePeople(ev, city, n) {
  const key = city === "A" ? "A" : "B"; const d = detNow(ev);
  const have = ev[key]; const move = n >= 0 ? n : -Math.min(-n, have);
  if (move === 0) return { ev, moved: 0 };
  const dMove = n >= 0 ? n : -Math.min(-n, d[key]);
  const det = { t0: ev.t, A0: d.A + (key === "A" ? dMove : 0), B0: d.B + (key === "B" ? dMove : 0) };
  return { ev: { ...ev, [key]: have + move, tNext: null, det, added: { ...ev.added, [key]: ev.added[key] + move } }, moved: move };
}

export const populationOf = (ev) => ev.A + ev.B;

/**
 * CHANGED: the DEFAULT (smooth) display.  The expected populations from the exact mean-field solution, rounded to whole people with
 * B = N - A so the total is always N.  The mean field moves monotonically towards equilibrium, so these numbers change smoothly and
 * then stop changing (50/50, 80/20, 20/80 for the presets) -- the time-averaged state that stays constant at dynamic equilibrium.
 * The random passenger populations (ev.A, ev.B) are shown only when the student switches "Show random fluctuations" on.
 */
export function expectedPopulation(ev) {
  const N = ev.A + ev.B; const d = detNow(ev); const A = Math.min(N, Math.max(0, Math.round(d.A)));
  return { A, B: N - A };
}
/** Typical size (standard deviation, in people) of the random fluctuation about the average at equilibrium: sqrt(N p q). */
export const fluctuationSD = (ev) => { const N = ev.A + ev.B; const pA = ev.kr / (ev.kf + ev.kr); return Math.sqrt(N * pA * (1 - pA)); };

/** Everything the UI / graphs / tests read for one moment. */
export function everydaySnapshot(ev) {
  const d = detNow(ev); const N = ev.A + ev.B; const Nd = d.A + d.B;
  const rfDet = ev.kf * d.A; const rrDet = ev.kr * d.B;
  const W = Math.max(BIN, Math.min(ev.t, 2)); const kNow = Math.floor(ev.t / BIN + 1e-9); const kFrom = kNow - Math.round(W / BIN);
  let f = 0; let r = 0; for (const b of ev.bins) if (b.k > kFrom && b.k <= kNow) { f += b.f; r += b.r; }
  const Wm = ev.t > 0 ? Math.min(W, ev.t) : BIN; const status = equilibriumStatus(rfDet, rrDet);
  return {
    A: ev.A, B: ev.B, expA: expectedPopulation(ev).A, expB: expectedPopulation(ev).B, N, kf: ev.kf, kr: ev.kr, K: ev.kf / ev.kr, detA: d.A, detB: d.B,
    Aeq: (ev.kr * Nd) / (ev.kf + ev.kr), Beq: (ev.kf * Nd) / (ev.kf + ev.kr),
    rfDet, rrDet, rfInst: ev.kf * ev.A, rrInst: ev.kr * ev.B, rfMeas: f / Wm, rrMeas: r / Wm, window: Wm,
    ...status, position: positionLabel(ev.kf / ev.kr),
  };
}

export function positionLabel(K) { return K < 0.5 ? "Towards reactants" : K > 2 ? "Towards products" : "Balanced"; }
export const everydayPosition = (K) => (K < 0.5 ? "Towards A" : K > 2 ? "Towards B" : "Balanced");
