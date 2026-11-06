// PURE kinetic-particle model for the container (no React, no DOM).
//
// The ARRANGEMENT of every particle is a function of the curve state only
// (meltFrac, boilFrac) -- so scrubbing the progress slider backwards or
// forwards always shows exactly the right arrangement. The THERMAL MOTION is
// a function of the temperature and of two running clocks that the renderer
// advances each frame:
//   clock.tw  : plain time (vibration / liquid jiggling phase)
//   clock.tau : "motion time", advanced by dt * sqrt(T / T0), so a gas
//               particle's speed is proportional to sqrt(T) (mean kinetic
//               energy proportional to T), and it is CONSTANT on a plateau.
// Particle SIZE never changes: the radius depends only on the container size.
import { ABSOLUTE_ZERO_OFFSET } from "../data/substance.js";

export const PARTICLE_COUNT = 80;
const COLS = 10;
const ROWS = PARTICLE_COUNT / COLS; // 8
export const T_REF_K = ABSOLUTE_ZERO_OFFSET; // 273.15 K reference for amplitudes/speeds
const BLEND = 0.18; // width of the per-particle transition window (fraction of the plateau)

/** Small deterministic PRNG so every browser/test gets the same particle set. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledThresholds(n, rand) {
  const v = Array.from({ length: n }, (_, i) => i / n); // evenly spread over [0, 1)
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
}

/** The fixed per-particle random attributes (independent of container size and of the state). */
export function createParticleSet(n = PARTICLE_COUNT, seed = 20240611) {
  const rand = mulberry32(seed);
  // Melting starts at the top surface of the lattice and works downwards (noise keeps it organic), so the
  // unmelted block stays connected to the floor; on cooling the order reverses and the crystal grows from
  // the bottom up. Thresholds are evenly spread over [0, 1) so melting is a steady trickle.
  const keys = Array.from({ length: n }, (_, i) => ({ i, k: Math.floor(i / COLS) + rand() * 1.4 }));
  keys.sort((a, b) => a.k - b.k);
  const meltThr = new Array(n);
  keys.forEach((o, rank) => { meltThr[o.i] = rank / n; });
  const boilThr = shuffledThresholds(n, rand);
  const set = { n, meltThr, boilThr, phi: [], omega: [], wAng: [], wFreq: [], gx: [], gy: [], gAng: [], gSpeed: [], jx: [], jy: [] };
  for (let i = 0; i < n; i += 1) {
    set.phi.push([rand() * 6.2832, rand() * 6.2832]);
    set.omega.push(5 + rand() * 3);
    set.wAng.push(rand() * 6.2832);
    set.wFreq.push(1.2 + rand() * 1.4);
    set.gx.push(rand());
    set.gy.push(rand());
    set.gAng.push(rand() * 6.2832);
    set.gSpeed.push(0.6 + rand() * 0.8); // spread of speeds about the mean, fixed per particle
    set.jx.push(rand() - 0.5);
    set.jy.push(rand() - 0.5);
  }
  return set;
}

/** Geometry for a container of w x h pixels. Particle radius r is a constant of the container size alone. */
export function layoutFor(w, h, set) {
  const n = set.n;
  const r = Math.max(2, Math.min(w * 0.024, h * 0.036));
  const pad = r * 1.2;
  const box = { x0: pad, y0: pad, x1: Math.max(pad + 1, w - pad), y1: Math.max(pad + 1, h - pad) };
  // Solid: a regular lattice resting on the floor, centred.
  const sp = r * 2.4;
  const solidHome = [];
  const lw = (COLS - 1) * sp;
  const x0 = (box.x0 + box.x1) / 2 - lw / 2;
  const yb = box.y1 - r;
  for (let i = 0; i < n; i += 1) {
    const c = i % COLS;
    const rw = Math.floor(i / COLS);
    solidHome.push([x0 + c * sp, yb - (ROWS - 1 - rw) * sp]);
  }
  // Liquid: a close-packed but irregular pool across the container floor.
  const ls = r * 2.3;
  const lcols = Math.max(4, Math.min(16, Math.floor((box.x1 - box.x0) / ls)));
  const lrows = Math.ceil(n / lcols);
  const slots = [];
  const rand = mulberry32(99);
  const lwid = (lcols - 1) * ls;
  const lx0 = (box.x0 + box.x1) / 2 - lwid / 2;
  for (let i = 0; i < n; i += 1) {
    const c = i % lcols;
    const rw = Math.floor(i / lcols);
    const off = rw % 2 ? ls * 0.5 : 0;
    const jx = (rand() - 0.5) * ls * 0.2;
    const jy = (rand() - 0.5) * ls * 0.2;
    slots.push([Math.min(box.x1 - r, lx0 + c * ls + off - (lcols > 1 ? ls * 0.25 : 0) + jx), box.y1 - r - (lrows - 1 - rw) * ls * 0.92 + jy]);
  }
  // The pool fills from the outside in: the particle that melts first takes the slot farthest from the
  // remaining lattice block, the last one the slot nearest to it, so melted and unmelted particles do not pile up.
  const cx = (box.x0 + box.x1) / 2;
  const cy = box.y1 - (ROWS * sp) / 2;
  const bySlotDistance = slots.map((s, k) => ({ k, d: Math.hypot(s[0] - cx, (s[1] - cy) * 0.6) })).sort((a, b) => b.d - a.d);
  const byMelt = Array.from({ length: n }, (_, i) => i).sort((a, b) => set.meltThr[a] - set.meltThr[b]);
  const liquidHome = new Array(n);
  byMelt.forEach((particle, rank) => { liquidHome[particle] = slots[bySlotDistance[rank].k]; });
  return { w, h, r, box, solidHome, liquidHome, n };
}

