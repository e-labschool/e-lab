// Gas Laws Explorer -- 2D particle physics (pure JS, no DOM) so the
// conservation / confinement properties can be tested in Node.
// Equal masses (m = 1). Elastic particle-particle and wall/piston collisions;
// the moving piston reflects particles using its velocity; a final clamp each
// substep guarantees nothing escapes. Speeds follow sqrt(T) through a gentle
// thermostat that imposes the state's temperature smoothly. The pressure shown
// to the student is the formula value (PV = nRT), never a collision count.
import { CHAMBER, RANGES, particleCount, pistonHeight } from "./model.js";

export const RADIUS = 3; // display + collision radius (chamber units)
export const T_REF = 300;
// Each velocity component ~ N(0, sigma^2), sigma = SIGMA_REF * sqrt(T / T_REF).
export const SIGMA_REF = 34;
export const PHYSICS_DT = 1 / 240;

const DT = PHYSICS_DT;
const MAX_SUBSTEPS_PER_ADVANCE = 16;
const THERMOSTAT_TAU = 0.5; // s
const PISTON_RATE = 4.5; // 1/s exponential approach
const PISTON_MAX_SPEED = 70; // units/s
const FADE_TIME = 0.5; // s
const COUNT_RATE = 14; // particles/s added or removed (visible, not jumpy)
const MAX_EVENTS = 60;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export function sigmaForT(T) { return SIGMA_REF * Math.sqrt(T / T_REF); }

export function makeRng(seed = 12345) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Elastic reflection of a velocity component off a wall moving at vWall. */
export function reflectWall1D(v, vWall = 0) { return 2 * vWall - v; }

/** Elastic collision of two EQUAL-mass particles (velocity update only):
 * exchanges the normal components, conserving momentum and kinetic energy. */
export function collidePair(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-12) return false;
  dx /= d;
  dy /= d;
  const vrel = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
  if (vrel <= 0) return false;
  a.vx -= vrel * dx;
  a.vy -= vrel * dy;
  b.vx += vrel * dx;
  b.vy += vrel * dy;
  return true;
}

/** Keep a particle inside the chamber and under the (possibly moving) piston. */
export function confine(p, r, h, vPiston) {
  let hit = false;
  const W = CHAMBER.width;
  if (p.x < r) { p.x = r; if (p.vx < 0) { p.vx = -p.vx; hit = true; } }
  else if (p.x > W - r) { p.x = W - r; if (p.vx > 0) { p.vx = -p.vx; hit = true; } }
  if (p.y < r) { p.y = r; if (p.vy < 0) { p.vy = -p.vy; hit = true; } }
  const top = h - r;
  if (p.y > top) {
    p.y = top;
    if (p.vy - vPiston > 0) { p.vy = reflectWall1D(p.vy, vPiston); hit = true; }
  }
  return hit;
}

