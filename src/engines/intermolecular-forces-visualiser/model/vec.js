// Tiny vector / quaternion helpers (plain arrays, no three). Quaternions are [x, y, z, w].
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const norm = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** angle in degrees between two vectors */
export const angleDeg = (a, b) => { const la = len(a); const lb = len(b); if (la < 1e-12 || lb < 1e-12) return 0; return (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb)))) * 180) / Math.PI; };
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

export const QID = [0, 0, 0, 1];
export function qMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
export function qFromAxisAngle(axis, ang) { const a = norm(axis); const s = Math.sin(ang / 2); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)]; }
export function qConj(q) { return [-q[0], -q[1], -q[2], q[3]]; }
/** rotate vector v by unit quaternion q */
export function qRot(q, v) {
  const [x, y, z, w] = q; const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy); const ty = 2 * (z * vx - x * vz); const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
/** shortest-arc rotation taking direction a onto direction b */
export function qFromTo(a, b) {
  const u = norm(a); const v = norm(b); const d = dot(u, v);
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) { let ax = cross([1, 0, 0], u); if (len(ax) < 1e-6) ax = cross([0, 1, 0], u); return qFromAxisAngle(ax, Math.PI); }
  const c = cross(u, v); return qNorm([c[0], c[1], c[2], 1 + d]);
}
export function qSlerp(a, b, t) {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; let bb = b;
  if (cos < 0) { cos = -cos; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (cos > 0.9995) return qNorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(cos); const s = Math.sin(th); const wa = Math.sin((1 - t) * th) / s; const wb = Math.sin(t * th) / s;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
}
/** Quaternion that maps an orthonormal-ish local frame (fa, fb) onto a target frame (ta, tb): fa -> ta exactly, then twist about ta so fb lines up as well as possible. */
export function qFromFrames(fa, fb, ta, tb) {
  const q1 = qFromTo(fa, ta);
  const fb1 = qRot(q1, fb);
  const proj = (v, n) => sub(v, scale(n, dot(v, n)));
  const p1 = norm(proj(fb1, ta)); const p2 = norm(proj(tb, ta));
  if (len(p1) < 1e-9 || len(p2) < 1e-9) return q1;
  const ang = Math.atan2(dot(cross(p1, p2), norm(ta)), dot(p1, p2));
  return qNorm(qMul(qFromAxisAngle(ta, ang), q1));
}
