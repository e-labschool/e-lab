// A drawable ensemble of spin-1/2 nuclei (pure geometry; no three, no React).
//
// What the picture means (and does not mean):
//  * Each arrow is the magnetic moment of ONE nucleus: before the field its direction is arbitrary (no preferred direction, no net M).
//  * In a field B0 the only allowed states are alpha (m = +1/2, lower energy) and beta (m = -1/2, higher energy). The z-component of the
//    moment is +/- gamma hbar / 2 and its magnitude is gamma hbar sqrt(3)/2, so in the "scientific" view the moment lies on a cone at
//    arccos(+/- 1/sqrt 3) = 54.74 / 125.26 degrees from z and precesses about z; the azimuth of different nuclei is random (incoherent),
//    which is why there is no transverse net magnetisation. The "simplified" view draws plain up / down arrows.
//  * The number of arrows in alpha follows the (real or exaggerated) polarisation, rounded to the nearest arrow.
import { drawnAlphaCount } from "./populations.js";
import { mulberry32 } from "./fid.js";

export const CONE_ANGLE = Math.acos(1 / Math.sqrt(3)); // 54.7356 degrees: angle between mu and +z for m = +1/2

/** Deterministic ensemble: positions in a ball, random initial directions, stable random order that decides which arrows are alpha. */
export function makeEnsemble(n = 160, seed = 20240611) {
  const rng = mulberry32(seed);
  const unit = () => { const z = 2 * rng() - 1; const t = 2 * Math.PI * rng(); const r = Math.sqrt(1 - z * z); return [r * Math.cos(t), r * Math.sin(t), z]; };
  const pos = []; const dir0 = []; const order = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n; i += 1) { const u = unit(); const rad = 1.3 * Math.cbrt(rng()); pos.push([u[0] * rad, u[1] * rad, u[2] * rad]); dir0.push(unit()); }
  for (let i = n - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { n, pos, dir0, order, rank: Object.fromEntries(order.map((idx, r) => [idx, r])) };
}

/** Which arrows are alpha for a displayed polarisation: the first `nAlpha` in the stable random order. */
export function assignStates(ens, displayedPolarization) {
  const nA = drawnAlphaCount(ens.n, displayedPolarization);
  const alpha = new Array(ens.n).fill(false);
  for (let r = 0; r < nA; r += 1) alpha[ens.order[r]] = true;
  return { alpha, nAlpha: nA, nBeta: ens.n - nA };
}

const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** Spherical interpolation of two unit vectors. */
export function slerp(a, b, t) {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const om = Math.acos(d);
  if (om < 1e-6) return norm3([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  if (Math.abs(Math.PI - om) < 1e-6) { // opposite: go through a perpendicular
    const p = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const c = norm3([a[1] * p[2] - a[2] * p[1], a[2] * p[0] - a[0] * p[2], a[0] * p[1] - a[1] * p[0]]);
    const ang = Math.PI * t; return [a[0] * Math.cos(ang) + c[0] * Math.sin(ang), a[1] * Math.cos(ang) + c[1] * Math.sin(ang), a[2] * Math.cos(ang) + c[2] * Math.sin(ang)];
  }
  const s = Math.sin(om); const wa = Math.sin((1 - t) * om) / s; const wb = Math.sin(t * om) / s;
  return [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]];
}

/**
 * Direction of arrow i.
 *  apply: 0..1 progress of switching the field on (0 = field off: initial random direction)
 *  phase: precession angle (radians) common to all nuclei (each nucleus keeps its own random azimuth offset)
 *  view:  "scientific" (precessing cone) | "simplified" (up / down)
 */
export function arrowDirection(ens, i, isAlpha, { apply = 1, phase = 0, view = "scientific" } = {}) {
  let target;
  if (view === "simplified") target = [0, 0, isAlpha ? 1 : -1];
  else {
    // stratified azimuths within each state -> exactly zero net transverse magnetisation of the drawn ensemble
    const k = ens.rank[i]; const az = 2 * Math.PI * ((k * 0.6180339887498949) % 1) - phase; // clockwise precession for gamma > 0
    const th = isAlpha ? CONE_ANGLE : Math.PI - CONE_ANGLE;
    target = [Math.sin(th) * Math.cos(az), Math.sin(th) * Math.sin(az), Math.cos(th)];
  }
  const e = apply * apply * (3 - 2 * apply);
  return e >= 1 ? target : e <= 0 ? ens.dir0[i] : slerp(ens.dir0[i], target, e);
}

/** Net moment of the drawn ensemble divided by n, as a vector (x,y,z) for unit-length arrows. */
export function netOfDrawn(ens, states, opts) {
  let x = 0; let y = 0; let z = 0;
  for (let i = 0; i < ens.n; i += 1) { const d = arrowDirection(ens, i, states.alpha[i], opts); x += d[0]; y += d[1]; z += d[2]; }
  return [x / ens.n, y / ens.n, z / ens.n];
}
