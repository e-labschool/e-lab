// The shared, deterministic experiment: which molecules are in the sample, which ionise, which survive or fragment and how, and the illustrative detector events
// that build the spectrum. PURE (no React). Same molecule + same seed + same population size  =>  exactly the same experiment, so a teacher can replay it.
//
// HOW THE SMALL POPULATION IS BUILT (a TEACHING REPRESENTATION, not an experiment):
//   * n molecules (8 to 15) are shown. About 75 % of them are ionised (in a real source only a tiny fraction of the molecules is ionised; the rest are pumped away).
//   * The ionised molecules are shared out among the possible outcomes (the molecular ion survives, or it gives one of the fragment ions) in proportion to the
//     intensities of the PRIMARY peaks of the representative spectrum (data/spectra.js), using largest-remainder rounding. The seed only shuffles WHICH molecule
//     gets which outcome and where each one sits. With so few molecules the proportions are rough: this does NOT reproduce experimental relative abundances.
//   * The spectrum itself is built from an illustrative detector count per peak (DET_SCALE ions per 1 % of the tallest peak): the bars equal the representative spectrum.
import { SPECTRA } from "../data/spectra.js";
import { chainTo, getSim, ionCatalogue } from "../data/molecules.js";
import { sectorMzRange, sectorFocusMz, tofTime } from "./analyser.js";
import { SECTOR } from "../physics/sector.js";
import { TOF } from "../physics/tof.js";

export const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const POP_MIN = 8; export const POP_MAX = 15; export const POP_DEFAULT = 10;
export const ION_FRACTION = 0.75;
export const DET_SCALE = 10; // illustrative ions detected per 1 % of the tallest peak
export const POPULATION_NOTE = "Teaching representation: the handful of molecules animated here does not reproduce experimental relative abundances. A real spectrum comes from an enormous number of molecules and ions; the outcomes are shared out in proportion to the representative spectrum, so a few of each kind are shown.";
export const COUNT_NOTE = "Illustrative ion counts: the numbers are generated from the representative spectrum for teaching (10 ions per 1 % of the base peak). They are not measured counts.";

/** largest-remainder apportionment of `total` among keys with the given weights: returns {key: integer}. Deterministic; ties by key order. */
export function allocate(weights, total) {
  const keys = Object.keys(weights); const sum = keys.reduce((s, k) => s + weights[k], 0);
  const raw = keys.map((k) => ({ k, q: (weights[k] / sum) * total })); const out = Object.fromEntries(raw.map((r) => [r.k, Math.floor(r.q)]));
  let left = total - Object.values(out).reduce((s, v) => s + v, 0);
  for (const r of [...raw].sort((a, b) => b.q - Math.floor(b.q) - (a.q - Math.floor(a.q)) || keys.indexOf(a.k) - keys.indexOf(b.k))) { if (left <= 0) break; out[r.k] += 1; left -= 1; }
  return out;
}
export const clampN = (n) => Math.max(POP_MIN, Math.min(POP_MAX, Math.round(Number.isFinite(n) ? n : POP_DEFAULT)));
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** outcomes of the ionised molecules: { M: n_survive, <mz>: n } from the primary peaks of the spectrum, with the rules of a good demonstration (see below). */
export function outcomeCounts(molId, nIon) {
  const spec = SPECTRA[molId]; const prim = spec.peaks.filter((p) => !p.derived);
  const w = Object.fromEntries(prim.map((p) => [p.role === "M" ? "M" : String(p.mz), p.rel]));
  const out = allocate(w, nIon);
  const move = (to) => { const from = Object.keys(out).filter((k) => out[k] > 1 && k !== to).sort((a, b) => out[b] - out[a])[0]; if (from) { out[from] -= 1; out[to] += 1; } };
  const M = spec.byMz[spec.mMz];
  if (M.rel >= 15 && out.M === 0) move("M"); // a molecular ion that is clearly present survives in at least one molecule
  const frags = prim.filter((p) => p.role !== "M").sort((a, b) => b.rel - a.rel);
  for (const f of frags.slice(0, 2)) if (f.rel >= 20 && nIon >= 4 && out[String(f.mz)] === 0) move(String(f.mz)); // the two main fragments are both shown
  return out;
}
const gridSlots = (n, zone, rnd, jitter) => {
  const w = zone.x1 - zone.x0; const h = zone.y1 - zone.y0;
  let best = { cols: n, rows: 1, score: Infinity };
  for (let rows = 1; rows <= 5; rows += 1) { const cols = Math.ceil(n / rows); const cw = w / cols; const ch = h / rows; const score = Math.abs(Math.log(cw / ch)); if (score < best.score) best = { cols, rows, score }; }
  const { cols, rows } = best; const cw = w / cols; const ch = h / rows; const out = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) { if (out.length >= n) break; out.push({ x: zone.x0 + cw * (c + 0.5) + (rnd() - 0.5) * jitter * cw, y: zone.y0 + ch * (r + 0.5) + (rnd() - 0.5) * jitter * ch, cw, ch }); }
  return out;
};
export { gridSlots };

