// Adapter over the SHARED electron-configuration algorithm (src/lib/atomic/electronConfiguration.js).
// There is ONE algorithm for atoms and ions in the whole app; this file only reshapes its result for the
// Explorer's components. No React, no DOM, no filling logic of its own.
import { getElement } from "../../../data/chemistry/elements.js";
import {
  SUBSHELL_LETTERS as LETTERS, SUBSHELL_CAPACITY as CAP, ORBITAL_COUNT as ORB, MADELUNG_ORDER,
  speciesOccupancy, fillingOrder, writingOrder, shellArrangement, fullString, fillingString, shorthandString, orbitalBoxes, isExceptionElement,
  explainSpecies, unpairedElectrons,
} from "../../../lib/atomic/electronConfiguration.js";

export const SUBSHELL_LETTERS = Object.fromEntries(LETTERS.map((c, i) => [i, c]));
export const SUBSHELL_CAPACITY = Object.fromEntries(CAP.map((c, i) => [i, c]));
export const ORBITAL_COUNT = Object.fromEntries(ORB.map((c, i) => [i, c]));
export { MADELUNG_ORDER };

/** Hund's-rule box occupation: [{ electrons, spins: ["up"] | ["up","down"] | [] }] per orbital. */
export function distributeElectronsInOrbitals(l, electronCount) {
  return orbitalBoxes(l, electronCount).map((b) => ({ electrons: (b.up ? 1 : 0) + (b.down ? 1 : 0), spins: [...(b.up ? ["up"] : []), ...(b.down ? ["down"] : [])] }));
}

function describeValence(element, display) {
  const maxN = Math.max(...display.map((s) => s.n));
  if (element.block === "s" || element.block === "p") {
    const k = display.filter((s) => s.n === maxN).reduce((sum, s) => sum + s.electrons, 0);
    return { kind: "simple", valenceElectronCount: k, note: `${k} valence electron${k === 1 ? "" : "s"} in the outermost shell (n = ${maxN}).` };
  }
  if (element.block === "d") {
    return { kind: "d-block", valenceElectronCount: null, note: "Transition elements: the outer ns electrons and the (n-1)d electrons have similar energies, so several are involved in bonding and the element shows variable oxidation states." };
  }
  return { kind: "f-block", valenceElectronCount: null, note: "f-block: the (n-2)f, (n-1)d and ns subshells are close in energy, so the number of valence electrons depends on the compound." };
}

/** Configuration of the atom (charge 0) or monatomic ion with atomic number z. null when impossible. */
export function buildConfiguration(atomicNumber, charge = 0) {
  const element = getElement(atomicNumber);
  const sp = speciesOccupancy(atomicNumber, charge);
  if (!element || !sp) return null;
  const filling = fillingOrder(sp.occupancy);
  const display = writingOrder(sp.occupancy);
  return {
    element, charge, electrons: sp.electrons,
    isException: charge === 0 && isExceptionElement(atomicNumber),
    subshellsFillingOrder: filling,
    subshellsDisplayOrder: display,
    orbitals: display.map((s) => ({ ...s, label: `${s.n}${LETTERS[s.l]}`, orbitals: distributeElectronsInOrbitals(s.l, s.electrons) })),
    shells: shellArrangement(sp.occupancy),
    valence: describeValence(element, display.length ? display : [{ n: 1, electrons: 0 }]),
    configurationString: fullString(sp.occupancy),
    fillingString: fillingString(sp.occupancy),
    shorthandString: shorthandString(sp.occupancy, sp.electrons, { strict: charge === 0 }),
    unpaired: unpairedElectrons(sp.occupancy),
    notes: explainSpecies(atomicNumber, charge),
    removed: sp.removed, added: sp.added,
  };
}

export const buildIonConfiguration = buildConfiguration;
