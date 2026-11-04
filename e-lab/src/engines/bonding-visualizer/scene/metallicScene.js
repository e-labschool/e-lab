// Metallic scene: pure geometry and an allocation-free per-frame engine for the 3D workspace.
// Units: world units. The metal ions live inside a cube of half-size H(n) centred on the origin.
// The electron sea is a SIMPLIFIED, illustrative model: every delocalised electron follows a smooth looping path that is
// confined to the cube. It is not a classical trajectory and not to scale.
import { easeInOut, lerp } from "./atomGeometry.js";
import { MAX_METAL_ATOMS, latticeBlock } from "../model/metallic.js";

export const R_ATOM = 0.28;
export const R_CORE = 0.2; // ion radius while the atoms are still loose
export const R_LATTICE_CORE = 0.17; // ion radius per unit of lattice spacing once in the lattice
export const R_ELECTRON = 0.1;
export const MAX_VALENCE = 3; // Al is the largest in the library
export const MAX_ELECTRONS = MAX_METAL_ATOMS * MAX_VALENCE;
export const U_MAX = 1.7; // largest lattice spacing used in the cube (display units per nearest-neighbour distance)
export const WALL_MARGIN = 0.9;
const SLOT = 1.5; // spacing of the loose "arrange atoms" slots
const ORBIT_R = 0.5;

const rand = (n, salt) => { const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Index of the cubic shell (0 = the centre slot) needed to hold n atoms in the placement grid. */
const shellFor = (n) => { let m = 0; while ((2 * m + 1) ** 3 < n) m += 1; return m; };
/** Half-size of the cube for n atoms (steps with the placement shells, never smaller than 2.4). */
export function cubeHalf(n) { return Math.max(2.4, SLOT * shellFor(Math.max(1, n)) + 1.0); }

let slotCache = null;
/** Placement slots (loose grid), nearest the centre first, in cubic shells. 7x7x7 = 343 > 200. */
export function placementSlots() {
  if (slotCache) return slotCache;
  const s = [];
  for (let i = -3; i <= 3; i += 1) for (let j = -3; j <= 3; j += 1) for (let k = -3; k <= 3; k += 1) s.push([i, j, k]);
  s.sort((a, b) => Math.max(...a.map(Math.abs)) - Math.max(...b.map(Math.abs)) || (a[0] ** 2 + a[1] ** 2 + a[2] ** 2) - (b[0] ** 2 + b[1] ** 2 + b[2] ** 2) || a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  slotCache = s.map(([i, j, k]) => [i * SLOT, j * SLOT, k * SLOT]);
  return slotCache;
}

export function clampToCube(p, H, margin = R_ATOM + 0.15) {
  const m = H - margin;
  return [Math.max(-m, Math.min(m, p[0])), Math.max(-m, Math.min(m, p[1])), Math.max(-m, Math.min(m, p[2]))];
}

/**
 * Loose, slightly jittered positions for `k` new atoms next to `existing` ([[x,y,z]...]): each takes the first free
 * slot of the placement grid (centre outward). Always inside the cube of the final count.
 */
export function placeNewAtoms(existing, k, serial = existing.length) {
  const slots = placementSlots();
  const taken = existing.map((p) => [p[0], p[1], p[2]]);
  const H = cubeHalf(existing.length + k);
  const out = [];
  for (let n = 0; n < k; n += 1) {
    const sid = serial + n + 1;
    let pos = null;
    for (const s of slots) {
      let free = true;
      for (const t of taken) { if (Math.abs(t[0] - s[0]) < 1.1 && Math.abs(t[1] - s[1]) < 1.1 && Math.abs(t[2] - s[2]) < 1.1) { free = false; break; } }
      if (free) { pos = s; break; }
    }
    pos = pos ?? [(rand(sid, 21) - 0.5) * 2 * H, (rand(sid, 22) - 0.5) * 2 * H, (rand(sid, 23) - 0.5) * 2 * H];
    const jit = pos === slots[0] ? 0.12 : 0.28;
    const p = clampToCube([pos[0] + (rand(sid, 1) - 0.5) * 2 * jit, pos[1] + (rand(sid, 2) - 0.5) * 2 * jit, pos[2] + (rand(sid, 3) - 0.5) * 2 * jit], H);
    taken.push(p); out.push(p);
  }
  return out;
}

/**
 * The metal's lattice for n atoms scaled to sit inside the cube: { sites:[{x,y,z}], u, H, coreRadius }.
 * u = display spacing per nearest-neighbour distance (capped), coreRadius = ion radius in the lattice.
 */
export function latticeLayout(structure, n) {
  const H = cubeHalf(n);
  const block = latticeBlock(structure, n);
  const half = Math.max(0.5, ...block.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))));
  const u = Math.min(U_MAX, (H - WALL_MARGIN) / half);
  return { sites: block.map((p) => ({ x: p.x * u, y: p.y * u, z: p.z * u })), u: Math.max(0.01, u), H, coreRadius: R_LATTICE_CORE * Math.max(1, u) };
}

