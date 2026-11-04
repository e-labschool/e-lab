// Spin-1/2 populations in thermal equilibrium (Boltzmann) and the net equilibrium magnetisation.
import { GAMMA_H1, H_PLANCK, HBAR, K_BOLTZMANN, TEMPERATURE_K, energyGapJ, larmorHz, B0_DEFAULT } from "./constants.js";

/** Nbeta / Nalpha = exp(-Delta E / kT). */
export function boltzmannRatio(b0Tesla, tempK = TEMPERATURE_K) {
  return Math.exp(-energyGapJ(b0Tesla) / (K_BOLTZMANN * tempK));
}

/** Exact polarisation P = (Na - Nb) / (Na + Nb) = tanh(Delta E / 2kT). */
export function polarization(b0Tesla, tempK = TEMPERATURE_K) {
  return Math.tanh(energyGapJ(b0Tesla) / (2 * K_BOLTZMANN * tempK));
}

/** High-temperature approximation P ~ gamma hbar B0 / 2 k T (valid because Delta E << kT for nuclear spins). */
export function polarizationApprox(b0Tesla, tempK = TEMPERATURE_K) {
  return (GAMMA_H1 * HBAR * b0Tesla) / (2 * K_BOLTZMANN * tempK);
}

/** Populations of N spins: { alpha, beta, excess } (alpha = lower energy). Real numbers (not rounded). */
export function populations(nTotal, b0Tesla, tempK = TEMPERATURE_K) {
  const p = polarization(b0Tesla, tempK);
  return { alpha: (nTotal * (1 + p)) / 2, beta: (nTotal * (1 - p)) / 2, excess: nTotal * p, polarization: p };
}

/** Equilibrium magnetisation of N spins, M0 = N (gamma hbar / 2) P, in A m^2 (magnetic moment of the ensemble). */
export function netMagnetization(nTotal, b0Tesla, tempK = TEMPERATURE_K) {
  return nTotal * ((GAMMA_H1 * HBAR) / 2) * polarization(b0Tesla, tempK);
}

/** Excess spins per million. */
export const excessPerMillion = (b0Tesla, tempK = TEMPERATURE_K) => 1e6 * polarization(b0Tesla, tempK);

/**
 * Teaching mode ("exaggerated"): the displayed polarisation is the real one multiplied by a CONSTANT factor chosen so
 * that it equals `targetAtReference` (default 0.2) at the reference field. It therefore still grows linearly and
 * monotonically with B0, but is ~6 000 times larger than the real value. The UI labels it as exaggerated.
 */
export function exaggerationFactor(targetAtReference = 0.2, refB0 = B0_DEFAULT, tempK = TEMPERATURE_K) {
  return targetAtReference / polarization(refB0, tempK);
}
export function displayPolarization(mode, b0Tesla, tempK = TEMPERATURE_K) {
  const p = polarization(b0Tesla, tempK);
  return mode === "teaching" ? Math.min(0.9, p * exaggerationFactor(0.2, B0_DEFAULT, tempK)) : p;
}

/** How many of N drawn arrows point up (alpha) for a displayed polarisation; at least floor, rounded to nearest. */
export function drawnAlphaCount(nDrawn, displayedPolarization) {
  return Math.round((nDrawn * (1 + displayedPolarization)) / 2);
}

export { H_PLANCK, larmorHz };
