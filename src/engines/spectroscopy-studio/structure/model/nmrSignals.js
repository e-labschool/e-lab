// Plot-ready ¹H NMR signals of a compound record: Lorentzian lines from the first-order splitting (the nmr workspace's splitOffsets / line shapes are
// reused read-only), overlap regions and the displayed integration. PURE.
import { splitOffsets } from "../../nmr/molecular/model/spectrum.js";

export const TMS_NOTE = "TMS (tetramethylsilane) is the 0 ppm reference.";
export const LINEWIDTH_HZ = 1.2;

/** Spins of one signal: one entry per neighbouring hydrogen, with its coupling constant. */
export const spinsOf = (sig) => sig.couplings.flatMap((c) => Array.from({ length: c.nH }, () => ({ J: c.J })));

/** One plot-ready signal. `d2o` removes the exchangeable (O–H) signals, as a D2O shake does. */
export function buildSignals(compound, { freqMHz = compound.nmr.freqMHz, d2o = false } = {}) {
  const list = compound.nmr.signals.filter((s) => !(d2o && s.exchangeable));
  return list.map((s) => {
    const spins = s.exchangeable ? [] : spinsOf(s);
    const centerHz = s.shift * freqMHz;
    const lines = splitOffsets(spins, spins.length, 1).map((l) => ({ hz: centerHz + l.offsetHz, ppm: (centerHz + l.offsetHz) / freqMHz, rel: l.rel, area: l.rel * s.n }));
    const lo = lines[0].hz; const hi = lines[lines.length - 1].hz;
    const widthHz = s.linewidthHz ?? LINEWIDTH_HZ;
    return {
      id: s.id, sig: s, shift: s.shift, n: s.n, exchangeable: s.exchangeable, centerHz, widthHz, lines, area: s.n,
      extentHz: [lo, hi], extentPpm: [lo / freqMHz, hi / freqMHz], skirtPpm: (widthHz * 4) / freqMHz, nLines: lines.length,
    };
  }).sort((a, b) => b.shift - a.shift);
}

/** Groups of signals whose lines (with their skirts) overlap. Region: { id, ids, n, lo, hi, centre, overlapped }, in order of decreasing shift. */
export function regionsOf(signals) {
  const sorted = [...signals].sort((a, b) => b.extentPpm[1] + b.skirtPpm - (a.extentPpm[1] + a.skirtPpm));
  const regions = [];
  for (const s of sorted) {
    const hi = s.extentPpm[1] + s.skirtPpm; const lo = s.extentPpm[0] - s.skirtPpm;
    const last = regions[regions.length - 1];
    if (last && hi >= last.lo) { last.ids.push(s.id); last.n += s.n; last.lo = Math.min(last.lo, lo); }
    else regions.push({ ids: [s.id], n: s.n, lo, hi });
  }
  return regions.map((r, i) => ({ ...r, id: `r${i + 1}`, centre: (r.lo + r.hi) / 2, overlapped: r.ids.length > 1 }));
}

/** Displayed integration of a region: "count" mode shows hydrogens (Foundation); "relative" shows the integral with the smallest region = 1.00. */
export function integrationValues(regions, mode) {
  const min = Math.min(...regions.map((r) => r.n));
  return Object.fromEntries(regions.map((r) => [r.id, mode === "count" ? { value: r.n, text: `${r.n} H` } : { value: r.n / min, text: (r.n / min).toFixed(2) }]));
}

/** Default view (ppm, left > right): from just below TMS to a little above the highest signal. */
export function defaultView(signals) {
  const hi = Math.max(...signals.map((s) => s.extentPpm[1] + s.skirtPpm));
  return { left: Math.min(14, Math.max(4, Math.ceil((hi + 0.8) * 2) / 2)), right: -0.5 };
}
