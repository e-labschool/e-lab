// Ideal Gas Simulation -- pure model (no React, no DOM) so it can be tested
// in Node (scripts/test-ideal-gas-model.mjs). Rendering lives elsewhere.
//
// ---------------------------------------------------------------------------
// SCALING CONVENTION (S1.5.1-S1.5.3)
// ---------------------------------------------------------------------------
// The "Number of particles" slider N (5-100) is a VISUAL SAMPLE of the gas,
// not a literal molecule count. It is mapped linearly onto the amount of
// substance:
//
//     n = N * (N_REF_MOL / N_REF) ,   N_REF = 50
//
// where N_REF_MOL is calibrated so that the default state
// (N = 50, T = 300 K, V = 25 L) gives exactly P_ideal = 1.00 atm with
// R = 0.082057 L atm mol^-1 K^-1:
//
//     n_ref = P V / (R T) = 1.00 * 25 / (0.082057 * 300) ~= 1.0156 mol
//     => one drawn particle represents ~0.0203 mol.
//
// Pressure shown to the student is ALWAYS computed from the macroscopic
// formulas below (ideal: PV = nRT; real: van der Waals), never by counting
// collisions of the animated particles. The animation is a qualitative
// picture; the readout is the model.
//
// The drawn particle radius is a DISPLAY quantity. In ideal mode it does not
// enter the pressure formula (point-particle assumption); in real mode the
// larger collision radius is a visual cue for the excluded volume `b`, but
// the pressure is still the vdW formula, not an emergent MD pressure.
//
// ---------------------------------------------------------------------------
// VAN DER WAALS (illustrative, NOT a specific gas)
// ---------------------------------------------------------------------------
//     P = nRT / (V - n b) - a (n / V)^2
//
//   a = 15.0 L^2 atm mol^-2  (attraction)
//   b = 0.40 L mol^-1        (excluded volume)
//
// These are deliberately larger than values for small real molecules
// (a ~ 1-4, b ~ 0.03-0.05): roughly 4-15x on a and ~8-10x on b. Because the slider
// sample only reaches n ~ 2 mol in V >= 5 L, realistic constants would give
// deviations below ~3% almost everywhere and nothing to explore. With these values
// (Boyle-like crossover where the two effects cancel is near a/(R b) ~ 460 K):
//   - the default state deviates by ~0.8% (Low),
//   - 100 K with a compressed sample is strongly attraction-dominated
//     (pressure far below ideal, High, ~55% at the extreme),
//   - 800 K with a compressed sample is excluded-volume dominated
//     (pressure above ideal, ~10%, Moderate),
//   - V - n b stays >= 4.19 L (>= 83% of V) over the whole slider grid and
//     P stays positive and finite (defensive clamps are still applied).
//
// DEVIATION INDICATOR  d = |P_real - P_ideal| / P_ideal * 100 (%)
//     Low       d <  5
//     Moderate  5 <= d <= 15
//     High      d >  15
// ---------------------------------------------------------------------------

export const R_GAS = 0.082057; // L atm mol^-1 K^-1
export const VDW_A = 15.0; // L^2 atm mol^-2
export const VDW_B = 0.4; // L mol^-1

export const LIMITS = {
  N: { min: 5, max: 100, step: 1 },
  T: { min: 100, max: 800, step: 5 },
  V: { min: 5, max: 50, step: 1 },
};

export const DEFAULT_CONTROLS = Object.freeze({ mode: "ideal", N: 50, T: 300, V: 25 });
export const DEFAULT_DISPLAY = Object.freeze({ trails: true, collisions: false, forces: false });

export const N_REF = 50;
export const N_REF_MOL = (1.0 * 25) / (R_GAS * 300); // ~1.0156 mol for N_REF particles
export const MOL_PER_PARTICLE = N_REF_MOL / N_REF;

export const DEVIATION_LOW_MAX = 5;
export const DEVIATION_MODERATE_MAX = 15;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function clampControls(c) {
  return {
    mode: c.mode === "real" ? "real" : "ideal",
    N: Math.round(clamp(Number(c.N), LIMITS.N.min, LIMITS.N.max)),
    T: clamp(Number(c.T), LIMITS.T.min, LIMITS.T.max),
    V: clamp(Number(c.V), LIMITS.V.min, LIMITS.V.max),
  };
}

export function amountOfSubstance(N) {
  return N * MOL_PER_PARTICLE;
}

/** Ideal-gas pressure in atm. n in mol, T in K, V in L. */
export function idealPressure(n, T, V) {
  return (n * R_GAS * T) / V;
}

/** van der Waals pressure in atm, defensively clamped (see header). */
export function vdwPressure(n, T, V) {
  const freeV = Math.max(V - n * VDW_B, 0.25 * V); // never reached on the slider grid
  const p = (n * R_GAS * T) / freeV - VDW_A * (n / V) * (n / V);
  return Number.isFinite(p) ? Math.max(0, p) : 0;
}

