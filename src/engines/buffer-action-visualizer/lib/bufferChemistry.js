// Chemistry for the Buffer Action Visualizer — CH3COOH/CH3COO- buffer
// system, compared against an unbuffered solution adjusted to the same
// initial pH. Verified numerically before this file was written: pH
// stays stable through the full depletion transition, never
// NaN/Infinity, and buffer capacity is determined from ACTUAL remaining
// composition, never a press count.
//
// Structured deliberately so a future R3.1.17 extension (adjustable
// concentrations, different weak acid/base systems, adjustable pKa) only
// needs to change the INITIAL_* constants and the species passed into
// createInitialState() — the reaction/pH logic itself is already general
// to "a weak acid + its conjugate base", not hardcoded to ethanoic acid
// specifically anywhere except the constants below.

export const KW = 1.0e-14;
export const KA = 1.8e-5;
export const PKA = -Math.log10(KA);

export const FLASK_VOLUME_L = 0.025; // 25 mL, matching the project's other titration sims
export const INITIAL_CONCENTRATION = 0.1; // mol/L, CH3COOH = CH3COO- initially
export const INITIAL_ACID_MOLES = INITIAL_CONCENTRATION * FLASK_VOLUME_L;
export const INITIAL_BASE_MOLES = INITIAL_CONCENTRATION * FLASK_VOLUME_L;

export const ADDITION_SIZES = {
  Small: 0.0002,
  Medium: 0.0006,
};

// A component is "depleted" (buffer capacity exceeded) once it falls
// below this fraction of its initial amount — not "reaches exactly
// zero", so the warning reflects a genuinely diminished reservoir, not a
// single last molecule.
const DEPLETION_FRACTION = 0.05;

/** pH of the buffer side. Uses Henderson-Hasselbalch while both
 * components remain in appreciable amounts; once one is depleted (or
 * fully consumed), switches to treating the remaining excess strong
 * acid/base as the dominant [H+]/[OH-] source instead — this is what
 * keeps the model numerically stable and scientifically honest right
 * through the depletion transition, rather than dividing by ~zero. */
export function bufferPH(acidMoles, baseMoles, excessStrong) {
  if (Math.abs(excessStrong) < 1e-12) {
    if (acidMoles < 1e-12) return 14;
    if (baseMoles < 1e-12) return 0;
    return PKA + Math.log10(baseMoles / acidMoles);
  }
  if (excessStrong > 0) {
    return -Math.log10(excessStrong / FLASK_VOLUME_L);
  }
  const pOH = -Math.log10(-excessStrong / FLASK_VOLUME_L);
  return 14 - pOH;
}

export function unbufferedPH(netH) {
  if (netH > 1e-14) return -Math.log10(netH / FLASK_VOLUME_L);
  if (netH < -1e-14) {
    const pOH = -Math.log10(-netH / FLASK_VOLUME_L);
    return 14 - pOH;
  }
  return 7; // exactly neutral — never actually reached by addition, but keeps the function total
}

export function createInitialState() {
  const initialPH = bufferPH(INITIAL_ACID_MOLES, INITIAL_BASE_MOLES, 0);
  return {
    buffer: { acidMoles: INITIAL_ACID_MOLES, baseMoles: INITIAL_BASE_MOLES, excessStrong: 0 },
    // The unbuffered side starts with the tiny [H+] pool that alone
    // would give the SAME initial pH as the buffer — a real, if small,
    // amount of H+, not an arbitrary label. It has no conjugate-base
    // reservoir, so any addition affects it directly and dramatically,
    // which is the entire pedagogical point of the comparison.
    unbuffered: { netH: Math.pow(10, -initialPH) * FLASK_VOLUME_L },
  };
}

/** Stoichiometric neutralization FIRST (CH3COO- + H+ -> CH3COOH), THEN
 * the pH is derived from whatever composition results — never the
 * reverse. */
export function addAcidToBuffer(buffer, amountMoles) {
  const consumed = Math.min(amountMoles, buffer.baseMoles);
  const baseMoles = buffer.baseMoles - consumed;
  const acidMoles = buffer.acidMoles + consumed;
  const leftover = amountMoles - consumed;
  return { acidMoles, baseMoles, excessStrong: buffer.excessStrong + leftover };
}

/** CH3COOH + OH- -> CH3COO- + H2O, same principle in the other direction. */
export function addBaseToBuffer(buffer, amountMoles) {
  const consumed = Math.min(amountMoles, buffer.acidMoles);
  const acidMoles = buffer.acidMoles - consumed;
  const baseMoles = buffer.baseMoles + consumed;
  const leftover = amountMoles - consumed;
  return { acidMoles, baseMoles, excessStrong: buffer.excessStrong - leftover };
}

export function addAcidToUnbuffered(unbuffered, amountMoles) {
  return { netH: unbuffered.netH + amountMoles };
}
export function addBaseToUnbuffered(unbuffered, amountMoles) {
  return { netH: unbuffered.netH - amountMoles };
}

export function isBufferCapacityExceeded(buffer) {
  return buffer.baseMoles < INITIAL_BASE_MOLES * DEPLETION_FRACTION || buffer.acidMoles < INITIAL_ACID_MOLES * DEPLETION_FRACTION;
}

/** A representative (never literal) particle count per species, capped
 * so the visualization stays clean regardless of how large the actual
 * mole amount is — the same principle already used in the Equivalence
 * Point simulation's ion spheres. */
export function getBufferParticleCounts(buffer, maxPerSpecies = 7) {
  const total = buffer.acidMoles + buffer.baseMoles;
  if (total < 1e-15) return { acid: 0, base: 0 };
  const acidFraction = buffer.acidMoles / total;
  const acid = Math.max(buffer.acidMoles > 1e-12 ? 1 : 0, Math.round(maxPerSpecies * acidFraction));
  const base = Math.max(buffer.baseMoles > 1e-12 ? 1 : 0, Math.round(maxPerSpecies * (1 - acidFraction)));
  return { acid, base };
}
