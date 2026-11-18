// Time dependence of London-dispersion fluctuations (pure). The instantaneous dipole of a non-polar molecule is NOT a fixed arrow: its
// strength and sign change continuously. fluctuationSignal(t) is a smooth, bounded (-1..1), zero-average signal built from three
// incommensurate frequencies, so it never repeats on a short period, passes through zero (the symmetric average) and keeps flipping sign.
// The same signal drives the molecule that fluctuates AND, through the field it produces, the induced dipole of its neighbour: the two
// always stay correlated (the nearest ends carry opposite charges at every instant, see tests).
export const FLUCT_PHASES = [0.35, 1.1, 2.3];
export function fluctuationSignal(t, seed = 0) {
  const s = seed * 1.7;
  const v = 0.62 * Math.sin(0.93 * t + FLUCT_PHASES[0] + s) + 0.44 * Math.sin(1.71 * t + FLUCT_PHASES[1] + 0.6 * s) + 0.3 * Math.sin(2.93 * t + FLUCT_PHASES[2] + 1.9 * s);
  return Math.tanh(1.5 * v);
}
/** Time-average of the signal over [t0, t1] (used by the tests: the average display is symmetric). */
export function fluctuationMean(t0, t1, dt = 0.01, seed = 0) { let s = 0; let n = 0; for (let t = t0; t <= t1; t += dt) { s += fluctuationSignal(t, seed); n += 1; } return s / n; }
