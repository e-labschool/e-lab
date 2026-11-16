// Small seeded random generator (mulberry32 + Box-Muller). Deterministic for a given seed, no allocation per call.
export function createRng(seed = 1) {
  let a = seed >>> 0;
  let spare = 0;
  let hasSpare = false;
  const rng = {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(lo, hi) { return lo + (hi - lo) * rng.next(); },
    /** Standard normal deviate. */
    gauss() {
      if (hasSpare) { hasSpare = false; return spare; }
      let u = 0;
      while (u < 1e-12) u = rng.next();
      const v = rng.next();
      const m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      hasSpare = true;
      return m * Math.cos(2 * Math.PI * v);
    },
    reseed(seed) { a = seed >>> 0; hasSpare = false; },
  };
  return rng;
}