export function createSimulation({ seed = 12345 } = {}) {
  const rng = makeRng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const sim = {
    target: { V: 20, T: 300, n: 1 },
    display: { trails: true, collisions: false },
    particles: [],
    paused: false,
    instant: false, // reduced motion: piston / fades snap
    time: 0,
    pistonH: pistonHeight(20),
    pistonV: 0,
    radius: RADIUS,
    events: [],
    _acc: 0, _countAcc: 0, _nextId: 1,
  };
  const active = () => sim.particles.filter((p) => p.fade >= 0);

  function spawn(alpha) {
    const r = sim.radius;
    const h = sim.pistonH;
    const minD = 2 * r * 1.15;
    let best = null;
    let bestScore = -1;
    for (let k = 0; k < 60; k++) {
      const x = r + rng() * (CHAMBER.width - 2 * r);
      const y = r + rng() * Math.max(0, h - 2 * r);
      let md = Infinity;
      for (const q of sim.particles) { const d = Math.hypot(q.x - x, q.y - y); if (d < md) md = d; }
      if (md >= minD) { best = { x, y }; break; }
      if (md > bestScore) { bestScore = md; best = { x, y }; }
    }
    const s = sigmaForT(sim.target.T);
    sim.particles.push({ id: sim._nextId++, x: best.x, y: best.y, vx: s * gauss(), vy: s * gauss(), alpha, fade: alpha >= 1 ? 0 : 1 });
  }

  function syncCount(instantly) {
    const target = particleCount(sim.target.n);
    let act = active();
    if (instantly) {
      sim.particles = sim.particles.filter((p) => p.fade >= 0);
      for (const p of sim.particles) { p.alpha = 1; p.fade = 0; }
      while (sim.particles.length > target) sim.particles.pop();
      while (sim.particles.length < target) spawn(1);
      return;
    }
    let budget = Math.floor(sim._countAcc);
    if (budget > 0) sim._countAcc -= budget;
    while (budget > 0 && act.length < target) { spawn(sim.instant ? 1 : 0); act = active(); budget--; }
    while (budget > 0 && act.length > target) {
      const p = act.pop();
      if (sim.instant) sim.particles.splice(sim.particles.indexOf(p), 1);
      else p.fade = -1;
      budget--;
    }
    if (act.length === target) sim._countAcc = 0;
  }

  function kineticTemperature() {
    const act = active();
    if (!act.length) return null;
    let s = 0;
    for (const p of act) s += p.vx * p.vx + p.vy * p.vy;
    return (T_REF * (s / act.length)) / (2 * SIGMA_REF * SIGMA_REF);
  }
  function scaleVelocities(l) { for (const p of sim.particles) { p.vx *= l; p.vy *= l; } }
  function thermostat(dt) {
    const Tk = kineticTemperature();
    if (!Tk) return;
    const l2 = 1 + (dt / THERMOSTAT_TAU) * (sim.target.T / Tk - 1);
    scaleVelocities(clamp(Math.sqrt(Math.max(l2, 0)), 0.9, 1.1));
  }
  function pushEvent(x, y, kind) {
    if (!sim.display.collisions || sim.instant) return;
    sim.events.push({ x, y, kind, t: sim.time });
    if (sim.events.length > MAX_EVENTS) sim.events.shift();
  }

  function substep() {
    const dt = DT;
    const targetH = pistonHeight(sim.target.V);
    const prevH = sim.pistonH;
    if (sim.instant) sim.pistonH = targetH;
    else {
      const diff = targetH - prevH;
      const v = clamp(diff * PISTON_RATE, -PISTON_MAX_SPEED, PISTON_MAX_SPEED);
      sim.pistonH = Math.abs(diff) < 1e-4 ? targetH : prevH + v * dt;
    }
    sim.pistonV = (sim.pistonH - prevH) / dt;
    const r = sim.radius;
    const ps = sim.particles;
    thermostat(dt);
    for (const p of ps) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.fade > 0) { p.alpha = Math.min(1, p.alpha + dt / FADE_TIME); if (p.alpha >= 1) p.fade = 0; }
      else if (p.fade < 0) p.alpha -= dt / FADE_TIME;
    }
    for (const p of ps) if (confine(p, r, sim.pistonH, sim.pistonV)) pushEvent(p.x, p.y, "wall");
    const D = 2 * r;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.fade < 0) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.fade < 0) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= D * D) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-9) { const ang = rng() * 2 * Math.PI; dx = Math.cos(ang); dy = Math.sin(ang); d = 1e-9; }
        const nx = dx / d;
        const ny = dy / d;
        const push = (D - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        if (collidePair(a, b)) pushEvent((a.x + b.x) / 2, (a.y + b.y) / 2, "pair");
      }
    }
    for (const p of ps) confine(p, r, sim.pistonH, sim.pistonV); // hard guarantee after pair pushes
    sim.particles = ps.filter((p) => p.fade >= 0 || p.alpha > 0);
    sim.time += dt;
  }

  sim.advance = function advance(dt) {
    if (sim.paused) return;
    const d = Math.min(Math.max(dt, 0), 0.1);
    sim._acc += d;
    sim._countAcc += d * COUNT_RATE;
    syncCount(false);
    let n = 0;
    while (sim._acc >= DT && n < MAX_SUBSTEPS_PER_ADVANCE) { substep(); sim._acc -= DT; n++; }
    if (n === MAX_SUBSTEPS_PER_ADVANCE) sim._acc = 0;
  };

  function syncInstant() {
    sim.pistonH = pistonHeight(sim.target.V);
    sim.pistonV = 0;
    syncCount(true);
    const Tk = kineticTemperature();
    if (Tk) scaleVelocities(Math.sqrt(sim.target.T / Tk));
    for (const p of sim.particles) confine(p, sim.radius, sim.pistonH, 0);
  }

  /** Point the animation at a model state ({V, T, n}). */
  sim.setTarget = function setTarget(s) {
    sim.target = {
      V: clamp(s.V, RANGES.V.min, RANGES.V.max),
      T: clamp(s.T, RANGES.T.min, RANGES.T.max),
      n: clamp(s.n, 0, RANGES.n.max),
    };
    if (sim.paused) syncInstant();
  };
  sim.setDisplay = (d) => { sim.display = { ...sim.display, ...d }; if (!sim.display.collisions) sim.events.length = 0; };
  sim.setPaused = (p) => { sim.paused = !!p; };
  sim.setInstant = (v) => { sim.instant = !!v; };

  sim.reset = function reset(s) {
    if (s) sim.target = { V: s.V, T: s.T, n: s.n };
    sim.particles = [];
    sim.events.length = 0;
    sim.time = 0;
    sim._acc = 0;
    sim._countAcc = 0;
    sim.pistonH = pistonHeight(sim.target.V);
    sim.pistonV = 0;
    syncCount(true);
    const Tk = kineticTemperature();
    if (Tk) scaleVelocities(Math.sqrt(sim.target.T / Tk));
    for (const p of sim.particles) confine(p, sim.radius, sim.pistonH, 0);
  };

  sim.getStats = function getStats() {
    const act = active();
    let sp = 0, ke = 0, px = 0, py = 0, v2s = 0;
    for (const p of act) {
      const v2 = p.vx * p.vx + p.vy * p.vy;
      sp += Math.sqrt(v2); ke += 0.5 * v2; px += p.vx; py += p.vy; v2s += v2;
    }
    const n = act.length || 1;
    return { count: act.length, meanSpeed: sp / n, rmsSpeed: Math.sqrt(v2s / n), totalKE: ke, px, py, kineticTemperature: kineticTemperature() };
  };

  sim.settle = function settle(seconds) {
    const steps = Math.ceil(seconds / DT);
    for (let i = 0; i < steps; i++) {
      if (sim.paused) return;
      sim._countAcc += DT * COUNT_RATE;
      syncCount(false);
      substep();
    }
  };

  sim.reset();
  return sim;
}
