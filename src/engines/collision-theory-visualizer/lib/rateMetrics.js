// Pure helpers for the concentration-against-time graph (and the live rate readout).
//
// The simulation records the simulated time of EVERY successful collision (engine.successTimes()) and, at regular
// intervals, the number of A and B particles (engine.history()). Everything below is computed from those real data;
// nothing is a fitted or hard-coded curve. The vessel volume is fixed, so concentration is proportional to particle count.
//   * productCurve / countCurves: smooth monotone (PCHIP) curves of C, D, A and B particles against time.

export const RATE_WINDOW = 10; // seconds averaged for the live "Rate (last 10 s)" stat chip (independent of the graph)

/** Cumulative reactions N(t) at time t, counted from the event times (ascending). */
export function countUpTo(times, t) { let lo = 0; let hi = times.length; while (lo < hi) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m + 1; else hi = m; } return lo; }

/** Monotone cubic (PCHIP, Fritsch-Carlson) interpolation: passes through every point and never overshoots, so data that never
 *  decreases gives a curve that never decreases. Returns a function of x. */
export function pchip(xs, ys) {
  const n = xs.length; const h = new Float64Array(n - 1); const d = new Float64Array(n - 1); const m = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = h[i] > 0 ? (ys[i + 1] - ys[i]) / h[i] : 0; }
  if (n === 1) return () => ys[0];
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1]; const w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  // end slopes: three-point formula, kept shape preserving
  const endSlope = (h0, h1, d0, d1) => { let s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1); if (Math.sign(s) !== Math.sign(d0)) s = 0; else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(s) > 3 * Math.abs(d0)) s = 3 * d0; return s; };
  if (n > 2) { m[0] = endSlope(h[0], h[1], d[0], d[1]); m[n - 1] = endSlope(h[n - 2], h[n - 3], d[n - 2], d[n - 3]); }
  return (x) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0; let hi = n - 1; while (hi - lo > 1) { const k = (lo + hi) >> 1; if (xs[k] <= x) lo = k; else hi = k; }
    const t = (x - xs[lo]) / h[lo]; const t2 = t * t; const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h[lo] * m[lo] + (-2 * t3 + 3 * t2) * ys[lo + 1] + (t3 - t2) * h[lo] * m[lo + 1];
  };
}

/** Evenly spaced sample times 0 .. tNow (samples + 1 values). */
export function sampleTimes(tNow, samples = 36) { const t = new Float64Array(samples + 1); for (let k = 0; k <= samples; k++) t[k] = (tNow * k) / samples; return t; }

/**
 * Products graph: cumulative reactions (= C formed = D formed) against time, counted from the real events at evenly spaced
 * sample times and joined by a smooth monotone curve (PCHIP). It never decreases and never overshoots; it levels off by itself
 * when the events stop.
 * @returns {{ts: Float64Array, vs: Float64Array, t: Float64Array, v: Float64Array}} samples (ts, vs) and the smooth curve (t, v)
 */
export function productCurve(times, tNow, samples = 36, points = 161) {
  const ts = sampleTimes(Math.max(tNow, 1e-9), samples); const vs = new Float64Array(ts.length);
  for (let k = 0; k < ts.length; k++) vs[k] = countUpTo(times, ts[k] + 1e-9);
  const f = pchip(ts, vs); const t = new Float64Array(points); const v = new Float64Array(points);
  for (let g = 0; g < points; g++) { t[g] = (Math.max(tNow, 1e-9) * g) / (points - 1); v[g] = f(t[g]); }
  return { ts, vs, t, v };
}

/**
 * Species-count graphs from the engine's own recorded amounts (history every 0.5 s: A, B and cumulative reactions), read at evenly
 * spaced sample times with the live counts as the last sample, and joined by smooth shape-preserving curves (PCHIP).
 * C and D are each equal to the cumulative number of reactions (one C and one D per reaction).
 * @param {{t: ArrayLike<number>, a: ArrayLike<number>, b: ArrayLike<number>, succ: ArrayLike<number>}} hist  engine.history()
 * @param {number} tNow @param {{a: number, b: number, c: number}} live  live counts (c = reactions so far)
 * @returns {{ts, a, b, c, t, ca, cb, cc}} sample times, sampled amounts, and the smooth curves (t, ca, cb, cc)
 */
export function countCurves(hist, tNow, live, samples = 36, points = 161) {
  const T = Math.max(tNow, 1e-9); const ts = sampleTimes(T, samples); const n = ts.length;
  const a = new Float64Array(n); const b = new Float64Array(n); const c = new Float64Array(n);
  let k = 0; const L = hist.t.length;
  for (let q = 0; q < n; q++) {
    if (q === n - 1) { a[q] = live.a; b[q] = live.b; c[q] = live.c; break; }
    while (k + 1 < L && hist.t[k + 1] <= ts[q] + 1e-9) k++;
    a[q] = hist.a[k]; b[q] = hist.b[k]; c[q] = hist.succ[k];
  }
  const fa = pchip(ts, a); const fb = pchip(ts, b); const fc = pchip(ts, c);
  const t = new Float64Array(points); const ca = new Float64Array(points); const cb = new Float64Array(points); const cc = new Float64Array(points);
  for (let g = 0; g < points; g++) { t[g] = (T * g) / (points - 1); ca[g] = fa(t[g]); cb[g] = fb(t[g]); cc[g] = fc(t[g]); }
  return { ts, a, b, c, t, ca, cb, cc };
}

/** Poisson standard error of a count rate. */
export function rateUncertainty(count, span) { return span > 0 ? Math.sqrt(Math.max(count, 0)) / span : 0; }

export function formatRate(r) { return r >= 10 ? r.toFixed(1) : r.toFixed(2); }

/** A "nice" axis maximum >= v. */
export function niceMax(v, min = 1) {
  const m = Math.max(v, min); const e = Math.pow(10, Math.floor(Math.log10(m))); const f = m / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}

/** The smallest value from the list (times a power of ten) that is >= v. */
export const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
export function niceStep(v, steps = NICE_STEPS) {
  if (!(v > 0)) return steps[0];
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of steps) if (m * e >= v * (1 - 1e-12)) return Number((m * e).toPrecision(8));
  return 10 * e;
}

/** Round tick values from 0 to max: about `target` ticks at 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(max, target = 5) {
  const raw = max / Math.max(1, target); const e = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * e).find((s) => s >= raw * (1 - 1e-9)) ?? 10 * e;
  const out = []; for (let v = 0; v <= max + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
  return { ticks: out, step };
}
