// SIMPLIFIED POPULATION RESPONSE TO CONTINUOUS RF -- the "excited-state (beta) population rises during irradiation" model of step 3.
// Pure module (no React, no three). Tested by scripts/test-nmr-steps.mjs.
//
// What it models: the alpha / beta population DIFFERENCE of an ensemble of isolated spin-1/2 nuclei under weak-to-moderate continuous RF,
// from the same Bloch parameters as cwResponse.js (T1, T2, omega1; s = omega1^2 T1 T2). With D = (Na - Nb) / (Na - Nb)_equilibrium = Mz / M0:
//
//     dD/dt = -(1 + s g) D / T1 + 1 / T1,        g = 1 / (1 + Delta^2 T2^2)         (Bloch z-equation, rotating frame, My at steady state)
//
// whose solution from equilibrium (D = 1) is
//
//     D(t) = D_ss + (1 - D_ss) exp(-t / tau),    D_ss = 1 - (s / (1 + s)) L(offset),    tau = T1 (1 + s - s L) / (1 + s)
//
// where L = cwAbsorption(offset) is EXACTLY the plotted response (peak 1). So:
//   * far off resonance (L -> 0): D_ss -> 1 and tau -> T1: the populations do not change;
//   * on resonance (L = 1): D_ss = 1 / (1 + s) and tau = T1 / (1 + s): the difference is reduced by the factor 1 + s but, because the nuclei
//     also relax (T1), it is NEVER driven to zero or reversed: D_ss >= 1 / (1 + s) > 0. Populations move TOWARDS equalisation, never beyond.
//   * D(t) is monotonic in t and, at any t, monotonic in |offset| (the closer to resonance, the larger the change).
//
// Accuracy: D_ss is exactly the Bloch steady-state Mz / M0. The single-exponential TIME COURSE is the rate-equation approximation (the
// transverse magnetisation is taken to be at its steady state at once); with T1 = T2 the full Bloch transient lags it early on resonance
// (by up to about 0.2 of the difference) and undershoots slightly (damped Rabi oscillation), then both settle on the same value. Tested.
//
// The beta fraction is (1 - P D) / 2 and the alpha fraction (1 + P D) / 2 for an equilibrium polarisation P (real Boltzmann value, or the
// labelled exaggeration used only to make it visible). The animation does not show "every proton flips": it shows a population shift of
// a few tens of percent of the (tiny) equilibrium excess, which is why a nuclear-spin sample can never be inverted by weak CW.
//
// Time: T1 is a few ten milliseconds in this illustrative model, far too fast to watch. The display clock is therefore stretched:
// 1 s of animation = MODEL_SECONDS_PER_DISPLAY_SECOND of model time (chosen so that tau on resonance is IRRADIATION_TAU_DISPLAY_S of animation).
import { CW, cwAbsorption } from "./cwResponse.js";

/** Animation seconds in which the population difference relaxes by a factor 1/e on resonance. */
export const IRRADIATION_TAU_DISPLAY_S = 0.9;
/** Length of one finite irradiation window in animation seconds (about 5 tau on resonance, so the on-resonance value is essentially settled). */
export const IRRADIATION_WINDOW_S = 4.5;

/** Model seconds that pass in one animation second. */
export const modelSecondsPerDisplaySecond = (p = CW) => (p.t1 / (1 + p.omega1 * p.omega1 * p.t1 * p.t2)) / IRRADIATION_TAU_DISPLAY_S;
const sat = (p) => p.omega1 * p.omega1 * p.t1 * p.t2;

/** Steady-state population difference D_ss (relative to equilibrium) at an RF offset in Hz: 1 - s/(1+s) L(offset). Between 1/(1+s) and 1. */
export function populationDifferenceSteady(offsetHz, p = CW) {
  const s = sat(p);
  return 1 - (s / (1 + s)) * cwAbsorption(offsetHz, p);
}
/** Time constant (model seconds) of the approach to the steady state: T1 (1 + s - s L) / (1 + s). */
export function populationTau(offsetHz, p = CW) {
  const s = sat(p); const L = cwAbsorption(offsetHz, p);
  return (p.t1 * (1 + s - s * L)) / (1 + s);
}
/** Population difference D (1 = equilibrium) after `tModelS` model seconds of irradiation that started from equilibrium. */
export function populationDifference(offsetHz, tModelS, p = CW) {
  const dss = populationDifferenceSteady(offsetHz, p);
  return dss + (1 - dss) * Math.exp(-Math.max(0, tModelS) / populationTau(offsetHz, p));
}
/** Same, with the time given in animation seconds (what the page uses). */
export const populationDifferenceDisplay = (offsetHz, tDisplayS, p = CW) => populationDifference(offsetHz, tDisplayS * modelSecondsPerDisplaySecond(p), p);
/** One step of the rate equation from any D (exact for constant offset, so it composes: two half steps = one full step). */
export function evolvePopulationDifference(d, offsetHz, dtModelS, p = CW) {
  const dss = populationDifferenceSteady(offsetHz, p);
  return dss + (d - dss) * Math.exp(-Math.max(0, dtModelS) / populationTau(offsetHz, p));
}

/** Fraction of the way from the equilibrium excess to equal populations: 1 - D. 0 = equilibrium, 1 would be complete equalisation (never reached). */
export const equalisationProgress = (d) => 1 - d;
/** Beta (excited-state) and alpha fractions for equilibrium polarisation P and relative difference D. */
export function stateFractions(polarisation, d) {
  const pd = polarisation * d;
  return { alpha: (1 + pd) / 2, beta: (1 - pd) / 2 };
}
