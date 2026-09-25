// Hydrogen energy levels -- E_n = -13.6 eV / n^2. This formula is
// scientifically valid ONLY for hydrogen (a one-electron system);
// deliberately never applied to sodium/helium/neon elsewhere in this
// engine, which use curated real spectral data instead (see
// data/spectra.js).
import { RYDBERG_EV } from "./scientificConstants.js";

export function hydrogenEnergyEv(n) {
  if (n === Infinity) return 0;
  return -RYDBERG_EV / (n * n);
}

/** Magnitude of the energy difference between two levels, in eV --
 * always positive, since a "gap" has no sign; direction (absorption vs
 * emission) is a separate concern handled by the caller. */
export function transitionEnergyEv(nFrom, nTo) {
  return Math.abs(hydrogenEnergyEv(nTo) - hydrogenEnergyEv(nFrom));
}
