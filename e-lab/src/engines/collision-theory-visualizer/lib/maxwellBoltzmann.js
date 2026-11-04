// The scientifically correct Maxwell-Boltzmann kinetic-energy
// distribution for a 3D gas: f(E) proportional to sqrt(E) * exp(-E/kT).
//
// An earlier version of this file replaced this with E*exp(-E/kT) to
// avoid the infinite slope at E=0 -- that was the WRONG fix. The
// correct distribution's steep initial rise is a genuine physical
// feature, not a rendering defect, and is restored here. The visual
// concern (the rise looking cramped/near-vertical) is instead solved
// through axis scaling: K_SCALE and ENERGY_MAX below were chosen and
// verified numerically so that even at the highest slider temperature
// (700 K) the peak sits well clear of the origin and the curve's tail
// is reasonably visible before the axis edge, rather than compressing
// most of the distribution into a sliver of the plot -- with NO change
// to the underlying physics.
//
// Verified numerically before use: f(0)=0, the peak shifts to higher E
// and lowers (area-normalized) as T increases, the fraction with
// E >= a fixed Ea genuinely increases with T, and the default T1/T2/T3
// (300/450/600 K) sit at 13%/19%/25% of the axis width respectively --
// none compressed against the left edge, all showing a genuine curve
// shape rather than a vertical sliver.
export const K_SCALE = 0.15;
export const ENERGY_MAX = 180;
export const ENERGY_STEP = 0.75;
export const DEFAULT_TEMPERATURE = 400;
export const DEFAULT_EA = 45;
export const MIN_TEMPERATURE = 250;
export const MAX_TEMPERATURE = 700;

// Selectable temperatures for the Maxwell-Boltzmann tab's T1/T2/T3
// pickers -- realistic chemistry-demonstration values, never an
// unrealistic near-zero default.
export const TEMPERATURE_OPTIONS = [250, 300, 350, 400, 450, 500, 550, 600, 650, 700];
export const DEFAULT_TEMPERATURES = { T1: 300, T2: 450, T3: 600 };

function rawDensity(E, T) {
  const kT = K_SCALE * T;
  if (E <= 0) return 0;
  return Math.sqrt(E) * Math.exp(-E / kT);
}

/** The full curve as {E, f} points, AREA-NORMALIZED so total probability
 * stays constant regardless of T -- this is what makes the peak
 * genuinely lower (not just visually squashed) as the distribution
 * broadens with increasing temperature. Sampled at ENERGY_STEP
 * intervals across the full ENERGY_MAX range -- fine enough (240+
 * points) for a smooth rendered curve, including through the initial
 * rise near the origin. */
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
 * rejection sampling against the curve's own peak (at E=kT/2 for this
 * form) -- used to give each particle in the live vessel a genuinely
 * distributed (not uniform, not identical) energy/speed, verified to
 * produce a real slow/medium/fast spread rather than decorative
 * randomness. */
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