export function deviationPercent(pIdeal, pReal) {
  if (!(pIdeal > 0)) return 0;
  return (Math.abs(pReal - pIdeal) / pIdeal) * 100;
}

export function deviationLevel(pct) {
  if (pct < DEVIATION_LOW_MAX) return "Low";
  if (pct <= DEVIATION_MODERATE_MAX) return "Moderate";
  return "High";
}

/** Everything the Live Values panel needs for a set of controls. */
export function computeReadings(controls) {
  const c = clampControls(controls);
  const n = amountOfSubstance(c.N);
  const pIdeal = idealPressure(n, c.T, c.V);
  const pReal = vdwPressure(n, c.T, c.V);
  const pct = deviationPercent(pIdeal, pReal);
  return {
    n,
    pressure: c.mode === "real" ? pReal : pIdeal,
    pIdeal,
    pReal,
    deviationPct: pct,
    deviationLevel: deviationLevel(pct),
    ...c,
  };
}

// ---------------------------------------------------------------------------
// Particle dynamics (2D, equal masses m = 1, chamber units)
// ---------------------------------------------------------------------------
export const CHAMBER = { width: 170, maxHeight: 190 }; // units; height = maxHeight * V / V_max
export const R_IDEAL = 1.9; // display/collision radius, ideal (no effect on ideal pressure)
export const R_REAL = 2.4; // collision radius in real mode (excluded-volume cue)
export const T_REF = 300;
// Rayleigh scale: each velocity component ~ N(0, sigma^2), sigma = SIGMA_REF * sqrt(T / T_REF)
// so <v^2> = 2 sigma^2 and v_rms (and mean speed) scale with sqrt(T).
export const SIGMA_REF = 30;

const DT = 1 / 240; // fixed physics substep (s)
const MAX_SUBSTEPS_PER_ADVANCE = 16;
const THERMOSTAT_TAU = 0.6; // s; imposes the chosen temperature smoothly (isothermal experiment)
const PISTON_RATE = 5; // 1/s exponential approach
const PISTON_MAX_SPEED = 80; // units/s
const RADIUS_RATE = 5; // 1/s
const FADE_TIME = 0.45; // s
const COUNT_RATE = 60; // particles/s added or removed
const MAX_EVENTS = 80;

// Real-mode attraction: hard core (collision radius) + short-range attractive
// tail, force-shifted so it goes to zero at the cutoff:
//   F(r) = (6 EPS / S) * [ (S/r)^7 - (S/RC)^7 ]  for S <= r <= RC   (attractive)
// with S the contact distance (2 * current radius). EPS is set relative to the
// reference thermal energy kT_ref = SIGMA_REF^2 (m = 1) so attraction matters
// at 100 K (well depth ~1.2 kT) and is minor at 300 K (~0.4 kT) and above. Tuned
// empirically (neighbour-count sweep over seeds). Not quantitative MD.
const EPS_OVER_KT_REF = 0.4;
const EPS = EPS_OVER_KT_REF * SIGMA_REF * SIGMA_REF;
const CUTOFF_FACTOR = 2.5;

export function pistonHeight(V) {
  return (CHAMBER.maxHeight * V) / LIMITS.V.max;
}

export function sigmaForT(T) {
  return SIGMA_REF * Math.sqrt(T / T_REF);
}

/** Seedable PRNG (mulberry32) so tests are reproducible. */
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

/** Elastic reflection of velocity component v off a wall moving at vWall. */
export function reflectWall1D(v, vWall = 0) {
  return 2 * vWall - v;
}

/** Elastic collision of two EQUAL-mass particles (velocity update only).
 * Exchanges the normal components -> conserves momentum and kinetic energy
 * exactly (up to floating point). Returns true if a collision was applied
 * (i.e. the particles were approaching along the line of centres). */
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

/** Keep a particle inside the chamber and under the (possibly moving)
 * piston. Returns true if a velocity reflection happened. */
function confine(p, r, h, vPiston) {
  let hit = false;
  const W = CHAMBER.width;
  if (p.x < r) {
    p.x = r;
    if (p.vx < 0) { p.vx = -p.vx; hit = true; }
  } else if (p.x > W - r) {
    p.x = W - r;
    if (p.vx > 0) { p.vx = -p.vx; hit = true; }
  }
  if (p.y < r) {
    p.y = r;
    if (p.vy < 0) { p.vy = -p.vy; hit = true; }
  }
  const top = h - r;
  if (p.y > top) {
    p.y = top;
    const rel = p.vy - vPiston;
    if (rel > 0) { p.vy = reflectWall1D(p.vy, vPiston); hit = true; }
  }
  return hit;
}

