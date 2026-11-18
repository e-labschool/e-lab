// Plain-array 3-vector helpers for the electron-cloud module (pure; no three).
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const sum3 = (list) => list.reduce((s, v) => add(s, v), [0, 0, 0]);
/** Any unit vector perpendicular to the unit vector u. */
export const perpTo = (u) => { const r = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; return unit(cross(u, r)); };
