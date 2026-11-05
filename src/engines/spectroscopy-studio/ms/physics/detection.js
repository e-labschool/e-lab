// Stage 8: ion arrivals at the detector build up the mass spectrum. PURE.
// The ion population of the stage is the methane spectrum (data/spectra.js): the NUMBER of ions detected at each m/z is proportional to the peak's relative
// intensity (one ion per 1 % of the base peak, so 100 ions at m/z 16). The arrival ORDER is a reproducible shuffle: ions of all masses arrive at random in the
// detector, and peak height depends on how MANY arrive, not on how heavy they are. After the last ion the bars equal the representative spectrum exactly.
import { SPECTRA } from "../data/spectra.js";

const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

export function ionPopulation(specId = "methane") {
  return SPECTRA[specId].peaks.map((p) => ({ mz: p.mz, count: Math.max(1, Math.round(p.rel)), rel: p.rel, label: p.label }));
}
export function arrivalSequence(specId = "methane", seed = 11) {
  const pop = ionPopulation(specId); const seq = [];
  for (const p of pop) for (let i = 0; i < p.count; i += 1) seq.push(p.mz);
  const rnd = mulberry32(seed);
  for (let i = seq.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; }
  return seq;
}
/** counts after the first k arrivals: {mz: n} */
export function countsAfter(seq, k) { const c = {}; for (let i = 0; i < Math.min(k, seq.length); i += 1) c[seq[i]] = (c[seq[i]] ?? 0) + 1; return c; }
/** bar heights (% of the FINAL tallest peak) after k arrivals: the bars grow with the number of ions and never exceed their final value */
export function heightsAfter(seq, k, specId = "methane") {
  const pop = ionPopulation(specId); const maxCount = Math.max(...pop.map((p) => p.count)); const c = countsAfter(seq, k);
  return Object.fromEntries(pop.map((p) => [p.mz, (100 * (c[p.mz] ?? 0)) / maxCount]));
}
