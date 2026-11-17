// Radial probability distribution P(r) = r^2 |R_nl(r)|^2 (OE-06). Integral of P over all r is 1, so P(r) dr is the
// probability of finding the electron between r and r + dr, in atomic units (r in Bohr radii a0, hydrogen Z = 1).
import { radialWavefunction } from "./orbitalMath.js";

export function radialProbability(n, l, r) {
  const R = radialWavefunction(n, l, r);
  return r * r * R * R;
}

/** Sampled curve from 0 to rMax with `count` + 1 points. */
export function radialCurve(n, l, rMax, count = 400) {
  return Array.from({ length: count + 1 }, (_, i) => { const r = (i / count) * rMax; return { r, p: radialProbability(n, l, r) }; });
}

/** Trapezoid integral of the curve (should be about 1 when rMax is large enough). */
export function integrate(curve) {
  let s = 0;
  for (let i = 1; i < curve.length; i++) s += 0.5 * (curve[i].p + curve[i - 1].p) * (curve[i].r - curve[i - 1].r);
  return s;
}

/** Local maxima of P(r) and the radial nodes (sign changes of R_nl, refined by bisection), in a0. */
export function radialFeatures(n, l, rMax = 6 * n * n, count = 6000) {
  const c = radialCurve(n, l, rMax, count);
  const peaks = [];
  for (let i = 1; i < c.length - 1; i++) {
    if (c[i].p > c[i - 1].p && c[i].p >= c[i + 1].p && c[i].p > 1e-12) peaks.push({ r: c[i].r, p: c[i].p });
  }
  const nodes = [];
  const R = (r) => radialWavefunction(n, l, r);
  let prev = R(1e-6 * rMax);
  for (let i = 2; i < c.length; i++) {
    const cur = R(c[i].r + 1.234e-7); // offset so an exact zero on the grid is not missed
    if (prev * cur < 0) {
      let lo = c[i - 1].r; let hi = c[i].r;
      for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (R(lo) * R(mid) <= 0) hi = mid; else lo = mid; }
      nodes.push({ r: (lo + hi) / 2 });
    }
    prev = cur;
  }
  return { peaks, nodes };
}
