// Build an Atom's electron-structure panel: a thin adapter over the SHARED algorithm
// (src/lib/atomic/electronConfiguration.js). The configuration of an ION is computed from the neutral atom
// by the IB removal rule (outermost shell first, so 4s before 3d), never from the electron COUNT alone.
// The old count-based module (wrong for Fe2+, Cu+, Ga3+, Zn2+ ...) was removed.
import { describeSpecies, shellMax, speciesOccupancy, shellArrangement as shared, writingOrder } from "../../../lib/atomic/electronConfiguration.js";
import { toSuperscript } from "../../../lib/atomic/format.js";

export { shellMax };
export const MAX_ELECTRONS = 40;
export const superscript = toSuperscript;

/** Electrons per shell for the drawing of the SPECIES (z protons, `charge`). */
export function shellArrangement(electrons, protons = electrons, charge = protons - electrons) {
  if (electrons === 0) return [];
  const sp = speciesOccupancy(protons || electrons, protons ? charge : 0);
  return sp ? shared(sp.occupancy) : [];
}

/** Everything the "shells and configuration" panel shows. */
export function describeElectrons(electrons, protons = electrons) {
  if (!Number.isInteger(electrons) || electrons < 0 || electrons > MAX_ELECTRONS) throw new RangeError(`electron count must be an integer 0-${MAX_ELECTRONS}, got ${electrons}`);
  const netCharge = protons - electrons;
  const isIon = protons > 0 && netCharge !== 0;
  if (electrons === 0) return { electrons, protons, netCharge, isIon, none: true, shells: [], arrangement: "", configuration: "", shorthand: null, ionNote: null, notes: [] };
  const sp = describeSpecies(protons || electrons, protons ? netCharge : 0);
  const shells = sp.shells.map((count, i) => ({ n: i + 1, count, max: shellMax(i + 1), full: count === shellMax(i + 1), empty: count === 0 }));
  return {
    electrons, protons, netCharge, isIon, none: false, shells,
    arrangement: sp.shells.join(","),
    configuration: sp.full,
    shorthand: sp.shorthand,
    ionNote: null,
    notes: sp.notes,
    isException: sp.isException,
    unpaired: sp.unpaired,
  };
}

export { writingOrder };

// ---- neutral-atom helpers by ELECTRON COUNT (ground state of the neutral atom with that many electrons).
// Kept for the hand-table audit (scripts/test-electron-config.mjs). They are NOT used for ions.
import { neutralOccupancy, fullString, shorthandString, subshellLabel } from "../../../lib/atomic/electronConfiguration.js";
export function groundStateSubshells(electrons) {
  return writingOrder(neutralOccupancy(electrons)).map((s) => ({ n: s.n, l: s.l, label: subshellLabel(s.n, s.l), count: s.electrons }));
}
export const fullConfiguration = (electrons) => (electrons === 0 ? "" : fullString(neutralOccupancy(electrons)));
export const shorthandConfiguration = (electrons) => (electrons <= 2 ? null : shorthandString(neutralOccupancy(electrons), electrons, { strict: true }));
