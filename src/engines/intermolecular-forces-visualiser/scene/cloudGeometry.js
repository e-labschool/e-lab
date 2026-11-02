// Electron-cloud surfaces, one per molecule (pure typed-array code, no three / React; the scene wraps the arrays in BufferGeometry).
//
//   density   rho(p) = sum_i exp(-ln2 (|p - r_i| / R_i)^2)      atom-centred Gaussian blobs, R_i = van der Waals radius of atom i
//   surface   the OUTER iso-surface rho = c, found by ray-marching from the molecular centre along every vertex of an icosphere
//             (a star-shaped "SDF to mesh"; much cheaper than marching cubes and exact for the small molecules offered here)
//   iso c     chosen per molecule so the surface reaches the van der Waals envelope of the farthest atom (|r| + R)
//   ESP       static electrostatic potential of the model partial charges sampled on the vertices (qualitative colour)
// The mesh is built ONCE per molecule and cached. Polarisation never rebuilds it: applyShift() displaces the cached vertices.
// This is a qualitative picture of an electron-density envelope, NOT a quantum-mechanical density.
import { MOLECULES, ELEM } from "../model/molecules.js";
import { tanhSafe } from "./cloudMath.js";

export const stats = { built: 0, buildMs: 0 };
const LN2 = Math.LN2;

/** Indexed icosphere (unit radius) with `subdiv` midpoint subdivisions: 12, 42, 162, 642, 2562 vertices. */
export function icosphere(subdiv) {
  const t = (1 + Math.sqrt(5)) / 2; let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l]; });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < subdiv; s += 1) {
    const cache = new Map(); const mid = (a, b) => { const k = a < b ? `${a}_${b}` : `${b}_${a}`; let m = cache.get(k); if (m === undefined) { const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]; const l = Math.hypot(...p); v.push([p[0] / l, p[1] / l, p[2] / l]); m = v.length - 1; cache.set(k, m); } return m; };
    const nf = []; for (const [a, b, c] of f) { const ab = mid(a, b); const bc = mid(b, c); const ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  const dirs = new Float32Array(v.length * 3); v.forEach((p, i) => dirs.set(p, 3 * i));
  const index = new Uint32Array(f.length * 3); f.forEach((tri, i) => index.set(tri, 3 * i));
  return { dirs, index, count: v.length };
}
let ico = null;
const getIco = () => ico ?? (ico = icosphere(4));

function densityAt(atoms, x, y, z) {
  let s = 0; for (const a of atoms) { const dx = x - a.x; const dy = y - a.y; const dz = z - a.z; s += Math.exp((-LN2 * (dx * dx + dy * dy + dz * dz)) / a.R2); } return s;
}
const cache = new Map();
export const hasCloud = (id) => cache.has(id);
export const cloudCacheSize = () => cache.size;
export function clearClouds() { cache.clear(); }

