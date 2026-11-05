// Finite-width absorption response of one vibrational transition (pure). The infrared radiation has wavenumber nu; the vibration has wavenumber nu0.
// A transition absorbs when (1) the photon energy matches the level spacing  dE = h c nu0  and (2) the vibration changes the dipole moment.
//   match(nu)       Lorentzian line shape, peak 1 at nu0, half-width at half-maximum `hwhm`: match = 1 / (1 + ((nu - nu0)/hwhm)^2)
//   absorption(nu)  = match(nu) when the mode is IR-active, 0 otherwise  (a perfect frequency match does not help without a dipole change)
// The width is a TEACHING width (the slider needs a visible line): isolated gas-phase lines are far narrower (rotational structure, Doppler
// and pressure widths well below 1 cm^-1 to a few cm^-1), liquids / solids are broader.
export const TEACHING_HWHM = 40; // cm^-1

export const lorentz = (x, x0, hwhm) => 1 / (1 + ((x - x0) / hwhm) ** 2);
export const gauss = (x, x0, fwhm) => Math.exp(-4 * Math.LN2 * ((x - x0) / fwhm) ** 2);

export const frequencyMatch = (nu, nu0, hwhm = TEACHING_HWHM) => lorentz(nu, nu0, hwhm);
export const absorption = (nu, nu0, active, hwhm = TEACHING_HWHM) => (active ? lorentz(nu, nu0, hwhm) : 0);

/** Qualitative state used by the UI. */
export function absorptionState(nu, nu0, active, hwhm = TEACHING_HWHM) {
  const m = frequencyMatch(nu, nu0, hwhm);
  if (m >= 0.85) return active ? "absorbed" : "match-inactive";
  if (m >= 0.3) return active ? "near" : "near-inactive";
  return "off";
}