const cache = new Map();
/** The experiment. Slots are given as unit-square fractions so they can be placed in any zone (the world depends on the container). */
export function buildExperiment({ molId = "propanone", seed = 1, n = POP_DEFAULT } = {}) {
  const key = `${molId}|${seed}|${n}`; if (cache.has(key)) return cache.get(key);
  const sim = getSim(molId); const spec = sim.spec; const cat = ionCatalogue(sim.id);
  const N = clampN(n); const rnd = mulberry32(seed * 104729 + sim.id.length * 977 + N);
  const nIon = Math.max(1, Math.min(N - 2, Math.round(ION_FRACTION * N)));
  const counts = outcomeCounts(sim.id, nIon);
  const list = [];
  for (let i = 0; i < N - nIon; i += 1) list.push({ type: "neutral", mz: null, chain: [] });
  for (const [k, c] of Object.entries(counts)) for (let i = 0; i < c; i += 1) list.push(k === "M" ? { type: "survive", mz: spec.mMz, chain: [] } : { type: "fragment", mz: Number(k), chain: chainTo(sim.id, Number(k)) });
  const outcomes = shuffle(list, rnd);
  const molecules = outcomes.map((o, i) => ({
    i, label: `#${i + 1}`, ionised: o.type !== "neutral", outcome: o,
    ionMz: o.mz, ion: o.mz ? cat[o.mz] : null,
    ux: rnd(), uy: rnd(), jx: rnd(), jy: rnd(), r1: rnd(), r2: rnd(), r3: rnd(), r4: rnd(),
    spin0: rnd() * Math.PI * 2, spinRate: (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.45), tilt: 0.25 + rnd() * 0.3,
  }));
  // slot indices: homes in the pre-beam zone, slots in the fragmentation zone, reservoir places; the order in which molecules reach the beam
  const perm = (k) => shuffle(Array.from({ length: N }, (_, i) => i), rnd).slice(0, k);
  const homeOrder = perm(N); const fragOrder = perm(N); const resOrder = perm(N);
  molecules.forEach((m, i) => { m.homeSlot = homeOrder[i]; m.fragSlot = fragOrder[i]; m.resSlot = resOrder[i]; });
  const fragmenting = molecules.filter((m) => m.outcome.type === "fragment");
  shuffle(fragmenting.map((m) => m.i), rnd).forEach((id, k) => { molecules[id].fragRank = k; });
  const survivors = molecules.filter((m) => m.outcome.type === "survive"); survivors.forEach((m, k) => { m.fragRank = k; });
  const ionised = molecules.filter((m) => m.ionised);
  const outcomeTally = { neutral: N - nIon, survive: counts.M ?? 0, fragments: Object.fromEntries(Object.entries(counts).filter(([k]) => k !== "M").map(([k, v]) => [Number(k), v])) };
  const detector = spec.peaks.map((p) => ({ mz: p.mz, rel: p.rel, count: Math.max(1, Math.round(p.rel * DET_SCALE)), ion: cat[p.mz] }));
  const exp = { molId: sim.id, seed, n: N, nIon, nNeutral: N - nIon, sim, spec, cat, molecules, ionised, outcomeTally, detector, detectorMax: Math.max(...detector.map((d) => d.count)) };
  if (cache.size > 60) cache.clear();
  cache.set(key, exp); return exp;
}

/** every molecule index whose final detected ion has this m/z (including the molecular ion) */
export const moleculesWithIon = (exp, mz) => exp.molecules.filter((m) => m.ionMz === mz).map((m) => m.i);
/** the pathway chain (objects) of a molecule, [] if it survives or stays neutral */
export const chainOf = (exp, i) => exp.molecules[i].outcome.chain.map((id) => exp.sim.pathById[id]);

