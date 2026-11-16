// The single authoritative atom state -- {protons, neutrons, electrons}
// only. Every other value (atomic number, mass number, net charge,
// element identity, nuclide name, atom/ion classification) is derived
// fresh here from those three numbers, never independently stored, so
// nothing can drift out of sync with what's actually on screen.
import { elementByAtomicNumber } from "../data/elementLookup.js";
import { formatCharge as sharedFormatCharge } from "../../../lib/atomic/format.js";

export function createAtomState(protons, neutrons, electrons) {
  return { protons, neutrons, electrons };
}

export const CARBON_12 = createAtomState(6, 6, 6);
export const EMPTY_ATOM = createAtomState(0, 0, 0);

/** Every derived value, computed in one place from the three raw
 * counts. `element` is null when protons === 0 (no element exists yet
 * -- never invented). */
export function deriveAtom({ protons, neutrons, electrons }) {
  const atomicNumber = protons;
  const massNumber = protons + neutrons;
  const netCharge = protons - electrons;
  const element = protons > 0 ? elementByAtomicNumber(protons) : null;
  const nuclideName = element ? `${element.name}-${massNumber}` : null;
  const classification = protons === 0 ? null : netCharge === 0 ? "neutral" : netCharge > 0 ? "cation" : "anion";

  return {
    protons,
    neutrons,
    electrons,
    atomicNumber,
    massNumber,
    netCharge,
    element, // { atomicNumber, symbol, name, period, group, block } | null
    nuclideName, // e.g. "Carbon-14" | null
    classification, // "neutral" | "cation" | "anion" | null
  };
}

/** Net charge in IB notation (2+, −, 3−); one shared formatter. Empty string for a neutral species. */
export function formatCharge(netCharge) {
  return netCharge === 0 ? "" : sharedFormatCharge(netCharge);
}
