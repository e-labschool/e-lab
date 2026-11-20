// Axis helpers shared by the graphs (pure, unit-tested).
export function niceNumber(x, round) {
  const exp = Math.floor(Math.log10(x)); const f = x / Math.pow(10, exp); let nf;
  if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10; else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}
/** Nice axis from 0 (or lo) to just above `max`, about `count` ticks. */
export function niceAxis(lo, max, count = 4) {
  if (!(max > lo)) max = lo + 1;
  const range = niceNumber(max - lo, false); const step = niceNumber(range / count, true);
  const top = Math.ceil(max / step - 1e-9) * step; const ticks = [];
  for (let v = Math.floor(lo / step) * step; v <= top + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);
  return { min: ticks[0], max: top, step, ticks };
}
export function tickLabel(v) {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1000 || a < 0.01) return v.toExponential(0).replace("e+", "e");
  return Number(v.toPrecision(3)).toString();
}
/** Index of the sample whose x is closest to xv (xs ascending). */
export function nearestIndex(xs, xv) {
  if (!xs.length) return -1;
  let lo = 0; let hi = xs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < xv) lo = m; else hi = m; }
  return Math.abs(xs[lo] - xv) <= Math.abs(xs[hi] - xv) ? lo : hi;
}
