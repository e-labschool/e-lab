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
/** Teaching-animation rates (display revolutions per second at speed 1): the sphere "spin" cue and the precession about B0. Precession is the slower, distinct motion. */
export const SPIN_REV_PER_S = 0.85;
export const PRECESSION_REV_PER_S = 0.4;

/**
 * Deterministic ensemble: positions in a ball with a minimum separation (dart throwing), random initial directions and a stable random order that
 * decides which nuclei are alpha, so that the spheres, arrows and precession rings of neighbours do not pile up. If the ball is too small for n points the separation is relaxed.
 */
export function makeSpacedEnsemble(n = 56, seed = 20240611, { radius = 1.5, minDist = 0.6 } = {}) {
  const rng = mulberry32(seed);
  const unit = () => { const z = 2 * rng() - 1; const t = 2 * Math.PI * rng(); const r = Math.sqrt(1 - z * z); return [r * Math.cos(t), r * Math.sin(t), z]; };
  const pos = []; let d = minDist; let tries = 0;
  while (pos.length < n) {
    const u = unit(); const rad = radius * Math.cbrt(rng()); const c = [u[0] * rad, u[1] * rad, u[2] * rad];
    if (pos.every((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]) >= d)) { pos.push(c); tries = 0; } else { tries += 1; if (tries > 3000) { d *= 0.95; tries = 0; } }
  }
  const dir0 = Array.from({ length: n }, unit); const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { n, pos, dir0, order, rank: Object.fromEntries(order.map((idx, r) => [idx, r])), minDist: d };
}

/** Slowly changing random direction of nucleus i before the field is applied (no preferred orientation): its own initial direction plus a bounded wander. */
export function tumbleDirection(ens, i, t) {
  const d0 = ens.dir0[i];
  const a = 0.35 + ((i * 37) % 11) * 0.05; const b = 0.3 + ((i * 53) % 13) * 0.04; const c = 0.4 + ((i * 29) % 7) * 0.06; const ph = i * 1.7;
  return norm3([d0[0] + 0.5 * Math.sin(t * a + ph), d0[1] + 0.5 * Math.sin(t * b + ph * 1.3), d0[2] + 0.5 * Math.sin(t * c + ph * 0.7)]);
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
 *  start: optional direction to leave from while the field is switched on (default: the nucleus's initial random direction)
 */
export function arrowDirection(ens, i, isAlpha, { apply = 1, phase = 0, view = "scientific", start } = {}) {
  let target;
  if (view === "simplified") target = [0, 0, isAlpha ? 1 : -1];
  else {
    // stratified azimuths within each state -> exactly zero net transverse magnetisation of the drawn ensemble
    const k = ens.rank[i]; const az = 2 * Math.PI * ((k * 0.6180339887498949) % 1) - phase; // clockwise precession for gamma > 0
    const th = isAlpha ? CONE_ANGLE : Math.PI - CONE_ANGLE;
    target = [Math.sin(th) * Math.cos(az), Math.sin(th) * Math.sin(az), Math.cos(th)];
  }
  const e = apply * apply * (3 - 2 * apply);
  const from = start ?? ens.dir0[i];
  return e >= 1 ? target : e <= 0 ? from : slerp(from, target, e);
}

/** Net moment of the drawn ensemble divided by n, as a vector (x,y,z) for unit-length arrows. */
export function netOfDrawn(ens, states, opts) {
  let x = 0; let y = 0; let z = 0;
  for (let i = 0; i < ens.n; i += 1) { const d = arrowDirection(ens, i, states.alpha[i], opts); x += d[0]; y += d[1]; z += d[2]; }
  return [x / ens.n, y / ens.n, z / ens.n];
}
