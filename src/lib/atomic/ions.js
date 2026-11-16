// Charge policy for monatomic ions: what is "physically sensible" in this teaching context.
//
// STRICT BY DEFAULT. A student may only build charges that appear in chemistry. Anything else is refused
// with an explanation (never silently disabled).
//  * Anions: only non-metals can gain electrons: the anion charge is (18 - group) for groups 15-17
//    (N3-, O2-, F-), the 4- of C and Si (carbide/silicide), H- (hydride). Metals and noble gases: none.
//  * Cations: the highest oxidation state quoted for the element in standard references
//    (Greenwood & Earnshaw) for Z <= 36, e.g. Na +1, Al +3, Fe +6, Mn +7. Non-metals O, F, N ... form no
//    simple cation in compounds (0). Above Z = 36 the maximum is an approximation (flagged).
// This is a documented approximation, not a physical law: gas-phase O2- is not even bound; IB treats it as
// the ion in an ionic lattice.
import { getElement } from "../../data/chemistry/elements.js";

// Highest common monatomic cation charge for Z <= 36 (0 = does not form a cation in chemistry).
const MAX_CATION = {
  1: 1, 2: 0, 3: 1, 4: 2, 5: 3, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
  11: 1, 12: 2, 13: 3, 14: 4, 15: 0, 16: 0, 17: 0, 18: 0,
  19: 1, 20: 2, 21: 3, 22: 4, 23: 5, 24: 6, 25: 7, 26: 6, 27: 5, 28: 4, 29: 3, 30: 2,
  31: 3, 32: 4, 33: 3, 34: 0, 35: 0, 36: 0,
};
const ANION_ELEMENTS = new Set([1, 6, 7, 8, 9, 14, 15, 16, 17, 33, 34, 35, 52, 53]);
const MAX_ANION_OVERRIDE = { 1: 1, 6: 4, 14: 4 };

export function maxAnionCharge(z) {
  if (!ANION_ELEMENTS.has(z)) return 0;
  if (MAX_ANION_OVERRIDE[z]) return MAX_ANION_OVERRIDE[z];
  const g = getElement(z)?.group;
  return g ? 18 - g : 0;
}

export function maxCationCharge(z) {
  if (z in MAX_CATION) return MAX_CATION[z];
  const el = getElement(z);
  if (!el || !el.group) return el ? 3 : 0; // f-block: +3 is the characteristic charge
  if (el.group <= 2) return el.group;
  if (el.group <= 12) return Math.min(el.group, 8);
  if (el.group === 13 || el.group === 14) return el.group - 10;
  return el.group === 15 ? 3 : 0;
}

/** { minCharge (<= 0), maxCharge (>= 0), approximate } */
export function chargeLimits(z) {
  return { minCharge: -maxAnionCharge(z), maxCharge: maxCationCharge(z), approximate: z > 36 };
}

/** The refusal sentence for asking for `charge` on element z, or null when it is allowed. */
export function chargeRefusal(z, charge) {
  const el = getElement(z);
  if (!el) return "Choose an element first.";
  const { minCharge, maxCharge } = chargeLimits(z);
  const sym = `${el.name.toLowerCase()}`;
  if (charge > maxCharge) {
    if (maxCharge === 0) return `${el.name} does not form a positive ion in chemistry: it is a ${nonmetalWord(z)} that gains electrons instead.`;
    return `${el.name} forms ions up to ${maxCharge}+ at most. Removing more electrons would break into the inner shell, which costs far more energy (see the successive ionisation energies), so no ${maxCharge + 1}+ ${sym} ion is found in compounds.`;
  }
  if (charge < minCharge) {
    if (minCharge === 0) return `${el.name} does not gain electrons to form a stable negative ion: ${z === 2 || [10, 18, 36].includes(z) ? "it already has a full outer shell" : "it is a metal and loses electrons instead"}.`;
    return `${el.name} can gain at most ${-minCharge} electron${-minCharge === 1 ? "" : "s"}: that gives it a full outer shell. A further electron would have to start a new shell, so no ${-minCharge + 1}− ${sym} ion is found in compounds.`;
  }
  return null;
}
function nonmetalWord(z) {
  return [2, 10, 18, 36].includes(z) ? "noble gas with a full outer shell" : "non-metal";
}
