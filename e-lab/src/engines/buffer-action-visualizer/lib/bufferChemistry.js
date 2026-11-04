// Chemistry for the Buffer Action Visualizer — generalized to "a weak
// acid/conjugate base pair", so both the acid buffer (CH3COOH/CH3COO-)
// and the basic buffer (NH3/NH4+) run through the EXACT SAME reaction
// and pH functions, just with a different pKa and different species
// labels. Verified numerically (see the accompanying test notes) for
// both systems, including full depletion in both directions, before
// this file was finalized.

export const KW = 1.0e-14;
const KA_ETHANOIC = 1.8e-5;
const KB_AMMONIA = 1.8e-5;

export const FLASK_VOLUME_L = 0.025; // 25 mL, matching the project's other titration sims
export const INITIAL_CONCENTRATION = 0.1; // mol/L, acid-form = base-form initially

export const ADDITION_SIZES = {
  "Small amount": 0.0002,
  "Medium amount": 0.0006,
};

// A component is "depleted" (buffer capacity exceeded) once it falls
// below this fraction of its initial amount — determined from ACTUAL
// remaining composition, never a press count.
const DEPLETION_FRACTION = 0.05;

// One entry per selectable buffer type. "acidLabel"/"baseLabel" are the
// conjugate-ACID and conjugate-BASE forms respectively (NH4+ is the acid
// form of the NH3/NH4+ pair, even though the overall system is
// colloquially "basic") — this is what lets addAcidToBuffer/
// addBaseToBuffer stay completely generic: H+ always converts
// base-form -> acid-form; OH- always converts acid-form -> base-form,
// regardless of which real species that represents.
export const BUFFER_SYSTEMS = {
  acid: {
    id: "acid",
    label: "Acid Buffer",
    systemLabel: "CH\u2083COOH / CH\u2083COO\u207B",
    pKa: -Math.log10(KA_ETHANOIC),
    acidLabel: "CH\u2083COOH",
    acidShort: "HA",
    baseLabel: "CH\u2083COO\u207B",
    baseShort: "A\u207B",
    spectatorLabel: "Na\u207A",
    spectatorShort: "Na\u207A",
    spectatorNote: "spectator ion",
  },
  basic: {
    id: "basic",
    label: "Basic Buffer",
    systemLabel: "NH\u2083 / NH\u2084\u207A",
    pKa: KW_PKA_FROM_KB(KB_AMMONIA),
    acidLabel: "NH\u2084\u207A",
    acidShort: "NH\u2084\u207A",
    baseLabel: "NH\u2083",
    baseShort: "NH\u2083",
    spectatorLabel: "Cl\u207B",
    spectatorShort: "Cl\u207B",
    spectatorNote: "spectator ion",
  },
};

function KW_PKA_FROM_KB(kb) {
  // pKa(conjugate acid) = pKw - pKb, i.e. Ka(BH+) = Kw / Kb(B)
  const pKb = -Math.log10(kb);
  const pKw = -Math.log10(KW);
  return pKw - pKb;
}

/** pH of a buffer beaker, general to any acid/base pKa. Uses
 * Henderson-Hasselbalch while both components remain appreciable;
 * switches to excess-strong-acid/base once one is depleted, which is
 * what keeps this numerically stable right through the depletion
 * transition instead of dividing by ~zero. */
export function bufferPH(acidMoles, baseMoles, excessStrong, pKa) {
  if (Math.abs(excessStrong) < 1e-12) {
    if (acidMoles < 1e-12) return 14;
    if (baseMoles < 1e-12) return 0;
    return pKa + Math.log10(baseMoles / acidMoles);
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
  return 7;
}

export function createInitialState(systemId = "acid") {
  const system = BUFFER_SYSTEMS[systemId];
  const acidMoles = INITIAL_CONCENTRATION * FLASK_VOLUME_L;
  const baseMoles = INITIAL_CONCENTRATION * FLASK_VOLUME_L;
  const initialPH = bufferPH(acidMoles, baseMoles, 0, system.pKa);
  return {
    systemId,
    buffer: { acidMoles, baseMoles, excessStrong: 0 },
    // The unbuffered side starts with the tiny net-H pool that alone
    // gives the SAME initial pH as the buffer — a real amount, not a
    // label — and has no conjugate reservoir, so it responds directly
    // and dramatically to any addition.
    unbuffered: { netH: Math.pow(10, -initialPH) * FLASK_VOLUME_L },
  };
}

/** H+ always converts base-form -> acid-form: CH3COO-+H+->CH3COOH, or
 * NH3+H+->NH4+ -- same function for both systems. */
export function addAcidToBuffer(buffer, amountMoles) {
  const consumed = Math.min(amountMoles, buffer.baseMoles);
  const baseMoles = buffer.baseMoles - consumed;
  const acidMoles = buffer.acidMoles + consumed;
  const leftover = amountMoles - consumed;
  return { acidMoles, baseMoles, excessStrong: buffer.excessStrong + leftover };
}

/** OH- always converts acid-form -> base-form: CH3COOH+OH-->CH3COO-+H2O,
 * or NH4++OH-->NH3+H2O. */
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
  const initial = INITIAL_CONCENTRATION * FLASK_VOLUME_L;
  return buffer.baseMoles < initial * DEPLETION_FRACTION || buffer.acidMoles < initial * DEPLETION_FRACTION;
}

/** Representative (never literal) particle counts, capped so the
 * visualization stays clean regardless of the actual mole amount. */
export function getBufferParticleCounts(buffer, maxPerSpecies = 6) {
  const total = buffer.acidMoles + buffer.baseMoles;
  if (total < 1e-15) return { acid: 0, base: 0 };
  const acidFraction = buffer.acidMoles / total;
  const acid = Math.max(buffer.acidMoles > 1e-12 ? 1 : 0, Math.round(maxPerSpecies * acidFraction));
  const base = Math.max(buffer.baseMoles > 1e-12 ? 1 : 0, Math.round(maxPerSpecies * (1 - acidFraction)));
  return { acid, base };
}
