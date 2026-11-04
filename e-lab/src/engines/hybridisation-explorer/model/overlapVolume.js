// Continuous orbital OVERLAP measure and the overlap REGIONS the Orbital Lab highlights. Pure (no React, no three).
//
// The discrete bond rules in overlap.js decide whether a sigma / pi bond is valid (type, alignment, distance window, phase,
// occupancy). This module is the continuous, geometric counterpart used to DRAW the overlap: it measures how much the two drawn
// surfaces really intersect, so the highlight grows smoothly as atoms approach and shrinks smoothly as they are pulled apart.
//
//   measure = ( volume where both surfaces have the SAME wavefunction phase  -  volume where the phases are OPPOSITE )
//             / ( volume of the larger lobe of the smaller orbital )
//
// Membership of a point in a surface is a soft step (one lattice cell wide) so the measure is continuous in the separation (no
// aliasing jumps). It is a qualitative geometric measure of the drawn educational surfaces, not a quantum-mechanical overlap
// integral. A p orbital turned 90 degrees away from an s orbital overlaps equally in phase and out of phase: the measure is 0.
import { makeSurface, lobeVolumes } from "./surface.js";
import { qRotate, qConj, qFromBasis, normalize, cross } from "./vec.js";

const N = 13; // lattice points per side (in the frame of the first orbital)
const surfCache = new Map();
/** Cached surface of an orbital instance (terms + class + reach). */
export function surfaceOf(inst) {
  const key = `${inst.cls}|${inst.reach.toFixed(4)}|${inst.terms.map(([k, c]) => `${k}:${c.toFixed(5)}`).join("+")}`;
  let s = surfCache.get(key); if (!s) { s = makeSurface(inst.terms, inst.cls, inst.reach); surfCache.set(key, s); } return s;
}
const lobeScale = (inst) => { const v = lobeVolumes(surfaceOf(inst)); return Math.max(v.pos, v.neg); };

/** Signed radius of an instance's surface in the WORLD direction (x, y, z) (unit). */
export function radiusIn(inst, x, y, z) {
  const d = qRotate(qConj(inst.quat), [x, y, z]); return surfaceOf(inst).at(d[0], d[1], d[2]);
}

function jacobiEigen(m) { // symmetric 3x3 -> { values, vectors (columns) }
  const a = m.map((r) => r.slice()); const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 12; sweep += 1) {
    let off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]); if (off < 1e-14) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-16) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]); const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)); const c = 1 / Math.sqrt(t * t + 1); const s = t * c;
      for (let k = 0; k < 3; k += 1) { const akp = a[k][p]; const akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k += 1) { const apk = a[p][k]; const aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k += 1) { const vkp = v[k][p]; const vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
    }
  }
  return { values: [a[0][0], a[1][1], a[2][2]], vectors: [[v[0][0], v[1][0], v[2][0]], [v[0][1], v[1][1], v[2][1]], [v[0][2], v[1][2], v[2][2]]] };
}

const NONE = { measure: 0, bonding: 0, anti: 0, regions: [] };

// Lattice of the FIRST orbital: points (relative to its nucleus) that lie inside its surface, with the soft membership weight and phase.
// It does not depend on where the orbital is, only on its shape and orientation, so it is cached (a dragged atom re-evaluates the partner only).
const latticeCache = new Map();
function latticeOf(a, sa) {
  const key = `${a.cls}|${a.reach.toFixed(4)}|${a.terms.map(([k, c]) => `${k}:${c.toFixed(5)}`).join("+")}|${a.quat.map((q) => q.toFixed(4)).join(",")}`;
  let L = latticeCache.get(key); if (L) return L;
  const R = a.reach; const h = (2 * R) / (N - 1); const soft = h; const qx = -a.quat[0]; const qy = -a.quat[1]; const qz = -a.quat[2]; const qw = a.quat[3];
  const xs = []; const ys = []; const zs = []; const ws = []; const ph = [];
  for (let i = 0; i < N; i += 1) for (let j = 0; j < N; j += 1) for (let k = 0; k < N; k += 1) {
    const px = -R + i * h; const py = -R + j * h; const pz = -R + k * h;
    const d = Math.hypot(px, py, pz); if (d < 1e-6 || d > R + soft) continue;
    const ux = px / d; const uy = py / d; const uz = pz / d;
    const tx = 2 * (qy * uz - qz * uy); const ty = 2 * (qz * ux - qx * uz); const tz = 2 * (qx * uy - qy * ux);
    const r = sa.at(ux + qw * tx + (qy * tz - qz * ty), uy + qw * ty + (qz * tx - qx * tz), uz + qw * tz + (qx * ty - qy * tx));
    const w = Math.min(1, Math.max(0, 0.5 + (Math.abs(r) - d) / soft)); if (w <= 0) continue;
    xs.push(px); ys.push(py); zs.push(pz); ws.push(w); ph.push(r >= 0 ? 1 : -1);
  }
  L = { n: xs.length, x: Float32Array.from(xs), y: Float32Array.from(ys), z: Float32Array.from(zs), w: Float32Array.from(ws), ph: Int8Array.from(ph), h, soft };
  if (latticeCache.size > 96) latticeCache.delete(latticeCache.keys().next().value);
  latticeCache.set(key, L); return L;
}

