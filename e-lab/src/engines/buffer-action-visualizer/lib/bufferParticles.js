// Particle physics for the buffer beaker — the same verified pattern
// used in the Neutralization Particle Visualizer (bounce within bounds,
// react only through plausible nearby encounters, never long-range
// attraction), adapted here so an added H+/OH- particle specifically
// seeks out its OWN conjugate partner and converts it, while spectator
// ions and the untouched conjugate member simply drift.

const SPEED = 40;
const REACT_DISTANCE = 22;
const REACT_TRAVEL_SECONDS = 0.6;

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function createParticle(id, kind, bounds, radius = 8) {
  const angle = randRange(0, Math.PI * 2);
  const speed = randRange(SPEED * 0.75, SPEED * 1.25); // slightly different per particle -- natural, not a uniform group
  return {
    id,
    kind, // "acid" | "base" | "spectator" | "H" | "OH" | "water"
    x: randRange(bounds.x + radius, bounds.x + bounds.w - radius),
    y: randRange(bounds.y + radius, bounds.y + bounds.h - radius),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    status: "active", // active | reacting | consumed
    reactT: 0,
    meetX: 0,
    meetY: 0,
    convertTo: null, // what this particle becomes once its reaction completes
  };
}

function radiusFor(kind) {
  return kind === "H" || kind === "OH" ? 9 : kind === "spectator" ? 8 : kind === "water" ? 7 : 13;
}

function bounce(p, bounds, dt) {
  const r = radiusFor(p.kind);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.x < bounds.x + r) { p.x = bounds.x + r; p.vx = Math.abs(p.vx); }
  if (p.x > bounds.x + bounds.w - r) { p.x = bounds.x + bounds.w - r; p.vx = -Math.abs(p.vx); }
  if (p.y < bounds.y + r) { p.y = bounds.y + r; p.vy = Math.abs(p.vy); }
  if (p.y > bounds.y + bounds.h - r) { p.y = bounds.y + bounds.h - r; p.vy = -Math.abs(p.vy); }
}

/**
 * Advances all particles one tick. `reactionRule` is either null (no
 * reactions this beaker -- the unbuffered side) or
 * { seekerKind: "H"|"OH", targetKind: "base"|"acid", targetBecomes: "acid"|"base" }
 * -- an added H+ particle seeks out a "base"-kind particle and converts
 * IT to "acid"-kind (never the reverse), matching CH3COO-+H+->CH3COOH /
 * NH3+H+->NH4+; OH- does the mirror image. Spectator particles are never
 * a valid target, so they can never react.
 */
export function stepBufferParticles(particles, bounds, dt, reactionRule, onWaterFormed) {
  const next = [];

  for (const p of particles) {
    if (p.status === "consumed") continue;

    if (p.status === "reacting") {
      p.reactT += dt;
      const t = Math.min(1, p.reactT / REACT_TRAVEL_SECONDS);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      p.x += (p.meetX - p.x) * ease * 0.3;
      p.y += (p.meetY - p.y) * ease * 0.3;
      if (t >= 1) {
        if (p.kind === reactionRule?.seekerKind) {
          // The seeker (H+/OH-) is consumed entirely.
          p.status = "consumed";
          if (p.kind === "OH") onWaterFormed?.(p.meetX, p.meetY);
        } else {
          // The target particle transforms into its converted identity.
          p.kind = p.convertTo;
          p.status = "active";
          p.convertTo = null;
        }
      }
      next.push(p);
      continue;
    }

    if (p.kind === "water") {
      p.glowT = Math.max(0, (p.glowT ?? 0.5) - dt);
      if (p.glowT <= 0) { p.status = "consumed"; continue; }
    }

    bounce(p, bounds, dt);
    next.push(p);
  }

  if (reactionRule) {
    const seekers = next.filter((p) => p.kind === reactionRule.seekerKind && p.status === "active");
    const targets = next.filter((p) => p.kind === reactionRule.targetKind && p.status === "active");
    for (const seeker of seekers) {
      let closest = null, closestDist = Infinity;
      for (const target of targets) {
        if (target.status !== "active") continue;
        const d = Math.hypot(seeker.x - target.x, seeker.y - target.y);
        if (d < closestDist) { closestDist = d; closest = target; }
      }
      if (closest && closestDist < REACT_DISTANCE) {
        const meetX = (seeker.x + closest.x) / 2, meetY = (seeker.y + closest.y) / 2;
        seeker.status = "reacting"; seeker.reactT = 0; seeker.meetX = meetX; seeker.meetY = meetY;
        closest.status = "reacting"; closest.reactT = 0; closest.meetX = meetX; closest.meetY = meetY;
        closest.convertTo = reactionRule.targetBecomes;
      }
    }
  }

  applyGentleSeparation(next);

  return next;
}

/** Simple, calm overlap relief -- NOT a full collision-physics engine.
 * If two active particles overlap, nudge each a small fraction of the
 * overlap apart. Deliberately gentle (a small fixed fraction, not a full
 * correction) so particles settle rather than jitter. */
function applyGentleSeparation(particles) {
  const active = particles.filter((p) => p.status === "active");
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const minDist = radiusFor(a.kind) + radiusFor(b.kind);
      if (dist < minDist) {
        const overlap = (minDist - dist) * 0.15; // gentle -- a fraction of the overlap, not the whole thing
        const nx = dx / dist, ny = dy / dist;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
      }
    }
  }
}

export function createWaterParticle(id, x, y) {
  return { id, kind: "water", x, y, vx: randRange(-1, 1) * SPEED * 0.5, vy: randRange(-1, 1) * SPEED * 0.5, status: "active", glowT: 0.6 };
}