// ---- detection --------------------------------------------------------------------------------------------------------------------------------------
export const SWEEPS = 3; export const PULSES = 6;
export const TOF_DISPLAY_SEC_PER_US = 1 / 6.4387; // display seconds per real microsecond: m/z 16 at 2000 V, L = 1 m (6.4387 us) lasts 1 s on screen
/** Which peaks the analyser can transmit at all at this V (the sector's field range limits the m/z window). */
export function detectable(exp, analyser, V) {
  if (analyser === "tof") return exp.detector.map((d) => ({ ...d, ok: true }));
  const { lo, hi } = sectorMzRange(V);
  return exp.detector.map((d) => ({ ...d, ok: d.mz >= lo - 0.5 && d.mz <= hi + 0.5 }));
}
const split = (c, k, parts) => Math.floor(c / parts) + (k < c % parts ? 1 : 0);

/** timing of the detection stage for the analyser */
export function detectionPlan(exp, analyser, V) {
  const det = detectable(exp, analyser, V); const ok = det.filter((d) => d.ok);
  if (analyser === "tof") {
    const times = ok.map((d) => tofTime(d.mz, V) * 1e6 * TOF_DISPLAY_SEC_PER_US);
    const flightMax = Math.max(...times, 1); const period = flightMax + 0.8;
    return { analyser, pulses: PULSES, period, flightMax, total: PULSES * period + 0.4, ok, det };
  }
  const mzs = ok.map((d) => d.mz); const lo = Math.floor(Math.min(...mzs, 14) - 1); const hi = Math.ceil(Math.max(...mzs, 15) + 1);
  const range = hi - lo; const Ts = Math.max(3.5, Math.min(7, 0.14 * range));
  return { analyser, sweeps: SWEEPS, lo, hi, range, Ts, total: SWEEPS * Ts + 0.4, ok, det };
}
/** m/z focused by the scanning magnet at time t (sector), or null outside a sweep */
export function scanFocus(plan, t) {
  const s = Math.min(plan.sweeps - 1, Math.max(0, Math.floor(t / plan.Ts))); const f = (t - s * plan.Ts) / plan.Ts;
  if (t >= plan.sweeps * plan.Ts) return { sweep: plan.sweeps - 1, mz: plan.hi, done: true };
  return { sweep: s, mz: plan.lo + plan.range * Math.max(0, Math.min(1, f)), done: false };
}
/** Counts and bar heights after detection time t. Sector: ions of m/z m reach the detector while the sweep passes m +- 0.5. TOF: pulse k arrives at k*period + flight time. */
export function detectionAt(exp, plan, V, t) {
  const counts = {}; let total = 0; const finalMax = Math.max(1, ...plan.ok.map((d) => d.count));
  for (const d of plan.det) counts[d.mz] = 0;
  for (const d of plan.ok) {
    let c = 0;
    if (plan.analyser === "tof") { const tf = tofTime(d.mz, V) * 1e6 * TOF_DISPLAY_SEC_PER_US; for (let k = 0; k < plan.pulses; k += 1) if (t >= k * plan.period + 0.3 + tf) c += split(d.count, k, plan.pulses); }
    else { const w = plan.Ts / plan.range; const a = ((d.mz - 0.5 - plan.lo) / plan.range) * plan.Ts; for (let s = 0; s < plan.sweeps; s += 1) c += split(d.count, s, plan.sweeps) * Math.max(0, Math.min(1, (t - s * plan.Ts - a) / w)); }
    counts[d.mz] = c; total += c;
  }
  const heights = Object.fromEntries(plan.det.map((d) => [d.mz, (100 * (counts[d.mz] ?? 0)) / finalMax]));
  return { counts, heights, total, finalMax };
}
/** final bar heights (percent) of the spectrum recorded at this V by this analyser: equal to the representative spectrum for the peaks the analyser can transmit */
export function finalHeights(exp, analyser, V) {
  const plan = detectionPlan(exp, analyser, V); return detectionAt(exp, plan, V, plan.total + 1).heights;
}
export const totalIllustrativeIons = (exp) => exp.detector.reduce((s, d) => s + d.count, 0);
export { sectorFocusMz, SECTOR, TOF };
