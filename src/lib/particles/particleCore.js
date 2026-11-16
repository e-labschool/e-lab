// ONE shared particle model for the States-of-matter simulations (Particle Model Visualizer and Explore Matter & States).
// Pure JS (no React / DOM / WebGL) so it is unit-tested in Node (scripts/test-particle-core.mjs).
//
//  * N identical hard spheres (diameter 1, mass 1) in a box. N NEVER changes when the state changes: "same particles, different
//    arrangement" (GS-31). The state only changes which forces act:
//      solid   springs to close-packed lattice sites sitting on the floor (spacing 1.04 d), tiny vibration
//      liquid  gravity + a short-range cohesion: touching, irregular, pooled on the floor, sliding past each other
//      gas     no forces: free flight, elastic collisions with the walls AND with each other
//  * Temperature T (K) sets the target mean kinetic energy per particle (3/2 kT in 3D, kT in 2D) by a gentle thermostat, in EVERY
//    state: mean KE is proportional to T whatever the state (IB S1.1.3, "temperature measures average kinetic energy"). The
//    speed distribution is the Maxwell-Boltzmann one because velocity components start (and are re-seeded) Gaussian.
//  * dim = 2 uses x and y only (Explore Matter's flat pictures); dim = 3 uses x, y, z (the 3D chamber).
//  * Units are model units, not nm: diameter = 1. The "water-like" melting / boiling points used by autoState() are illustrative.

export const DIAMETER = 1;
export const SIGMA_REF = 1.5; // velocity component standard deviation (model units / s) at T_REF
export const T_REF = 300;
export const MODEL_TM = 273; // illustrative melting point (K)
export const MODEL_TB = 373; // illustrative boiling point (K)
export const T_MIN = 100;
export const T_MAX = 500;
export const STATES = Object.freeze(["solid", "liquid", "gas"]);

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Velocity-component standard deviation for temperature T: sigma = SIGMA_REF * sqrt(T / T_REF). */
export const sigmaFor = (T) => SIGMA_REF * Math.sqrt(Math.max(0, T) / T_REF);
/** The state a water-like substance would be in at T (used by the "let temperature decide" option). */
export const autoState = (T) => (T < MODEL_TM ? "solid" : T < MODEL_TB ? "liquid" : "gas");

/** Close-packed lattice sites (hexagonal rows; 3D: ABAB layers = hcp), centred on x/z, resting on y = radius. Returns exactly n sites. */
export function latticeSites(n, dim, spacing = 1.04) {
  const dx = spacing; const dy = spacing * Math.sqrt(3) / 2; // 2D row spacing
  const pts = [];
  if (dim === 2) {
    const perRow = Math.max(2, Math.ceil(Math.sqrt(n * 1.4)));
    for (let k = 0; pts.length < n; k++) {
      const row = Math.floor(k / perRow); const col = k % perRow;
      pts.push([col * dx + (row % 2) * dx / 2, row * dy, 0]);
    }
  } else {
    const side = Math.max(2, Math.ceil(Math.cbrt(n / 0.9)));
    const dz = spacing * Math.sqrt(3) / 2; const dyl = spacing * Math.sqrt(2 / 3);
    for (let layer = 0; pts.length < n; layer++) {
      for (let j = 0; j < side && pts.length < n; j++) for (let i = 0; i < side && pts.length < n; i++) {
        pts.push([i * dx + (j % 2) * dx / 2 + (layer % 2) * dx / 2, layer * dyl, j * dz + (layer % 2) * dz / 3]);
      }
    }
  }
  const minx = Math.min(...pts.map((p) => p[0])); const maxx = Math.max(...pts.map((p) => p[0]));
  const minz = Math.min(...pts.map((p) => p[2])); const maxz = Math.max(...pts.map((p) => p[2]));
  return pts.map(([x, y, z]) => [x - (minx + maxx) / 2, y, z - (minz + maxz) / 2]);
}

const DEFAULT_BOX = { 2: { w: 22, h: 14, d: 0 }, 3: { w: 14, h: 10, d: 10 } };
/** Sensible particle counts: a gas picture needs space (about 20 % area / 4 % volume fraction). */
export const DEFAULT_N = { 2: 64, 3: 96 };

