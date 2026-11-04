// Physical constants and the pure field / frequency / energy relations of proton NMR.
// No React, no three. Tested by scripts/test-nmr-physics.mjs.
//
// CODATA 2018 gives the proton gyromagnetic ratio as 2.675 221 874 4(18) x 10^8 rad s^-1 T^-1; the value used here is
// the 7-digit rounding 2.675222e8, i.e. gamma / 2 pi = 42.5775 MHz T^-1.

export const GAMMA_H1 = 2.675222e8; // rad s^-1 T^-1 (angular gyromagnetic ratio of 1H)
export const H_PLANCK = 6.62607015e-34; // J s (exact, SI 2019)
export const HBAR = H_PLANCK / (2 * Math.PI);
export const K_BOLTZMANN = 1.380649e-23; // J K^-1 (exact, SI 2019)
export const EV = 1.602176634e-19; // J per eV (exact)

export const B0_MIN = 1; // tesla, educational range
export const B0_MAX = 14;
export const B0_DEFAULT = 9.4; // tesla, ~400 MHz for 1H
export const TEMPERATURE_K = 298; // sample temperature assumed by the model (stated in the UI)

/** gamma / 2 pi in MHz per tesla (42.577...). */
export const GAMMA_BAR_MHZ_PER_T = GAMMA_H1 / (2 * Math.PI) / 1e6;

export const clampB0 = (b0) => Math.min(B0_MAX, Math.max(B0_MIN, Number.isFinite(b0) ? b0 : B0_DEFAULT));

/** Larmor (resonance) frequency nu0 = gamma B0 / 2 pi, in Hz. */
export const larmorHz = (b0Tesla) => (GAMMA_H1 * b0Tesla) / (2 * Math.PI);
export const larmorMHz = (b0Tesla) => larmorHz(b0Tesla) / 1e6;
/** Angular Larmor frequency omega0 = gamma B0, in rad/s. */
export const larmorOmega = (b0Tesla) => GAMMA_H1 * b0Tesla;
/** Field (tesla) at which 1H resonates at the given operating frequency (MHz). */
export const b0ForMHz = (mhz) => (mhz * 1e6 * 2 * Math.PI) / GAMMA_H1;

/** Energy gap between the alpha and beta states, Delta E = h nu0 = gamma hbar B0, in joules. */
export const energyGapJ = (b0Tesla) => H_PLANCK * larmorHz(b0Tesla);
export const energyGapEV = (b0Tesla) => energyGapJ(b0Tesla) / EV;
/** Magnitude of the z-component of the proton magnetic moment, gamma hbar / 2, in J/T (1.4106e-26). */
export const MU_Z = (GAMMA_H1 * HBAR) / 2;

/** Operating-frequency label such as "400 MHz instrument" -> nearest "marketing" class, for display only. */
export const nominalFrequencyMHz = (b0Tesla) => Math.round(larmorMHz(b0Tesla));

const SUP = { "-": "\u207B", 0: "\u2070", 1: "\u00B9", 2: "\u00B2", 3: "\u00B3", 4: "\u2074", 5: "\u2075", 6: "\u2076", 7: "\u2077", 8: "\u2078", 9: "\u2079" };
/** Scientific notation with unicode superscripts: 3.22e-5 -> "3.22\u00D710\u207B\u2075" (no locale dependence). */
export function sci(x, digits = 2) {
  if (!Number.isFinite(x) || x === 0) return "0";
  let e = Math.floor(Math.log10(Math.abs(x))); let m = x / 10 ** e;
  if (Number(m.toFixed(digits)) >= 10) { m /= 10; e += 1; }
  return `${m.toFixed(digits)}\u00D710${String(e).split("").map((c) => SUP[c]).join("")}`;
}
