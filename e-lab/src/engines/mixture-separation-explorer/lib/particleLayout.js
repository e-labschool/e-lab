// A stable pseudo-random particle layout generator, kept separate from
// the Particles rendering component so that file only ever exports a
// component (fast-refresh friendly).
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Generates `count` particle positions within `bounds`, deterministic
 * for a given seed -- never re-randomized on re-render, so particles
 * don't visibly jitter/reshuffle between frames.
 *
 * `settleBias` (0-1) biases particles toward the BOTTOM of `bounds`
 * (greater accumulation from settling) while still leaving some
 * genuinely suspended higher up -- used for sand in a standing beaker
 * of water, so it reads as "solid particles physically present in the
 * liquid" rather than uniform confetti or a flat colour tint. 0 = pure
 * uniform distribution (used for particles on a flat surface like
 * filter-paper residue, where no "settling toward the bottom" concept
 * applies). */
export function makeParticleLayout(count, seed, bounds, { settleBias = 0 } = {}) {
  const rand = seededRandom(seed || 1);
  const particles = [];
  for (let i = 0; i < count; i++) {
    const uy = rand();
    // Biasing y toward 1 (bottom of bounds) via a power curve -- higher
    // settleBias means more particles pack toward the bottom, some
    // still scattered higher up as "suspended" grains.
    const biasedY = settleBias > 0 ? Math.pow(uy, 1 - settleBias * 0.7) : uy;
    particles.push({
      x: bounds.x + rand() * bounds.w,
      y: bounds.y + biasedY * bounds.h,
      r: 1.3 + rand() * 1.1,
      wobble: rand() * 6.28,
    });
  }
  return particles;
}