/**
 * overlapBetween(a, b) -> { measure, bonding, anti, regions }. a, b: orbital instances from overlap.js (pos, quat, terms, cls, reach).
 * regions: ellipsoids {center, quat, radii:[3], phase: +1|-1, weight} covering the same-phase intersection (one per phase side:
 * a sigma overlap gives one lens, a parallel p-p pi overlap gives two, above and below the bond axis).
 */
export function overlapBetween(a, b) {
  const dx = b.pos[0] - a.pos[0]; const dy = b.pos[1] - a.pos[1]; const dz = b.pos[2] - a.pos[2];
  const dist = Math.hypot(dx, dy, dz); if (dist > a.reach + b.reach) return NONE;
  const sa = surfaceOf(a); const sb = surfaceOf(b); const L = latticeOf(a, sa); const { h, soft } = L;
  const qx = -b.quat[0]; const qy = -b.quat[1]; const qz = -b.quat[2]; const qw = b.quat[3];
  let same = 0; let opp = 0;
  const acc = [0, 1].map(() => ({ w: 0, x: 0, y: 0, z: 0, xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 }));
  for (let n = 0; n < L.n; n += 1) {
    const px = L.x[n]; const py = L.y[n]; const pz = L.z[n];
    const vx = px - dx; const vy = py - dy; const vz = pz - dz; const db = Math.hypot(vx, vy, vz); if (db < 1e-6 || db > b.reach + soft) continue;
    const ux = vx / db; const uy = vy / db; const uz = vz / db;
    const tx = 2 * (qy * uz - qz * uy); const ty = 2 * (qz * ux - qx * uz); const tz = 2 * (qx * uy - qy * ux);
    const rb = sb.at(ux + qw * tx + (qy * tz - qz * ty), uy + qw * ty + (qz * tx - qx * tz), uz + qw * tz + (qx * ty - qy * tx));
    const wb = Math.min(1, Math.max(0, 0.5 + (Math.abs(rb) - db) / soft)); if (wb <= 0) continue;
    const w = L.w[n] * wb; const pa = L.ph[n];
    if ((pa > 0) === (rb >= 0)) {
      same += w; const c = acc[pa > 0 ? 0 : 1];
      const X = a.pos[0] + px; const Y = a.pos[1] + py; const Z = a.pos[2] + pz;
      c.w += w; c.x += w * X; c.y += w * Y; c.z += w * Z; c.xx += w * X * X; c.yy += w * Y * Y; c.zz += w * Z * Z; c.xy += w * X * Y; c.xz += w * X * Z; c.yz += w * Y * Z;
    } else opp += w;
  }
  const cell = h * h * h; const ref = Math.min(lobeScale(a), lobeScale(b)) || 1;
  const bonding = same * cell; const anti = opp * cell;
  const regions = [];
  acc.forEach((c, idx) => {
    if (c.w * cell < 1e-4 * ref) return;
    const mx = c.x / c.w; const my = c.y / c.w; const mz = c.z / c.w;
    const cov = [[c.xx / c.w - mx * mx, c.xy / c.w - mx * my, c.xz / c.w - mx * mz], [c.xy / c.w - mx * my, c.yy / c.w - my * my, c.yz / c.w - my * mz], [c.xz / c.w - mx * mz, c.yz / c.w - my * mz, c.zz / c.w - mz * mz]];
    const e = jacobiEigen(cov); const ax = e.vectors.map((v) => normalize(v));
    const x = ax[0]; const y = ax[1]; const z = normalize(cross(x, y));
    regions.push({ center: [mx, my, mz], quat: qFromBasis(x, y, z), radii: e.values.map((v) => Math.sqrt(Math.max(5 * v, 1e-6))), phase: idx === 0 ? 1 : -1, weight: c.w * cell / ref });
  });
  return { measure: (bonding - anti) / ref, bonding: bonding / ref, anti: anti / ref, regions };
}

/** Normalised highlight strength 0..1 of a measure: 0 below 2 % overlap, 1 above 18 %, smooth in between. */
export const highlightStrength = (measure) => { const x = Math.min(1, Math.max(0, (measure - 0.02) / 0.16)); return x * x * (3 - 2 * x); };

/**
 * All overlap highlights of a workspace: pairs of half-filled orbitals on different atoms whose surfaces intersect in phase.
 * Each orbital keeps only its strongest partner (so a crowded scene stays readable). Returns [{id, a, b, measure, strength, regions, type}].
 */
export function workspaceOverlaps(instances, { minMeasure = 0.02 } = {}) {
  const found = [];
  for (let i = 0; i < instances.length; i += 1) for (let j = i + 1; j < instances.length; j += 1) {
    const a = instances[i]; const b = instances[j];
    if (a.atomId === b.atomId || a.electrons !== 1 || b.electrons !== 1 || a.cls === "d" || b.cls === "d") continue;
    const dist = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]); if (dist > a.reach + b.reach) continue;
    const o = overlapBetween(a, b); if (o.measure < minMeasure || !o.regions.length) continue;
    found.push({ id: `${a.key}~${b.key}`, a, b, measure: o.measure, strength: highlightStrength(o.measure), regions: o.regions });
  }
  found.sort((x, y) => y.measure - x.measure);
  const used = new Set(); const out = [];
  for (const f of found) { if (used.has(f.a.key) || used.has(f.b.key)) continue; used.add(f.a.key); used.add(f.b.key); out.push(f); }
  return out;
}
