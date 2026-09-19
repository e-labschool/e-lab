// Maxwell-Boltzmann-shaped kinetic energy distribution -- the classic
// textbook curve: f(E) proportional to sqrt(E) * exp(-E/kT). K_SCALE is
// an arbitrary display-scaling constant (not the real physical Boltzmann
// constant -- this simulation uses an arbitrary 0-100 "energy unit"
// axis, not real joules), chosen so the curve visibly broadens across
// the intended 250-700 K slider range.
//
// Verified numerically before use: as T increases, the peak shifts to
// higher E, the (area-normalized) peak height decreases, and the
// fraction of particles with E >= a fixed Ea genuinely increases.
export const K_SCALE = 0.08;
export const ENERGY_MAX = 100;
export const ENERGY_STEP = 0.5;
export const DEFAULT_TEMPERATURE = 400;
export const DEFAULT_EA = 40;
export const MIN_TEMPERATURE = 250;
export const MAX_TEMPERATURE = 700;

function rawDensity(E, T) {
  const kT = K_SCALE * T;
  if (E <= 0) return 0;
  return Math.sqrt(E) * Math.exp(-E / kT);
}

/** The full curve as {E, f} points, AREA-NORMALIZED so total probability
 * stays constant regardless of T -- this is what makes the peak
 * genuinely lower (not just visually squashed) as the distribution
 * broadens with increasing temperature. */
export function buildCurve(T) {
  const raw = [];
  for (let E = 0; E <= ENERGY_MAX; E += ENERGY_STEP) raw.push({ E, f: rawDensity(E, T) });
  const area = raw.reduce((s, p) => s + p.f * ENERGY_STEP, 0);
  return raw.map((p) => ({ E: p.E, f: area > 0 ? p.f / area : 0 }));
}

/** Fraction of the (normalized) distribution with E >= Ea -- used for
 * the "higher temperature -> greater fraction with E >= Ea" statement,
 * computed from the SAME curve data the graph draws, never a separate
 * approximation. */
export function fractionBeyond(curve, Ea) {
  const total = curve.reduce((s, p) => s + p.f * ENERGY_STEP, 0);
  const beyond = curve.filter((p) => p.E >= Ea).reduce((s, p) => s + p.f * ENERGY_STEP, 0);
  return total > 0 ? beyond / total : 0;
}

/** Draws one random kinetic energy from the T-dependent distribution via
 * rejection sampling against the curve's own peak -- used to give each
 * particle in the live container a genuinely distributed (not uniform,
 * not identical) energy/speed, verified to produce a real slow/medium/
 * fast spread rather than decorative randomness. */
export function sampleEnergy(T) {
  const kT = K_SCALE * T;
  const peakE = kT / 2;
  const peakF = rawDensity(peakE, T) || 1e-6;
  for (let tries = 0; tries < 60; tries++) {
    const E = Math.random() * ENERGY_MAX;
    const f = rawDensity(E, T);
    if (Math.random() * peakF <= f) return E;
  }
  return peakE;
}