const smooth = (x) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
/** Per-particle progress through a transition whose overall fraction is f (0 -> all 0, 1 -> all 1). */
export function particleProgress(threshold, f) {
  return smooth((f * (1 + BLEND) - threshold) / BLEND);
}
function fold(u, L) { // reflect position u into [0, L] (billiard path)
  const m = ((u % (2 * L)) + 2 * L) % (2 * L);
  return m <= L ? m : 2 * L - m;
}

/** Initial clock. */
export const newClock = () => ({ tw: 0, tau: 0 });

/** Advance the clocks by dt (clamped by the caller) at temperature tempK. */
export function advanceClock(clock, dt, tempK) {
  clock.tw += dt;
  clock.tau += dt * Math.sqrt(Math.max(tempK, 1) / T_REF_K);
}

/**
 * Positions of all particles.
 *   state : { meltFrac, boilFrac, tempK } from curveState()
 * Returns { x[], y[], phase[], r, counts: {solid, liquid, gas}, amplitude, speed }.
 */
export function particleSnapshot(set, lay, state, clock) {
  const { n } = set;
  const { r, box } = lay;
  const kT = Math.sqrt(Math.max(state.tempK, 1) / T_REF_K); // proportional to rms speed / amplitude at fixed frequency
  const ampSolid = 0.2 * r * kT;
  const ampLiquid = 0.55 * r * kT;
  const gasSpeed = 0.55 * (box.x1 - box.x0) * 0.5; // px per unit of motion time, mean particle
  const L = [box.x1 - box.x0, box.y1 - box.y0];
  const x = new Array(n);
  const y = new Array(n);
  const phase = new Array(n);
  const counts = { solid: 0, liquid: 0, gas: 0 };
  for (let i = 0; i < n; i += 1) {
    const sM = particleProgress(set.meltThr[i], state.meltFrac);
    const sB = particleProgress(set.boilThr[i], state.boilFrac);
    // solid: vibration about the lattice site
    const sx = lay.solidHome[i][0] + ampSolid * Math.sin(set.omega[i] * clock.tw + set.phi[i][0]);
    const sy = lay.solidHome[i][1] + ampSolid * Math.sin(set.omega[i] * 1.13 * clock.tw + set.phi[i][1]);
    // liquid: jiggling / sliding about a home position, larger excursions
    const lx = lay.liquidHome[i][0] + ampLiquid * Math.cos(set.wFreq[i] * clock.tw + set.wAng[i]) + 0.3 * ampLiquid * Math.sin(2.3 * set.wFreq[i] * clock.tw);
    const ly = lay.liquidHome[i][1] + ampLiquid * 0.8 * Math.sin(set.wFreq[i] * 1.21 * clock.tw + set.wAng[i]);
    // gas: free flight with elastic reflections off the walls, speed ~ sqrt(T)
    const v = gasSpeed * set.gSpeed[i];
    const gxp = box.x0 + r + fold(set.gx[i] * (L[0] - 2 * r) + Math.cos(set.gAng[i]) * v * clock.tau, L[0] - 2 * r);
    const gyp = box.y0 + r + fold(set.gy[i] * (L[1] - 2 * r) + Math.sin(set.gAng[i]) * v * clock.tau, L[1] - 2 * r);
    const ax = sx + (lx - sx) * sM;
    const ay = sy + (ly - sy) * sM;
    x[i] = ax + (gxp - ax) * sB;
    y[i] = ay + (gyp - ay) * sB;
    const ph = sB >= 0.5 ? "gas" : sM >= 0.5 ? "liquid" : "solid";
    phase[i] = ph;
    counts[ph] += 1;
  }
  return { x, y, phase, r, counts, amplitude: ampSolid, speed: gasSpeed * kT, kT };
}
