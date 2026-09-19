// Particle physics for the live A/B container -- smooth continuous
// motion, wall bounce, rotation, and each particle's speed genuinely
// drawn from the T-dependent Maxwell-Boltzmann-shaped distribution (see
// maxwellBoltzmann.js), not a fixed or uniform-random value. Detects
// real A-B proximity events for Collision mode's "focus a real event
// into the Collision Viewer" behaviour.
import { sampleEnergy } from "./maxwellBoltzmann.js";

const SPEED_SCALE = 0.9; // relates sampled "energy" to an on-screen px/s speed
const MOLECULE_RADIUS = 16;
const COLLISION_PROXIMITY = 26;

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function createParticle(id, kind, bounds, temperature) {
  const energy = sampleEnergy(temperature);
  const speed = Math.sqrt(energy) * SPEED_SCALE;
  const angle = randRange(0, Math.PI * 2);
  return {
    id,
    kind, // "A" | "B"
    x: randRange(bounds.x + MOLECULE_RADIUS, bounds.x + bounds.w - MOLECULE_RADIUS),
    y: randRange(bounds.y + MOLECULE_RADIUS, bounds.y + bounds.h - MOLECULE_RADIUS),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: randRange(0, 360),
    spinRate: randRange(-40, 40), // deg/s -- molecules rotate as they drift, never uniformly
    energy,
    highlighted: false,
  };
}

export function createParticleField(count, bounds, temperature) {
  const list = [];
  let id = 0;
  for (let i = 0; i < count; i++) list.push(createParticle(`a${id++}`, "A", bounds, temperature));
  for (let i = 0; i < count; i++) list.push(createParticle(`b${id++}`, "B", bounds, temperature));
  return list;
}

/** Advances all particles by dt seconds -- pure function, no side
 * effects, so the caller controls exactly when/whether this runs
 * (paused, unmounted, tab hidden, etc all just stop calling it). */
export function stepParticles(particles, bounds, dt) {
  return particles.map((p) => {
    let { x, y, vx, vy, rotation } = p;
    x += vx * dt;
    y += vy * dt;
    rotation = (rotation + p.spinRate * dt) % 360;
    if (x < bounds.x + MOLECULE_RADIUS) { x = bounds.x + MOLECULE_RADIUS; vx = Math.abs(vx); }
    if (x > bounds.x + bounds.w - MOLECULE_RADIUS) { x = bounds.x + bounds.w - MOLECULE_RADIUS; vx = -Math.abs(vx); }
    if (y < bounds.y + MOLECULE_RADIUS) { y = bounds.y + MOLECULE_RADIUS; vy = Math.abs(vy); }
    if (y > bounds.y + bounds.h - MOLECULE_RADIUS) { y = bounds.y + bounds.h - MOLECULE_RADIUS; vy = -Math.abs(vy); }
    return { ...p, x, y, vx, vy, rotation, highlighted: false };
  });
}

/** Finds the first genuinely close A-B pair (a real proximity event in
 * the live field), used only by Collision mode to focus an ACTUAL
 * detected encounter into the Collision Viewer -- the other three modes
 * use curated, clearly-labelled worked examples instead (see the main
 * component), since reliably waiting for a random live encounter with a
 * SPECIFIC required energy/orientation combination is not a reasonable
 * thing to depend on for a deterministic teaching demonstration. */
export function findCloseEncounter(particles) {
  const as = particles.filter((p) => p.kind === "A");
  const bs = particles.filter((p) => p.kind === "B");
  for (const a of as) {
    for (const b of bs) {
      if (Math.hypot(a.x - b.x, a.y - b.y) < COLLISION_PROXIMITY) return { a, b };
    }
  }
  return null;
}

export { MOLECULE_RADIUS };
