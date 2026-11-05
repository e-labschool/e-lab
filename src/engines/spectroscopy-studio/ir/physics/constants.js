// Physical constants and unit conversions of the IR module (SI values, CODATA 2018). Pure data.
export const H_PLANCK = 6.62607015e-34; // J s
export const C_LIGHT_CM = 2.99792458e10; // cm / s  (wavenumbers are in cm^-1)
export const K_BOLTZMANN = 1.380649e-23; // J / K
export const N_AVOGADRO = 6.02214076e23; // 1 / mol
export const AMU = 1.66053906660e-27; // kg
export const ANGSTROM = 1e-10; // m

/** Relative atomic masses used for the dynamics (u). Most abundant isotopes (IUPAC, rounded): the gas-phase literature fundamentals refer to them. */
export const MASS_U = { H: 1.00782503, C: 12.0, N: 14.0030740, O: 15.9949146, Cl: 34.9688527 };

/** nu_tilde (cm^-1) -> frequency (Hz) */
export const frequencyHz = (wn) => wn * C_LIGHT_CM;
/** Photon / transition energy dE = h c nu_tilde (J) for one molecule. */
export const energyJ = (wn) => H_PLANCK * C_LIGHT_CM * wn;
/** Same, per mole (kJ/mol). */
export const energyKJmol = (wn) => (energyJ(wn) * N_AVOGADRO) / 1000;
/** Wavelength in micrometres. */
export const wavelengthUm = (wn) => 1e4 / wn;
/** Boltzmann population ratio N(v=1)/N(v=0) of a harmonic oscillator at T (K). */
export const populationRatio = (wn, T = 298.15) => Math.exp(-energyJ(wn) / (K_BOLTZMANN * T));
