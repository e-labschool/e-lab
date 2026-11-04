// Procedural orbital surfaces, pure (typed arrays only, no three): ONE shared latitude/longitude grid of unit directions and the SIGNED
// radius field r(dir) = R * sign(f) * (|f| / max|f|)^K of any combination of real angular functions (see model/surface.js for the
// definition and the meaning of K). The sign of the field is the wavefunction phase of the lobe. Static fields are cached; the Mix
// animation re-fills one preallocated Float32Array per frame (no allocation in the frame loop).
import { angular } from "../model/orbitals.js";

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
  return { nTheta, nPhi, cols, rows, V, dirs, index, basis: new Map() };
}
export const GRID = makeGrid(48, 88);

/** Angular function of one kind at every grid vertex (cached Float32Array). */
export function basisOf(kind, grid = GRID) {
  let b = grid.basis.get(kind); if (b) return b;
  b = new Float32Array(grid.V);
  for (let v = 0; v < grid.V; v += 1) b[v] = angular(kind, grid.dirs[v * 3], grid.dirs[v * 3 + 1], grid.dirs[v * 3 + 2]);
  grid.basis.set(kind, b); return b;
}
export const termsKey = (terms) => terms.map(([k, c]) => `${k}:${c.toFixed(5)}`).join("+");

/**
 * Fill `out` (length V) with the signed radius of the surface (terms, R, K); returns nothing. `tmp` (length V) is scratch for f.
 * max|f| is taken over the grid vertices, the same code path for static and blended surfaces, so a blend at t = 0 / 1 reproduces the
 * static field of the source / target exactly.
 */
export function fillField(terms, R, K, out, tmp, grid = GRID) {
  const V = grid.V; tmp.fill(0);
  for (let t = 0; t < terms.length; t += 1) { const b = basisOf(terms[t][0], grid); const c = terms[t][1]; for (let v = 0; v < V; v += 1) tmp[v] += c * b[v]; }
  let max = 0; for (let v = 0; v < V; v += 1) { const m = Math.abs(tmp[v]); if (m > max) max = m; }
  if (max <= 1e-12) { out.fill(0); return; }
  const inv = 1 / max;
  for (let v = 0; v < V; v += 1) { const q = tmp[v] * inv; out[v] = (q < 0 ? -1 : 1) * Math.pow(q < 0 ? -q : q, K) * R; }
}

const fieldCache = new Map();
/** Cached static signed field of a surface. */
export function signedField(terms, R, K, grid = GRID) {
  const key = `${R.toFixed(4)}|${K.toFixed(3)}|${termsKey(terms)}`;
  let f = fieldCache.get(key); if (f) return f;
  f = new Float32Array(grid.V); fillField(terms, R, K, f, new Float32Array(grid.V), grid); fieldCache.set(key, f); return f;
}
export function clearFieldCache() { fieldCache.clear(); }
export const fieldCacheSize = () => fieldCache.size;

/** Taper of the drawn lobes. The polar surface r(dir) leaves a p / hybrid lobe fat right up to the nucleus (like a balloon); the mesh is
 *  therefore also narrowed towards the nucleus: for a vertex of the lobe with axis a (a for the positive phase, -a for the negative),
 *  z = P.a and the sideways part rho = P - z a are scaled by T(z/R) = (z / (U0 R))^TAPER_EXP for z < U0 R (and 1 beyond), so every lobe
 *  runs into the nucleus as a cone, not a ball. `strength` (0..1) blends the taper in (the s sphere of the morph has none). Rendering only. */
export const TAPER_U0 = 0.65; export const TAPER_EXP = 0.8;
/** Positions (dir * |field|) into `out`; allocation free. taper = { axis: [x, y, z], strength, R, width } or null (width = overall lateral scale). */
export function fillPositions(grid, field, out, taper = null) {
  const d = grid.dirs;
  if (!taper || taper.strength <= 0) { for (let v = 0; v < grid.V; v += 1) { const r = Math.abs(field[v]); out[v * 3] = d[v * 3] * r; out[v * 3 + 1] = d[v * 3 + 1] * r; out[v * 3 + 2] = d[v * 3 + 2] * r; } return; }
  const [ax, ay, az] = taper.axis; const st = taper.strength; const zc = TAPER_U0 * taper.R; const wd = taper.width ?? 1;
  for (let v = 0; v < grid.V; v += 1) {
    const f = field[v]; const r = Math.abs(f); let x = d[v * 3] * r; let y = d[v * 3 + 1] * r; let z = d[v * 3 + 2] * r;
    const sg = f >= 0 ? 1 : -1; const zz = sg * (x * ax + y * ay + z * az); // distance along this lobe's own axis
    {
      const t = zz >= zc ? 1 : zz <= 0 ? 0 : Math.pow(zz / zc, TAPER_EXP); const k = (1 - st * (1 - t)) * (1 - st * (1 - wd)); // lateral scale factor
      const px = x - sg * zz * ax; const py = y - sg * zz * ay; const pz = z - sg * zz * az; // sideways part
      x = sg * zz * ax + px * k; y = sg * zz * ay + py * k; z = sg * zz * az + pz * k;
    }
    out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z;
  }
}
