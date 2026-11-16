// Pure helpers for the rate display. The engine stores cumulative counts at fixed 0.5 s steps (history()).
// rate = (successful collisions in the last W seconds) / W  = the gradient of the "products formed" graph over that window.

export const WINDOW_S = 60; // seconds of simulated time shown on the rate graph
export const RATE_WINDOW = 10; // seconds averaged for the smoothed rate

/** Moving-average rate series (per second) over a window W (s) from cumulative counts sampled at times t. */
export function smoothedRate(t, cum, W = 10) {
  const n = t.length; const out = new Float64Array(n); let k0 = 0;
  for (let k = 0; k < n; k++) {
    while (k0 < k && t[k] - t[k0] > W + 1e-9) k0++;
    const span = t[k] - t[k0];
    out[k] = span > 0 ? (cum[k] - cum[k0]) / span : 0;
  }
  return out;
}

/** Successes per bin of `bin` seconds (bin must be a multiple of the sample spacing). Returns { x: bin end times, v: counts/bin }. */
export function binnedCounts(t, cum, bin = 1) {
  const x = []; const v = [];
  if (t.length < 2) return { x, v };
  let edge = Math.ceil((t[0] + 1e-9) / bin) * bin; let prev = cum[0]; let k = 0;
  while (k < t.length) {
    while (k < t.length && t[k] < edge - 1e-9) k++;
    if (k >= t.length) break;
    x.push(edge); v.push((cum[k] - prev) / bin); prev = cum[k]; edge += bin;
  }
  return { x, v };
}

/** Poisson standard error of a count rate. */
export function rateUncertainty(count, span) { return span > 0 ? Math.sqrt(Math.max(count, 0)) / span : 0; }

export function formatRate(r) { return r >= 10 ? r.toFixed(1) : r.toFixed(2); }

/** A "nice" axis maximum >= v. */
export function niceMax(v, min = 1) {
  const m = Math.max(v, min); const e = Math.pow(10, Math.floor(Math.log10(m))); const f = m / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}
