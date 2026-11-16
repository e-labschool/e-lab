// ONE source of physical constants for every atomic-structure simulation
// (Build an Atom, Electron Configuration, Ionization Energy, Atomic Spectra Lab,
// Wave Explorer, Orbital Explorer).
//
// DECISION (documented in docs/sim-review/atomic-fixes.md, to be confirmed by the owner):
//  * CALCULATIONS use CODATA 2018 values (h, c, e, k_B and N_A are exact in the SI since 2019).
//    This keeps hydrogen line positions within 0.03 % of the literature (H-alpha 656.47 nm vacuum).
//  * DISPLAYED "show the working" numbers use the IB data-booklet roundings (IB_BOOKLET) so a student
//    repeating the calculation by hand gets the same digits as the screen.
// Nothing in the simulations may declare its own c, h, e, R_H.

export const CODATA = Object.freeze({
  c: 299792458, // m s^-1 (exact)
  h: 6.62607015e-34, // J s (exact)
  e: 1.602176634e-19, // C = J per eV (exact)
  NA: 6.02214076e23, // mol^-1 (exact)
  // Hydrogen (infinite nuclear mass) ground-state ionisation energy = Rydberg energy h c R_inf
  rydbergJ: 2.1798723611035e-18, // J
});

export const IB_BOOKLET = Object.freeze({
  c: 3.0e8,
  h: 6.63e-34,
  e: 1.60e-19,
  NA: 6.02e23,
});

export const C = CODATA.c;
export const H = CODATA.h;
export const E_CHARGE = CODATA.e;
export const AVOGADRO = CODATA.NA;
export const J_PER_EV = CODATA.e;
/** Rydberg energy for infinite nuclear mass, eV (13.6057). */
export const RYDBERG_INF_EV = CODATA.rydbergJ / CODATA.e;
/** Hydrogen-1 ionisation energy in eV with the finite proton mass (reduced-mass correction): 13.5984. Used for all hydrogen levels. */
export const RYDBERG_EV = RYDBERG_INF_EV / (1 + 5.44617021e-4);
/** hc in eV nm (1239.84...). */
export const HC_EV_NM = (CODATA.h * CODATA.c) / CODATA.e * 1e9;

export const evToJ = (ev) => ev * J_PER_EV;
export const jToEv = (j) => j / J_PER_EV;
/** Photon energy in eV for a wavelength in nm. */
export const wavelengthNmToEv = (nm) => HC_EV_NM / nm;
/** Wavelength in nm for a photon energy in eV. */
export const evToWavelengthNm = (ev) => HC_EV_NM / ev;
export const frequencyHz = (nm) => C / (nm * 1e-9);
/** kJ mol^-1 per eV per atom. */
export const KJ_MOL_PER_EV = (CODATA.e * CODATA.NA) / 1000;
export const evToKjPerMol = (ev) => ev * KJ_MOL_PER_EV;
export const kjPerMolToEv = (kj) => kj / KJ_MOL_PER_EV;

/** Hydrogen level energy in eV (negative), n >= 1. */
export const hydrogenLevelEv = (n) => -RYDBERG_EV / (n * n);
/** Energy released/absorbed for n_hi -> n_lo, eV (positive). */
export const hydrogenTransitionEv = (nLo, nHi) => RYDBERG_EV * (1 / (nLo * nLo) - 1 / (nHi * nHi));
