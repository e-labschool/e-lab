// Physical constants for the Mole Lab.  The Avogadro constant is the exact SI value and comes from the SAME module every
// other atomic / gas simulation uses (src/lib/atomic/constants.js, CODATA 2018 = 2019 SI redefinition), never re-declared.
import { CODATA } from "../../../lib/atomic/constants.js";

/** Avogadro constant, mol^-1 (exact by definition). */
export const AVOGADRO = CODATA.NA;
if (AVOGADRO !== 6.02214076e23) throw new Error("Avogadro constant changed; Mole Lab requires the exact SI value 6.02214076e23");

/** Molar gas constant, J mol^-1 K^-1 (CODATA 2018: N_A * k_B, both exact). */
export const GAS_CONSTANT_R = 8.314462618;

/** RTP convention used by default (spec D, Stage 4): 24.0 dm3 mol^-1.  It is an APPROXIMATE convention, not a law of nature. */
export const MOLAR_VOLUME_RTP_DM3 = 24.0;

/** Display string required by spec A1. */
export const AVOGADRO_DISPLAY = "6.022 × 10²³";
export const MOLE_DEFINITION = "1 mole = 6.022 × 10²³ specified entities";

/** Celsius -> kelvin offset. */
export const KELVIN_OFFSET = 273.15;