export function createParticleSystem({ n: nIn, dim = 3, seed = 1, box, state = "gas", T = T_REF } = {}) {
  const n = nIn ?? DEFAULT_N[dim];
  const rng = makeRng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const B = { ...(box ?? DEFAULT_BOX[dim]) };
  const R = DIAMETER / 2;
  const sites = latticeSites(n, dim);
  const sys = {
    n, dim, box: B, state, T, time: 0, particles: [], pairCollisions: 0, wallHits: 0,
    blend: { spring: state === "solid" ? 1 : 0, gravity: state === "gas" ? 0 : 1, cohesion: state === "liquid" ? 1 : 0 },
    anchors: [],
  };

  const maxX = () => B.w - R; const maxZ = () => (dim === 3 ? B.d - R : 0);
  function blockAnchors() {
    // centred lattice block resting on the floor
    return sites.map(([x, y, z]) => ({ x: B.w / 2 + x, y: R + y, z: dim === 3 ? B.d / 2 + z : 0 }));
  }
  sys.anchors = blockAnchors();

  function place(mode) {
    const a = sys.anchors;
    sys.particles = [];
    for (let i = 0; i < n; i++) {
      let x; let y; let z;
      if (mode === "solid") { x = a[i].x; y = a[i].y; z = a[i].z; }
      else if (mode === "liquid") { // loose pool: hexagonal block with wider spacing, spread to the floor width
        const s = 1.16; const q = latticeSites(n, dim, s)[i];
        x = B.w / 2 + q[0]; y = R + q[1]; z = dim === 3 ? B.d / 2 + q[2] : 0;
      } else { x = R + rng() * (B.w - 2 * R); y = R + rng() * (B.h - 2 * R); z = dim === 3 ? R + rng() * (B.d - 2 * R) : 0; }
      const s = sigmaFor(sys.T);
      sys.particles.push({ x, y, z, vx: s * gauss(), vy: s * gauss(), vz: dim === 3 ? s * gauss() : 0, id: i });
    }
    // gas: resolve initial overlaps by a few relaxation passes
    if (mode === "gas") for (let pass = 0; pass < 40; pass++) resolveOverlaps(false);
    for (const p of sys.particles) clampToBox(p);
  }

  function clampToBox(p) {
    let hit = false;
    if (p.x < R) { p.x = R; if (p.vx < 0) { p.vx = -p.vx; hit = true; } } else if (p.x > maxX()) { p.x = maxX(); if (p.vx > 0) { p.vx = -p.vx; hit = true; } }
    if (p.y < R) { p.y = R; if (p.vy < 0) { p.vy = -p.vy; hit = true; } } else if (p.y > B.h - R) { p.y = B.h - R; if (p.vy > 0) { p.vy = -p.vy; hit = true; } }
    if (dim === 3) { if (p.z < R) { p.z = R; if (p.vz < 0) { p.vz = -p.vz; hit = true; } } else if (p.z > maxZ()) { p.z = maxZ(); if (p.vz > 0) { p.vz = -p.vz; hit = true; } } }
    return hit;
  }

  function resolveOverlaps(exchange = true) {
    const ps = sys.particles; const D = DIAMETER;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]; const b = ps[j];
      let dx = b.x - a.x; let dy = b.y - a.y; let dz = dim === 3 ? b.z - a.z : 0;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= D * D) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-9) { dx = 1; dy = 0; dz = 0; d = 1e-9; }
      const nx = dx / d; const ny = dy / d; const nz = dz / d;
      const push = (D - d) / 2;
      a.x -= nx * push; a.y -= ny * push; a.z -= nz * push; b.x += nx * push; b.y += ny * push; b.z += nz * push;
      if (!exchange) continue;
      const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny + (a.vz - b.vz) * nz;
      if (vrel > 0) { // approaching: equal masses exchange the normal components (elastic)
        a.vx -= vrel * nx; a.vy -= vrel * ny; a.vz -= vrel * nz; b.vx += vrel * nx; b.vy += vrel * ny; b.vz += vrel * nz;
        sys.pairCollisions += 1;
      }
    }
  }

  function targetBlend(dt) {
    const want = { spring: sys.state === "solid" ? 1 : 0, gravity: sys.state === "gas" ? 0 : 1, cohesion: sys.state === "liquid" ? 1 : 0 };
    const k = Math.min(1, dt * 3);
    for (const key of Object.keys(want)) sys.blend[key] += (want[key] - sys.blend[key]) * k;
  }

  const G = 9; const K_SPRING = 40; const COH = 3.2; const COH_RANGE = 1.7;
  function substep(dt) {
    targetBlend(dt);
    const ps = sys.particles;
    const { spring, gravity, cohesion } = sys.blend;
    // solid: nearest-free anchor assignment is fixed by id (stable); springs pull each particle to its own site
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (spring > 0.001) {
        const a = sys.anchors[i];
        p.vx += (a.x - p.x) * K_SPRING * spring * dt; p.vy += (a.y - p.y) * K_SPRING * spring * dt; if (dim === 3) p.vz += (a.z - p.z) * K_SPRING * spring * dt;
      }
      if (gravity > 0.001) p.vy -= G * gravity * dt;
    }
    if (cohesion > 0.001) {
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]; const b = ps[j];
        const dx = b.x - a.x; const dy = b.y - a.y; const dz = dim === 3 ? b.z - a.z : 0;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > COH_RANGE * COH_RANGE || d2 < 1e-9) continue;
        const d = Math.sqrt(d2); const f = (COH * cohesion * (COH_RANGE - d)) / (COH_RANGE - 1) * dt / d;
        a.vx += dx * f; a.vy += dy * f; a.vz += dz * f; b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
      }
    }
    // thermostat: drive mean KE (excluding the gravity drift) toward the target for T
    let ke = 0;
    for (const p of ps) ke += p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
    const dof = dim;
    const target = dof * sigmaFor(sys.T) ** 2 * ps.length;
    if (ke > 1e-9) {
      const lam2 = 1 + Math.min(1, dt * 3) * (target / ke - 1);
      const lam = Math.min(1.08, Math.max(0.92, Math.sqrt(Math.max(lam2, 0))));
      for (const p of ps) { p.vx *= lam; p.vy *= lam; p.vz *= lam; }
    }
    for (const p of ps) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += dim === 3 ? p.vz * dt : 0; }
    for (const p of ps) if (clampToBox(p)) sys.wallHits += 1;
    resolveOverlaps(true);
    for (const p of ps) clampToBox(p);
    sys.time += dt;
  }

  /** Advance by dt seconds (fixed 1/240 s substeps). */
  sys.step = (dt) => {
    let t = Math.min(0.1, Math.max(0, dt));
    const h = 1 / 240;
    while (t > 1e-9) { const s = Math.min(h, t); substep(s); t -= s; }
  };
  sys.setState = (s) => { if (STATES.includes(s)) sys.state = s; };
  sys.setTemperature = (T2) => { sys.T = Math.min(T_MAX, Math.max(T_MIN, Number(T2) || T_REF)); };
  /** Restore the arrangement of `mode` (fresh particles, same N). */
  sys.reset = (mode = sys.state) => { sys.state = mode; sys.blend = { spring: mode === "solid" ? 1 : 0, gravity: mode === "gas" ? 0 : 1, cohesion: mode === "liquid" ? 1 : 0 }; sys.time = 0; sys.pairCollisions = 0; sys.wallHits = 0; place(mode); };
  /** Mean kinetic energy per particle, its model temperature, speeds, and mean nearest-neighbour distance. */
  sys.getStats = () => {
    const ps = sys.particles; let ke = 0; let sp = 0;
    for (const p of ps) { const v2 = p.vx * p.vx + p.vy * p.vy + p.vz * p.vz; ke += 0.5 * v2; sp += Math.sqrt(v2); }
    const meanKE = ke / ps.length;
    let nn = 0;
    for (let i = 0; i < ps.length; i++) {
      let best = Infinity;
      for (let j = 0; j < ps.length; j++) if (i !== j) { const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y, dim === 3 ? ps[i].z - ps[j].z : 0); if (d < best) best = d; }
      nn += best;
    }
    // KE per particle = (dim/2) sigma^2 -> temperature estimate T = T_REF * (2 KE / dim) / SIGMA_REF^2
    return { n: ps.length, meanKE, meanSpeed: sp / ps.length, temperature: (T_REF * (2 * meanKE / dim)) / (SIGMA_REF * SIGMA_REF), meanNearestNeighbour: nn / ps.length, pairCollisions: sys.pairCollisions, wallHits: sys.wallHits, state: sys.state, T: sys.T };
  };
  sys.reset(state);
  return sys;
}
