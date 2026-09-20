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
 * don't visibly jitter/reshuffle between frames. */
export function makeParticleLayout(count, seed, bounds) {
  const rand = seededRandom(seed || 1);
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: bounds.x + rand() * bounds.w,
      y: bounds.y + rand() * bounds.h,
      r: 1.1 + rand() * 0.9,
    });
  }
  return particles;
}
