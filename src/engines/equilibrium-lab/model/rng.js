// Small seeded PRNG (mulberry32).  State is a single uint32 so it can live inside the reducer state: the stochastic
// passenger model is then a pure function of (state, dt) and tests / Replay are exactly reproducible.
export function nextRandom(seed) {
  let a = (seed + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: a };
}

/** Uniform in (0, 1]: safe for -ln(u). */
export function nextOpen(seed) {
  const r = nextRandom(seed);
  return { value: r.value === 0 ? 2.3283064365386963e-10 : r.value, seed: r.seed };
}

/** Binomial(n, p) draw; exact by inversion for small n*p, normal approximation (clamped to [0, n]) for large. */
export function binomial(n, p, seed) {
  if (n <= 0 || p <= 0) return { value: 0, seed };
  if (p >= 1) return { value: n, seed };
  if (n * Math.min(p, 1 - p) < 25) {
    const flip = p > 0.5; const q = flip ? 1 - p : p;
    // geometric waiting-time inversion
    let s = seed; let count = 0; let pos = 0; const lq = Math.log(1 - q);
    for (;;) {
      const r = nextOpen(s); s = r.seed;
      pos += Math.floor(Math.log(r.value) / lq) + 1;
      if (pos > n) break;
      count += 1;
    }
    return { value: flip ? n - count : count, seed: s };
  }
  const r1 = nextOpen(seed); const r2 = nextOpen(r1.seed);
  const z = Math.sqrt(-2 * Math.log(r1.value)) * Math.cos(2 * Math.PI * r2.value);
  const v = Math.round(n * p + z * Math.sqrt(n * p * (1 - p)));
  return { value: Math.max(0, Math.min(n, v)), seed: r2.seed };
}
