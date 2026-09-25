// A small deterministic PRNG (mulberry32) -- gives reproducible sampling
// (useful for testing, and for "Clear" + regenerate to feel consistent
// rather than jarringly different each time) while still appearing
// random to the student, per the brief's suggestion.
export function makeSeededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
