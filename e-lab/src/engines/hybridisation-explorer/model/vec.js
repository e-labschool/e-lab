// Tiny allocation-light vector / quaternion helpers (plain arrays). Pure: no React, no three.
// Vectors are [x, y, z]; quaternions are [x, y, z, w] (unit).
export const EPS = 1e-9;
export const DEG = 180 / Math.PI;
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a) => { const l = len(a); return l < EPS ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l]; };
export const neg = (a) => [-a[0], -a[1], -a[2]];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** Angle between two vectors in degrees (0..180). */
export const angleDeg = (a, b) => {
  const la = len(a); const lb = len(b); if (la < EPS || lb < EPS) return 0;
  return Math.acos(clamp(dot(a, b) / (la * lb), -1, 1)) * DEG;
};
export const rad = (d) => d / DEG;

export const QI = [0, 0, 0, 1];
export function qFromAxisAngle(axis, angle) {
  const a = normalize(axis); const s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
}
export function qMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
export function qNormalize(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
/** Rotate vector v by quaternion q. */
export function qRotate(q, v) {
  const [x, y, z, w] = q; const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
/** Shortest-arc rotation taking unit vector a onto unit vector b. */
export function qFromUnitVectors(a, b) {
  const d = dot(a, b);
  if (d > 1 - 1e-12) return QI;
  if (d < -1 + 1e-12) { // opposite: any perpendicular axis
    let ax = cross([1, 0, 0], a); if (len(ax) < 1e-6) ax = cross([0, 1, 0], a);
    return qFromAxisAngle(ax, Math.PI);
  }
  const c = cross(a, b); return qNormalize([c[0], c[1], c[2], 1 + d]);
}
export function qSlerp(a, b, t) {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b; if (cos < 0) { cos = -cos; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (cos > 0.9995) return qNormalize([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(cos); const s = Math.sin(th); const wa = Math.sin((1 - t) * th) / s; const wb = Math.sin(t * th) / s;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
}
/** Component of v perpendicular to unit axis u. */
export const perp = (v, u) => sub(v, scale(u, dot(v, u)));
/** Signed angle (rad) from a to b about unit axis u, using the components perpendicular to u. */
export function signedAngleAbout(a, b, u) {
  const pa = perp(a, u); const pb = perp(b, u);
  if (len(pa) < 1e-6 || len(pb) < 1e-6) return 0;
  return Math.atan2(dot(cross(pa, pb), u), dot(pa, pb));
}
/** Quaternion of the rotation whose columns are the orthonormal basis (x, y, z). */
export function qFromBasis(x, y, z) {
  const m00 = x[0], m10 = x[1], m20 = x[2], m01 = y[0], m11 = y[1], m21 = y[2], m02 = z[0], m12 = z[1], m22 = z[2];
  const tr = m00 + m11 + m22; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  return qNormalize(q);
}