export function createSimulation({ seed = 12345 } = {}) {
  const rng = makeRng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

  const sim = {
    controls: { ...DEFAULT_CONTROLS },
    display: { ...DEFAULT_DISPLAY },
    particles: [],
    paused: false,
    instant: false, // reduced motion: piston/radius/fades snap
    time: 0,
    pistonH: pistonHeight(DEFAULT_CONTROLS.V),
    pistonV: 0,
    radius: R_IDEAL,
    events: [],
    _acc: 0,
    _countAcc: 0,
    _nextId: 1,
  };

  const targetRadius = () => (sim.controls.mode === "real" ? R_REAL : R_IDEAL);
  const activeParticles = () => sim.particles.filter((p) => p.fade >= 0);

  function randomSpeedVelocity() {
    const s = sigmaForT(sim.controls.T);
    return [s * gauss(), s * gauss()];
  }

  function spawnParticle(alpha) {
    const r = sim.radius;
    const h = sim.pistonH;
    const minD = 2 * r * 1.15;
    let best = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = r + rng() * (CHAMBER.width - 2 * r);
      const y = r + rng() * Math.max(0, h - 2 * r);
      let md = Infinity;
      for (const q of sim.particles) {
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < md) md = d;
      }
      if (md >= minD) { best = { x, y }; break; }
      if (md > bestScore) { bestScore = md; best = { x, y }; }
    }
    const [vx, vy] = randomSpeedVelocity();
    sim.particles.push({
      id: sim._nextId++, x: best.x, y: best.y, vx, vy,
      alpha, fade: alpha >= 1 ? 0 : 1,
    });
  }

  function syncCount(instantly) {
    const target = sim.controls.N;
    let active = activeParticles();
    if (instantly) {
      sim.particles = sim.particles.filter((p) => p.fade >= 0);
      for (const p of sim.particles) { p.alpha = 1; p.fade = 0; }
      while (sim.particles.length > target) sim.particles.pop();
      while (sim.particles.length < target) spawnParticle(1);
      return;
    }
    // fade-in particles count as active; spawn/remove at COUNT_RATE
    let budget = Math.floor(sim._countAcc);
    if (budget > 0) sim._countAcc -= budget;
    while (budget > 0 && active.length < target) { spawnParticle(sim.instant ? 1 : 0); active = activeParticles(); budget--; }
    while (budget > 0 && active.length > target) {
      const p = active.pop();
      if (sim.instant) sim.particles.splice(sim.particles.indexOf(p), 1);
      else p.fade = -1;
      budget--;
    }
    if (active.length === target) sim._countAcc = 0;
  }

  function currentKineticTemperature() {
    const act = activeParticles();
    if (!act.length) return null;
    let s = 0;
    for (const p of act) s += p.vx * p.vx + p.vy * p.vy;
    return (T_REF * (s / act.length)) / (2 * SIGMA_REF * SIGMA_REF);
  }

  function scaleVelocities(lambda) {
    for (const p of sim.particles) { p.vx *= lambda; p.vy *= lambda; }
  }

  function thermostat(dt) {
    const Tk = currentKineticTemperature();
    if (!Tk) return;
    const l2 = 1 + (dt / THERMOSTAT_TAU) * (sim.controls.T / Tk - 1);
    scaleVelocities(clamp(Math.sqrt(Math.max(l2, 0)), 0.9, 1.1));
  }

  function applyAttraction(dt) {
    const S = 2 * sim.radius;
    const RC = CUTOFF_FACTOR * S;
    const pre = (6 * EPS) / S;
    const shift = Math.pow(S / RC, 7);
    const ps = sim.particles;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.fade < 0) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.fade < 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > RC * RC || d2 < 1e-9) continue;
        const d = Math.sqrt(d2);
        const rr = Math.max(d, S); // clamp: force never exceeds its contact value
        const f = pre * (Math.pow(S / rr, 7) - shift);
        const fx = (f * dx) / d * dt;
        const fy = (f * dy) / d * dt;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }
  }

  function pushEvent(x, y, kind) {
    if (!sim.display.collisions || sim.instant) return;
    sim.events.push({ x, y, kind, t: sim.time });
    if (sim.events.length > MAX_EVENTS) sim.events.shift();
  }

  function substep() {
    const dt = DT;
    // piston
    const targetH = pistonHeight(sim.controls.V);
    const prevH = sim.pistonH;
    if (sim.instant) {
      sim.pistonH = targetH;
    } else {
      const diff = targetH - prevH;
      const v = clamp(diff * PISTON_RATE, -PISTON_MAX_SPEED, PISTON_MAX_SPEED);
      sim.pistonH = Math.abs(diff) < 1e-4 ? targetH : prevH + v * dt;
    }
    sim.pistonV = (sim.pistonH - prevH) / dt;
    // collision radius eases between ideal and real
    const rt = targetRadius();
    sim.radius = sim.instant || Math.abs(rt - sim.radius) < 1e-4 ? rt : sim.radius + (rt - sim.radius) * Math.min(1, RADIUS_RATE * dt);
    const r = sim.radius;
    const ps = sim.particles;

    thermostat(dt);
    if (sim.controls.mode === "real") applyAttraction(dt);

    for (const p of ps) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.fade > 0) { p.alpha = Math.min(1, p.alpha + dt / FADE_TIME); if (p.alpha >= 1) p.fade = 0; }
      else if (p.fade < 0) p.alpha -= dt / FADE_TIME;
    }
    for (const p of ps) {
      if (confine(p, r, sim.pistonH, sim.pistonV)) pushEvent(p.x, p.y, "wall");
    }
    // particle-particle (equal mass, elastic); fading-out ghosts do not collide
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
        const nx = dx / d, ny = dy / d;
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

  /** Advance by wall-clock dt seconds (no-op while paused). */
  sim.advance = function advance(dt) {
    if (sim.paused) return;
    sim._acc += Math.min(Math.max(dt, 0), 0.1);
    sim._countAcc += Math.min(Math.max(dt, 0), 0.1) * COUNT_RATE;
    let n = 0;
    syncCount(false);
    while (sim._acc >= DT && n < MAX_SUBSTEPS_PER_ADVANCE) {
      substep();
      sim._acc -= DT;
      n++;
    }
    if (n === MAX_SUBSTEPS_PER_ADVANCE) sim._acc = 0;
  };

  /** Snap everything to the current controls without advancing motion
   * (used while paused so the display never lags the sliders). */
  function syncInstant() {
    sim.pistonH = pistonHeight(sim.controls.V);
    sim.pistonV = 0;
    sim.radius = targetRadius();
    syncCount(true);
    const Tk = currentKineticTemperature();
    if (Tk) scaleVelocities(Math.sqrt(sim.controls.T / Tk));
    for (const p of sim.particles) confine(p, sim.radius, sim.pistonH, 0);
  }

  sim.setControls = function setControls(next) {
    sim.controls = clampControls({ ...sim.controls, ...next });
    if (sim.paused) syncInstant();
  };

  sim.setDisplay = function setDisplay(next) {
    sim.display = { ...sim.display, ...next };
    if (!sim.display.collisions) sim.events.length = 0;
  };

  sim.setPaused = function setPaused(p) {
    sim.paused = !!p;
  };

  sim.setInstant = function setInstant(v) {
    sim.instant = !!v;
  };

  /** Restore defaults: Ideal mode, N=50, T=300 K, V=25 L, default display
   * options, playing. Rebuilds the particle sample. */
  sim.reset = function reset() {
    sim.controls = { ...DEFAULT_CONTROLS };
    sim.display = { ...DEFAULT_DISPLAY };
    sim.paused = false;
    sim.particles = [];
    sim.events.length = 0;
    sim.time = 0;
    sim._acc = 0;
    sim._countAcc = 0;
    sim.pistonH = pistonHeight(DEFAULT_CONTROLS.V);
    sim.pistonV = 0;
    sim.radius = R_IDEAL;
    syncCount(true);
    for (const p of sim.particles) confine(p, sim.radius, sim.pistonH, 0);
  };

  sim.getReadings = () => computeReadings(sim.controls);

  sim.getStats = function getStats() {
    const act = activeParticles();
    let sp = 0, ke = 0, px = 0, py = 0;
    for (const p of act) {
      const v2 = p.vx * p.vx + p.vy * p.vy;
      sp += Math.sqrt(v2); ke += 0.5 * v2; px += p.vx; py += p.vy;
    }
    const n = act.length || 1;
    return { count: act.length, meanSpeed: sp / n, meanKE: ke / n, totalKE: ke, px, py, kineticTemperature: currentKineticTemperature() };
  };

  /** Pairs of active particles within the attraction range (real mode),
   * with strength s in (0,1] relative to contact. For the force-line overlay. */
  sim.getForcePairs = function getForcePairs() {
    if (sim.controls.mode !== "real") return [];
    const S = 2 * sim.radius;
    const RC = 1.8 * S;
    const out = [];
    const ps = sim.particles;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].fade < 0) continue;
      for (let j = i + 1; j < ps.length; j++) {
        if (ps[j].fade < 0) continue;
        const d = Math.hypot(ps[j].x - ps[i].x, ps[j].y - ps[i].y);
        if (d <= RC) out.push({ a: ps[i], b: ps[j], s: clamp(1 - (d - S) / (RC - S), 0.08, 1) });
      }
    }
    return out;
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

export const PHYSICS_DT = DT;