/** Build (or fetch) the cached cloud of a molecule id: { positions, normals, dirs, esp, index, count, rMax, iso, radius }. */
export function getCloud(id) {
  const hit = cache.get(id); if (hit) return hit;
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const mol = MOLECULES[id]; const atoms = mol.atoms.map((a) => ({ x: a.p[0], y: a.p[1], z: a.p[2], R2: ELEM[a.el].vdw ** 2 }));
  const g = getIco(); const V = g.count;
  // iso level: reach |r| + R along the farthest atom's direction
  let far = atoms[0]; let best = -1; for (const a of atoms) { const d = Math.hypot(a.x, a.y, a.z) + Math.sqrt(a.R2); if (d > best) { best = d; far = a; } }
  const fl = Math.hypot(far.x, far.y, far.z); const u = fl > 1e-6 ? [far.x / fl, far.y / fl, far.z / fl] : [1, 0, 0];
  const iso = densityAt(atoms, u[0] * best, u[1] * best, u[2] * best);
  const tMax = best + 2.4; const positions = new Float32Array(V * 3); const normals = new Float32Array(V * 3); const esp = new Float32Array(V); let rMax = 0;
  for (let i = 0; i < V; i += 1) {
    const dx = g.dirs[3 * i]; const dy = g.dirs[3 * i + 1]; const dz = g.dirs[3 * i + 2];
    let tOut = tMax; let tIn = -1;
    for (let t = tMax; t > 0.05; t -= 0.14) { if (densityAt(atoms, dx * t, dy * t, dz * t) >= iso) { tIn = t; break; } tOut = t; }
    if (tIn < 0) tIn = 0.05;
    for (let k = 0; k < 14; k += 1) { const m = (tIn + tOut) / 2; if (densityAt(atoms, dx * m, dy * m, dz * m) >= iso) tIn = m; else tOut = m; }
    const t = (tIn + tOut) / 2; const px = dx * t; const py = dy * t; const pz = dz * t; positions[3 * i] = px; positions[3 * i + 1] = py; positions[3 * i + 2] = pz; rMax = Math.max(rMax, t);
    // outward normal = -grad(rho), analytic
    let gx = 0; let gy = 0; let gz = 0; let v = 0;
    for (const a of atoms) { const ex = px - a.x; const ey = py - a.y; const ez = pz - a.z; const w = Math.exp((-LN2 * (ex * ex + ey * ey + ez * ez)) / a.R2) * ((2 * LN2) / a.R2); gx += w * ex; gy += w * ey; gz += w * ez; }
    const gl = Math.hypot(gx, gy, gz) || 1; normals[3 * i] = gx / gl; normals[3 * i + 1] = gy / gl; normals[3 * i + 2] = gz / gl;
    for (let a = 0; a < mol.atoms.length; a += 1) { const q = mol.atoms[a].q; if (q === 0) continue; const ex = px - mol.atoms[a].p[0]; const ey = py - mol.atoms[a].p[1]; const ez = pz - mol.atoms[a].p[2]; v += q / Math.sqrt(ex * ex + ey * ey + ez * ez + 0.64); }
    esp[i] = v;
  }
  const cloud = { id, positions, normals, dirs: g.dirs, index: g.index, esp, count: V, rMax, iso };
  cache.set(id, cloud); stats.built += 1; stats.buildMs += (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return cloud;
}

/**
 * Cheap polarisation: displace the cached vertices. The electron cloud moves by `shift` (A) relative to the nuclei, the side the
 * cloud moves towards bulges a little more and the far side flattens. out = Float32Array(count*3).
 */
export function applyShift(cloud, shift, out) {
  const sl = Math.hypot(shift[0], shift[1], shift[2]); const P = cloud.positions; const D = cloud.dirs; const n = cloud.count;
  if (sl < 1e-6) { out.set(P); return out; }
  const sx = shift[0] / sl; const sy = shift[1] / sl; const sz = shift[2] / sl;
  for (let i = 0; i < n; i += 1) {
    const c = D[3 * i] * sx + D[3 * i + 1] * sy + D[3 * i + 2] * sz; // cos(angle between the vertex direction and the shift)
    const k = 1 + 0.4 * c; // vertices on the leading side move a little more (local bulge), the trailing side a little less
    out[3 * i] = P[3 * i] + shift[0] * k; out[3 * i + 1] = P[3 * i + 1] + shift[1] * k; out[3 * i + 2] = P[3 * i + 2] + shift[2] * k;
  }
  return out;
}

export const ESP_RED = [0.9, 0.22, 0.2]; export const ESP_BLUE = [0.2, 0.42, 0.93]; export const ESP_NEUTRAL = [0.82, 0.88, 0.97];
const V0 = 0.035; // e/A: potential at which the colour saturates
const perceptual = (x) => tanhSafe(Math.sign(x) * Math.sqrt(Math.abs(x))); // square-root compression: weak induced dipoles stay visible (qualitative picture)
const P_COLOR = 0.03; // e*A: induced / instantaneous dipole at which the pole colour is ~76 % saturated
/**
 * Electrostatic-potential colours for the vertices (qualitative): red = relatively electron-rich (negative potential),
 * blue = relatively electron-poor (positive). Static part from the permanent charges + a dipole part for an induced / instantaneous
 * dipole p (e*A): the end of p is the positive end (blue), the opposite end the negative end (red).
 */
export function applyEspColors(cloud, p, out, gain = 1) {
  const n = cloud.count; const D = cloud.dirs; const pl = Math.hypot(p[0], p[1], p[2]);
  for (let i = 0; i < n; i += 1) {
    let t = tanhSafe(cloud.esp[i] / V0);
    if (pl > 1e-9) t = Math.max(-1, Math.min(1, t + perceptual(((D[3 * i] * p[0] + D[3 * i + 1] * p[1] + D[3 * i + 2] * p[2]) * gain) / P_COLOR)));
    const a = Math.abs(t); const tgt = t < 0 ? ESP_RED : ESP_BLUE;
    out[3 * i] = ESP_NEUTRAL[0] + (tgt[0] - ESP_NEUTRAL[0]) * a; out[3 * i + 1] = ESP_NEUTRAL[1] + (tgt[1] - ESP_NEUTRAL[1]) * a; out[3 * i + 2] = ESP_NEUTRAL[2] + (tgt[2] - ESP_NEUTRAL[2]) * a;
  }
  return out;
}

let warmTimer = 0; let warmQueue = [];
/** Build clouds in idle time, one per slice (so Play never has to build geometry). Returns a cancel function. */
export function warmClouds(ids, { onDone } = {}) {
  warmQueue = [...new Set([...warmQueue, ...ids])].filter((id) => !cache.has(id));
  const ric = typeof requestIdleCallback === "function" ? requestIdleCallback : (fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 16);
  const cic = typeof cancelIdleCallback === "function" ? cancelIdleCallback : clearTimeout;
  const tick = (deadline) => {
    warmTimer = 0;
    while (warmQueue.length && (deadline.timeRemaining?.() ?? 8) > 3) { const id = warmQueue.shift(); if (!cache.has(id)) getCloud(id); }
    if (warmQueue.length) warmTimer = ric(tick); else onDone?.();
  };
  if (!warmTimer) warmTimer = ric(tick);
  return () => { if (warmTimer) cic(warmTimer); warmTimer = 0; };
}