/** Greedy nearest assignment of atoms to lattice sites (each site used once). Returns site index per atom. */
export function assignSites(atomPositions, sites) {
  const nA = atomPositions.length; const nS = sites.length;
  const d = new Float32Array(nA * nS);
  const order = new Uint32Array(nA * nS);
  for (let i = 0; i < nA; i += 1) for (let j = 0; j < nS; j += 1) {
    const a = atomPositions[i]; const s = sites[j];
    d[i * nS + j] = Math.hypot(a[0] - s.x, a[1] - s.y, a[2] - s.z); order[i * nS + j] = i * nS + j;
  }
  order.sort((p, q) => d[p] - d[q]);
  const out = new Array(nA).fill(-1);
  const used = new Uint8Array(nS);
  let left = nA;
  for (let t = 0; t < order.length && left > 0; t += 1) {
    const i = Math.floor(order[t] / nS); const j = order[t] % nS;
    if (out[i] !== -1 || used[j]) continue;
    out[i] = j; used[j] = 1; left -= 1;
  }
  return out;
}

/** Preallocated buffers + fixed per-electron motion parameters. Create once per workspace. */
export function createEngine() {
  const E = MAX_ELECTRONS;
  const eng = {
    n: 0, nElec: 0, coreRadius: R_ATOM, mix: 0,
    corePos: new Float32Array(MAX_METAL_ATOMS * 3),
    elecPos: new Float32Array(E * 3),
    orbW: new Float32Array(E), orbPh: new Float32Array(E), orbTh: new Float32Array(E),
    seaW: new Float32Array(E * 3), seaPh: new Float32Array(E * 3), seaAmp: new Float32Array(E * 3),
  };
  for (let e = 0; e < E; e += 1) {
    eng.orbW[e] = 1.4 + rand(e, 11) * 0.8; eng.orbPh[e] = rand(e, 12) * 6.283; eng.orbTh[e] = rand(e, 13) * 3.14159;
    for (let a = 0; a < 3; a += 1) {
      eng.seaW[e * 3 + a] = 0.35 + 0.55 * rand(e, 1 + a); eng.seaPh[e * 3 + a] = rand(e, 4 + a) * 6.283; eng.seaAmp[e * 3 + a] = 0.55 + 0.45 * rand(e, 7 + a);
    }
  }
  return eng;
}

/**
 * Fills eng.corePos / eng.elecPos for one frame. No allocation.
 * in: { atomPos: Float32Array|number[] (3n), sitePos: array (3n, target site of each atom) | null, n, v, stage, p, time, H, u }
 * stage: "place" | "releasing" | "released" | "forming" | "lattice"; p = progress of the current stage.
 */
export function stepEngine(eng, inp) {
  const { atomPos, sitePos, n, v, stage, p, time, H, u } = inp;
  const rel = stage === "place" ? 0 : stage === "releasing" ? easeInOut(p) : 1;
  const form = stage === "forming" ? p : stage === "lattice" ? 1 : 0;
  const f = easeInOut(form / 0.7);
  const useSites = form > 0 && sitePos;
  eng.n = n; eng.mix = rel;
  eng.coreRadius = lerp(R_ATOM, lerp(R_CORE, R_LATTICE_CORE * Math.max(1, u), f), rel);
  const cp = eng.corePos;
  for (let i = 0; i < n * 3; i += 1) cp[i] = useSites ? lerp(atomPos[i], sitePos[i], f) : atomPos[i];
  const nE = Math.min(n * v, MAX_ELECTRONS);
  eng.nElec = nE;
  const lim = H - R_ELECTRON - 0.02;
  const m = stage === "place" ? 0 : stage === "releasing" ? rel : 1;
  const ep = eng.elecPos;
  for (let e = 0; e < nE; e += 1) {
    const home = ((e / v) | 0) * 3;
    const a = time * eng.orbW[e] + eng.orbPh[e]; const th = eng.orbTh[e];
    const sa = Math.sin(a);
    const ox = cp[home] + ORBIT_R * Math.cos(a);
    const oy = cp[home + 1] + ORBIT_R * sa * Math.cos(th);
    const oz = cp[home + 2] + ORBIT_R * sa * Math.sin(th);
    const k = e * 3;
    const sx = lim * eng.seaAmp[k] * Math.sin(eng.seaW[k] * time + eng.seaPh[k]);
    const sy = lim * eng.seaAmp[k + 1] * Math.sin(eng.seaW[k + 1] * time + eng.seaPh[k + 1]);
    const sz = lim * eng.seaAmp[k + 2] * Math.sin(eng.seaW[k + 2] * time + eng.seaPh[k + 2]);
    ep[k] = Math.max(-lim, Math.min(lim, ox + (sx - ox) * m));
    ep[k + 1] = Math.max(-lim, Math.min(lim, oy + (sy - oy) * m));
    ep[k + 2] = Math.max(-lim, Math.min(lim, oz + (sz - oz) * m));
  }
  return eng;
}

