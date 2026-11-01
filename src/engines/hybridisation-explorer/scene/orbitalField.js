// Procedural orbital surfaces, pure (typed arrays only, no three): a shared latitude/longitude grid of unit directions and the
// SIGNED radius field r(dir) = R * sign(f) * (|f| / max|f|)^GAMMA of any combination of real angular functions. The sign of the field is the
// phase of the lobe. These are polar plots of (a power of) the angular part only: an educational representation, NOT a quantum calculation
// (no radial wavefunction, no probability integration). Fields and grids are cached and shared by every orbital that uses them.
import { combination, GAMMA } from "../model/orbitals.js";

function makeGrid(nTheta, nPhi) {
  const cols = nPhi + 1; const rows = nTheta + 1; const V = rows * cols;
  const dirs = new Float32Array(V * 3);
  for (let i = 0; i < rows; i += 1) {
    const th = (Math.PI * i) / nTheta; const st = Math.sin(th); const ct = Math.cos(th);
    for (let j = 0; j < cols; j += 1) {
      const ph = (2 * Math.PI * j) / nPhi; const k = (i * cols + j) * 3;
      dirs[k] = st * Math.cos(ph); dirs[k + 1] = st * Math.sin(ph); dirs[k + 2] = ct;
    }
  }
  const index = new Uint32Array(nTheta * nPhi * 6); let t = 0;
  for (let i = 0; i < nTheta; i += 1) for (let j = 0; j < nPhi; j += 1) {
    const a = i * cols + j; const b = a + 1; const c = a + cols; const d = c + 1;
    index[t++] = a; index[t++] = c; index[t++] = b; index[t++] = b; index[t++] = c; index[t++] = d;
  }
  return { nTheta, nPhi, cols, rows, V, dirs, index };
}
export const GRID_HIGH = makeGrid(44, 80);
export const GRID_LOW = makeGrid(24, 44);

const fieldCache = new Map();
export const termsKey = (terms) => terms.map(([k, c]) => `${k}:${c.toFixed(5)}`).join("+");

/** Signed radius at every grid vertex; |field| <= R and the largest lobe reaches R. terms = [[kind, coefficient], ...]. */
export function signedField(terms, R, grid = GRID_HIGH) {
  const key = `${grid.nTheta}|${R.toFixed(4)}|${termsKey(terms)}`;
  let f = fieldCache.get(key); if (f) return f;
  f = new Float32Array(grid.V); let max = 0;
  for (let v = 0; v < grid.V; v += 1) { const x = grid.dirs[v * 3]; const y = grid.dirs[v * 3 + 1]; const z = grid.dirs[v * 3 + 2]; const a = combination(terms, x, y, z); f[v] = a; const m = Math.abs(a); if (m > max) max = m; }
  // r = R * (|f| / max|f|)^GAMMA keeping the sign (phase) of f
  for (let v = 0; v < grid.V; v += 1) { const q = max > 0 ? f[v] / max : 0; f[v] = Math.sign(q) * Math.pow(Math.abs(q), GAMMA) * R; }
  fieldCache.set(key, f); return f;
}
export function clearFieldCache() { fieldCache.clear(); }
export const fieldCacheSize = () => fieldCache.size;

/** Fill positions (dir * |field|) and per-vertex sign into the given arrays; allocation free. */
export function fillPositions(grid, field, out) {
  for (let v = 0; v < grid.V; v += 1) { const r = Math.abs(field[v]); out[v * 3] = grid.dirs[v * 3] * r; out[v * 3 + 1] = grid.dirs[v * 3 + 1] * r; out[v * 3 + 2] = grid.dirs[v * 3 + 2] * r; }
}
/** Interpolated signed field between two fields (morph): out = (1-t) a + t b. */
export function lerpField(a, b, t, out) { const s = 1 - t; for (let v = 0; v < out.length; v += 1) out[v] = a[v] * s + b[v] * t; }
