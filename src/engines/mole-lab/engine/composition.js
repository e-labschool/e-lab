// Module 2 -- FORMULA COMPOSITION (the "Counting View", spec A4).
//
// n(element) = subscript x n(substance).  This is a COUNTING operation on a formula.  It is NOT a chemical decomposition:
// 1 mol H2O gives "2 mol H atoms + 1 mol O atoms", never "2 mol H2 + 1 mol O2".  Amounts are integer quanta, so the
// products of a subscript and an amount are exact.
import { getSubstance, atomEntityId, ionEntityId, COUNTING_ENTITIES } from "./substances.js";
import { fromQuanta, fmtMol } from "./numeric.js";
import { toUnicodeFormula } from "./formula.js";

/**
 * @typedef {{ element: string, perEntity: number, q: number, mol: number }} AtomLine
 * @typedef {{ formula: string, label: string, charge: number, perEntity: number, q: number, mol: number, entityId: string }} IonLine
 * @typedef {{ substanceId: string, q: number }} CountingPacket
 */

/** Composition of `q` quanta of a substance: its own entities, constituent atoms, constituent ions (ionic only), totals. */
export function composition(substanceId, q) {
  const s = getSubstance(substanceId);
  if (!Number.isInteger(q) || q < 0) throw new Error("composition: q must be a non-negative integer number of quanta");
  const atoms = Object.entries(s.composition).map(([element, perEntity]) => ({ element, perEntity, q: perEntity * q, mol: fromQuanta(perEntity * q) }));
  const ions = (s.ions ?? []).map((i) => ({
    formula: i.formula, label: i.label, charge: i.charge, perEntity: i.count, q: i.count * q, mol: fromQuanta(i.count * q), entityId: ionEntityId(i),
  }));
  const totalAtomsQ = atoms.reduce((a, l) => a + l.q, 0);
  return { substanceId, entity: s.entity, entityQ: q, entityMol: fromQuanta(q), atoms, ions, totalAtomsQ, totalAtomsMol: fromQuanta(totalAtomsQ), kind: s.kind };
}

/**
 * The packets that "Separate into Counting Packets" produces.
 *  molecular -> one packet-set per element (atoms);  ionic / aqueous-ionic -> one per ion (formula units become ions);
 *  metallic  -> [] (a metal is already a mole of atoms; there is nothing smaller to count).
 * Never returns H2 or O2 for water (A4).
 */
export function countingPackets(substanceId, q) {
  const s = getSubstance(substanceId);
  if (s.kind === "molecular") return Object.entries(s.composition).map(([el, c]) => ({ substanceId: atomEntityId(el), q: c * q }));
  if (s.kind === "ionic" || s.kind === "aqueous-ionic") return s.ions.map((i) => ({ substanceId: ionEntityId(i), q: i.count * q }));
  return [];
}

/** Worked lines for the calculation panel, e.g. "n(H) = 2 × n(H₂O) = 2 × 0.50 mol = 1.00 mol". */
export function compositionWorking(substanceId, q) {
  const s = getSubstance(substanceId); const c = composition(substanceId, q); const f = s.formulaDisplay;
  const lines = [];
  if (s.kind === "metallic" || s.kind === "atomic-solid") {
    lines.push({ key: "self", text: `n(${s.formula}) = ${fmtMol(c.entityMol)} mol of ${s.formula} atoms (a metal is already a count of atoms)` });
    return lines;
  }
  if (s.kind === "molecular") {
    for (const a of c.atoms) lines.push({ key: a.element, text: a.perEntity === 1 ? `n(${a.element}) = n(${f}) = ${fmtMol(a.mol)} mol` : `n(${a.element}) = ${a.perEntity} × n(${f}) = ${a.perEntity} × ${fmtMol(c.entityMol)} mol = ${fmtMol(a.mol)} mol` });
  } else {
    for (const i of c.ions) lines.push({ key: i.label, text: i.perEntity === 1 ? `n(${i.label}) = n(${f}) = ${fmtMol(i.mol)} mol` : `n(${i.label}) = ${i.perEntity} × n(${f}) = ${i.perEntity} × ${fmtMol(c.entityMol)} mol = ${fmtMol(i.mol)} mol` });
  }
  return lines;
}

/** The subscript-vs-coefficient teaching statement (spec D Stage 1, "Educational explanation"). */
export function subscriptExplanation(substanceId) {
  const s = getSubstance(substanceId);
  const f = s.formulaDisplay;
  if (s.kind === "atomic-solid") return `${f} is modelled as atoms: its formula is just the symbol, so 1 mol is 1 mol of ${s.formula} atoms.`;
  if (s.kind === "metallic") return `${f} is a metal: its formula is just the symbol, so 1 mol is 1 mol of ${s.formula} atoms.`;
  const multi = Object.entries(s.composition).find(([, c]) => c > 1);
  const part = multi ? `the subscript ${toUnicodeFormula(String(multi[1]))} in ${f} means each ${s.entity.singular} contains ${multi[1]} ${multi[0]} atoms` : `each ${s.entity.singular} of ${f} contains one atom of each element shown`;
  return `A subscript counts atoms inside ONE ${s.entity.singular}: ${part}. The amount in mol (like a coefficient in an equation) says how many ${s.entity.plural} there are. Changing a subscript would change the substance; changing the amount does not.`;
}

export { COUNTING_ENTITIES };
