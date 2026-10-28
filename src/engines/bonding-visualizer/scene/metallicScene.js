// Metallic scene: pure positions for the 3D workspace (units: nearest-neighbour distance of the lattice = 1).
// The electron sea is a SIMPLIFIED, illustrative model: each delocalised electron follows a smooth looping path
// through the whole structure. It is not a classical trajectory and not to scale.
import { clamp01, easeInOut, lerp } from "./atomGeometry.js";

export const R_ATOM = 0.32;
export const R_CORE = 0.22;
export const R_ELECTRON = 0.075;
const ORBIT_R = 0.56;

const rand = (n, salt) => { const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Greedy nearest assignment of atoms to lattice sites (each site used once). Returns site index per atom. */
export function assignSites(atomPositions, sites) {
  const pairs = [];
  atomPositions.forEach((a, i) => sites.forEach((s, j) => pairs.push({ i, j, d: Math.hypot(a[0] - s.x, a[1] - s.y, a[2] - s.z) })));
  pairs.sort((p, q) => p.d - q.d);
  const out = new Array(atomPositions.length).fill(-1);
  const used = new Set();
  for (const pr of pairs) { if (out[pr.i] !== -1 || used.has(pr.j)) continue; out[pr.i] = pr.j; used.add(pr.j); }
  return out;
}

function boxOf(points, pad, minHalf) {
  if (!points.length) return { c: [0, 0, 0], h: [minHalf, minHalf, minHalf] };
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let a = 0; a < 3; a += 1) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); }
  return { c: lo.map((l, a) => (l + hi[a]) / 2), h: lo.map((l, a) => Math.max(minHalf, (hi[a] - l) / 2 + pad)) };
}

export function seaPosition(e, t, box) {
  const w = [0.35 + 0.55 * rand(e, 1), 0.35 + 0.55 * rand(e, 2), 0.35 + 0.55 * rand(e, 3)];
  const ph = [rand(e, 4) * 6.283, rand(e, 5) * 6.283, rand(e, 6) * 6.283];
  const amp = [0.55 + 0.45 * rand(e, 7), 0.55 + 0.45 * rand(e, 8), 0.55 + 0.45 * rand(e, 9)];
  return [0, 1, 2].map((a) => box.c[a] + box.h[a] * amp[a] * Math.sin(w[a] * t + ph[a]));
}

function orbitPosition(e, t, c) {
  const a = t * (1.4 + rand(e, 11) * 0.8) + rand(e, 12) * 6.283;
  const th = rand(e, 13) * 3.14159;
  return [c[0] + ORBIT_R * Math.cos(a), c[1] + ORBIT_R * Math.sin(a) * Math.cos(th), c[2] + ORBIT_R * Math.sin(a) * Math.sin(th)];
}

/**
 * atoms: [[x,y,z]...]; sites: [{x,y,z}] (lattice target sites, growth ordered); assign: site index per atom;
 * stage: "place" | "releasing" | "released" | "forming" | "lattice"; p: progress of the current stage; v: electrons per atom.
 */
export function metallicScene({ atoms, sites, assign, stage, p = 0, time = 0, v = 1 }) {
  const nA = atoms.length;
  const released = stage === "released" || stage === "forming" || stage === "lattice";
  const rel = stage === "place" ? 0 : stage === "releasing" ? easeInOut(p) : 1;
  const form = stage === "forming" ? p : stage === "lattice" ? 1 : 0;
  const f = easeInOut(form / 0.7);

  const cores = [];
  const atomNow = atoms.map((a, i) => {
    if (form > 0 && assign && assign[i] >= 0) {
      const s = sites[assign[i]];
      return [lerp(a[0], s.x, f), lerp(a[1], s.y, f), lerp(a[2], s.z, f)];
    }
    return a;
  });
  atomNow.forEach((pos) => cores.push({ pos, radius: lerp(R_ATOM, R_CORE, rel), mix: rel, alpha: 1 }));

  const extraSites = [];
  if (form > 0 && assign) {
    const taken = new Set(assign);
    sites.forEach((s, j) => { if (!taken.has(j)) extraSites.push(s); });
    extraSites.forEach((s, k) => {
      const start = 0.45 + 0.5 * (k / Math.max(1, extraSites.length));
      const u = clamp01((form - start) / 0.18);
      cores.push({ pos: [s.x, s.y, s.z], radius: R_CORE * easeInOut(u), mix: 1, alpha: easeInOut(u) });
    });
  }

  const box0 = boxOf(atomNow, 0.8, 1.1);
  const boxL = boxOf(sites.map((s) => [s.x, s.y, s.z]), 0.4, 1);
  const box = form > 0 ? { c: box0.c.map((c, a) => lerp(c, boxL.c[a], easeInOut(form))), h: box0.h.map((h, a) => lerp(h, boxL.h[a], easeInOut(form))) } : box0;

  const electrons = [];
  const total = (nA + extraSites.length) * v;
  for (let e = 0; e < total; e += 1) {
    const home = Math.floor(e / v);
    const core = cores[home];
    if (!core) break;
    const orbit = orbitPosition(e, time, core.pos);
    const sea = seaPosition(e, time, box);
    const m = released ? (home < nA ? 1 : 1) : rel;
    const pos = [0, 1, 2].map((a) => lerp(orbit[a], sea[a], m));
    electrons.push({ pos, alpha: home < nA ? 1 : core.alpha, delocalised: m > 0.999 });
  }
  return { cores, electrons, box, siteCount: sites.length, extraCount: extraSites.length };
}
