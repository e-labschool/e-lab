// Particle physics for the live A/B reaction vessel -- smooth continuous
// motion, wall bounce, rotation, and each particle's speed genuinely
// drawn from the T-dependent Maxwell-Boltzmann-shaped distribution (see
// maxwellBoltzmann.js), not a fixed or uniform-random value. Detects
// real A-B proximity events for the magnified view's automatic
// event-capture behaviour.
import { sampleEnergy } from "./maxwellBoltzmann.js";

// Noticeably faster than the previous version -- the vessel is also now
// smaller (a compact 25-30% side panel), so a higher base speed keeps
// the motion feeling active rather than sluggish in the reduced space.
const SPEED_SCALE = 2.1;
const MOLECULE_RADIUS = 11;
const COLLISION_PROXIMITY = 18;

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
    spinRate: randRange(-70, 70), // deg/s -- molecules rotate as they drift, never uniformly
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
 * the live field) -- used by the magnified view's automatic event
 * capture across all four tabs. Curated worked examples (Activation
 * Energy's Case A/B, Orientation's incorrect/correct) still override
 * this with a specific staged scenario when the student selects them,
 * since reliably waiting for a random live encounter with a SPECIFIC
 * required energy/orientation combination is not reasonable to depend
 * on for a deterministic teaching demonstration -- but the ambient
 * capture itself is always a real detected encounter, never faked. */
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

/** Finds the particle nearest a given point -- used for click-to-inspect
 * in the vessel (the simpler, more reliable alternative to continuous
 * pointer-following magnification the brief explicitly deprioritizes). */
export function findNearestParticle(particles, x, y, maxDistance = 40) {
  let nearest = null;
  let nearestDist = maxDistance;
  for (const p of particles) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = p;
    }
  }
  return nearest;
}

export { MOLECULE_RADIUS };
