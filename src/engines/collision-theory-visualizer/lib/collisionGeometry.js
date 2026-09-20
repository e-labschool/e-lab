// Derives a natural approach/outcome animation from a captured collision
// event (real, from the live vessel, or synthesized for a curated
// teaching demo -- both use this SAME geometry, so curated cases still
// look like genuinely moving molecules rather than a different, more
// artificial code path).
//
// An "encounter" is: { aPos, bPos, aVel, bVel, aRot, bRot, aSpin, bSpin }
// -- position/velocity/rotation/angular-velocity for both particles at
// the moment of contact detection. Everything below is derived from
// this real state, never a fixed scripted position.

const APPROACH_LOOKBACK_SECONDS = 1.3;

/** Extrapolates a position BACKWARD along its velocity vector -- gives a
 * natural earlier "approach" position consistent with the real
 * trajectory, not an arbitrary fixed starting point. */
export function extrapolateBack(pos, vel, seconds = APPROACH_LOOKBACK_SECONDS) {
  return { x: pos.x - vel.x * seconds, y: pos.y - vel.y * seconds };
}

/** Reflects a velocity across the tangent to `normal` (a unit vector) --
 * a simplified elastic-collision reflection, used to give unsuccessful
 * collisions a physically-motivated post-collision direction instead of
 * simply negating both velocities. */
export function reflectVelocity(vel, normal) {
  const dot = vel.x * normal.x + vel.y * normal.y;
  return { x: vel.x - 2 * dot * normal.x, y: vel.y - 2 * dot * normal.y };
}

/** The unit vector from A to B at the moment of contact -- the
 * "collision normal" used for natural deflection. */
export function collisionNormal(aPos, bPos) {
  const dx = bPos.x - aPos.x;
  const dy = bPos.y - aPos.y;
  const dist = Math.hypot(dx, dy) || 1;
  return { x: dx / dist, y: dy / dist };
}

/**
 * Builds the full set of positions this event's animation needs, all
 * derived from the captured/synthesized encounter -- approach start,
 * contact point, and (for unsuccessful events) a naturally deflected
 * separation point. Re-centres everything on the contact midpoint so
 * the magnified panel can place it wherever it wants on screen.
 */
export function buildEventGeometry(encounter, { deflectScale = 60, separationScale = 55 } = {}) {
  const { aPos, bPos, aVel, bVel, aRot, bRot, aSpin, bSpin } = encounter;
  const contact = { x: (aPos.x + bPos.x) / 2, y: (aPos.y + bPos.y) / 2 };

  const aApproach = extrapolateBack(aPos, aVel, APPROACH_LOOKBACK_SECONDS);
  const bApproach = extrapolateBack(bPos, bVel, APPROACH_LOOKBACK_SECONDS);

  // Re-centre everything relative to the contact point so downstream
  // rendering can place `contact` anywhere on screen.
  const recenter = (p) => ({ x: p.x - contact.x, y: p.y - contact.y });
  const aApproachRel = recenter(aApproach);
  const bApproachRel = recenter(bApproach);
  const aContactRel = recenter(aPos);
  const bContactRel = recenter(bPos);

  const normal = collisionNormal(aPos, bPos);
  const aDeflected = reflectVelocity(aVel, normal);
  const bDeflected = reflectVelocity(bVel, { x: -normal.x, y: -normal.y });
  const deflectNorm = (v) => {
    const mag = Math.hypot(v.x, v.y) || 1;
    return { x: (v.x / mag) * deflectScale, y: (v.y / mag) * deflectScale };
  };
  const aSeparate = deflectNorm(aDeflected);
  const bSeparate = deflectNorm(bDeflected);

  // Products separate outward along the average of the reactants'
  // incoming directions, reflected apart from the contact point --
  // still derived from the real captured motion, not a fixed axis.
  const combinedDir = { x: aVel.x - bVel.x, y: aVel.y - bVel.y };
  const combinedMag = Math.hypot(combinedDir.x, combinedDir.y) || 1;
  const productDir = { x: combinedDir.x / combinedMag, y: combinedDir.y / combinedMag };
  const cSeparate = { x: productDir.x * separationScale, y: productDir.y * separationScale };
  const dSeparate = { x: -productDir.x * separationScale, y: -productDir.y * separationScale };

  return {
    aApproachRel, bApproachRel, aContactRel, bContactRel,
    aRot, bRot, aSpin: aSpin ?? 0, bSpin: bSpin ?? 0,
    aSeparate, bSeparate, cSeparate, dSeparate,
  };
}

/** Synthesizes a plausible, varied (but deterministic per seed) captured
 * encounter for the curated teaching demos -- goes through the SAME
 * buildEventGeometry() as real vessel captures, so a curated case still
 * looks like a genuinely moving pair of molecules rather than a visibly
 * different, more artificial trajectory. */
export function synthesizeEncounter(seed) {
  let hash = 0;
  const s = String(seed ?? "0");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 10000;
  const angle = (hash % 360) * (Math.PI / 180);
  const speed = 18 + (hash % 10);
  const separation = 26;

  const aPos = { x: -Math.cos(angle) * separation, y: -Math.sin(angle) * separation };
  const bPos = { x: Math.cos(angle) * separation, y: Math.sin(angle) * separation };
  const aVel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  const bVel = { x: -Math.cos(angle) * speed, y: -Math.sin(angle) * speed };

  return {
    aPos, bPos, aVel, bVel,
    aRot: (hash % 60) - 30,
    bRot: ((hash * 7) % 60) - 30,
    aSpin: ((hash % 40) - 20),
    bSpin: (((hash * 3) % 40) - 20),
  };
}
