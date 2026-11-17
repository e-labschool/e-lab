// Module 9 -- REACTION STOICHIOMETRY.  Balanced equations as DATA, atom + charge balance checking, extent arithmetic.
// To add a reaction: add a record to REACTION_LIST; test-mole-lab-engine.mjs rejects any record that is not atom- and
// charge-balanced.  Species reference substance ids (substances.js), so formulas / molar masses come from ONE table.
//
// All amounts are integer quanta.  Moving an extent xi (in quanta) changes species i by nu_i * xi (integers), so atoms
// (and charge) are conserved EXACTLY by construction; `atomLedger` lets tests and the store prove it.
import { getSubstance } from "./substances.js";
import { toUnicodeFormula } from "./formula.js";

/** @typedef {{ id: string, coeff: number, side: "reactant"|"product", state: string }} Species */

const sp = (id, coeff, side, state) => ({ id, coeff, side, state });
const LIST = [
  { id: "water-synthesis", name: "Formation of water", species: [sp("H2", 2, "reactant", "g"), sp("O2", 1, "reactant", "g"), sp("H2O", 2, "product", "l")],
    notes: ["Hydrogen and oxygen mixtures can be explosive; this is a model of mole ratios, not a procedure."] },
  { id: "ammonia-synthesis", name: "Haber process (ammonia)", species: [sp("N2", 1, "reactant", "g"), sp("H2", 3, "reactant", "g"), sp("NH3", 2, "product", "g")],
    notes: ["The real process needs a catalyst, high pressure and moderate temperature and is an equilibrium; here we count moles in the idealised complete reaction."] },
  { id: "magnesium-oxide", name: "Burning magnesium", species: [sp("Mg", 2, "reactant", "s"), sp("O2", 1, "reactant", "g"), sp("MgO", 2, "product", "s")],
    notes: ["Burning magnesium is intensely bright and hot: never look directly at it."] },
  { id: "sodium-water", name: "Sodium with water", species: [sp("Na", 2, "reactant", "s"), sp("H2O", 2, "reactant", "l"), sp("NaOH_aq", 2, "product", "aq"), sp("H2", 1, "product", "g")],
    notes: ["Sodium reacts violently with water and is hazardous. NaOH forms as aqueous Na⁺ and OH⁻ ions, not a dry solid; the product packet is a conceptual mole summary."] },
];

export const REACTION_LIST = Object.freeze(LIST.map((r) => Object.freeze({ ...r, species: Object.freeze(r.species.map((s) => Object.freeze(s))) })));
export const REACTIONS = Object.freeze(Object.fromEntries(REACTION_LIST.map((r) => [r.id, r])));
export function getReaction(id) { const r = REACTIONS[id]; if (!r) throw new Error(`Unknown reaction "${id}"`); return r; }
export const reactants = (r) => r.species.filter((s) => s.side === "reactant");
export const products = (r) => r.species.filter((s) => s.side === "product");

const netCharge = (id) => { const s = getSubstance(id); return (s.ions ?? []).reduce((a, i) => a + i.charge * i.count, 0); };

/** Atom and charge totals each side, for an optional multiplier of the coefficients. */
export function checkBalance(reaction, scale = 1) {
  const atoms = { left: {}, right: {} }; const charge = { left: 0, right: 0 };
  for (const s of reaction.species) {
    const side = s.side === "reactant" ? "left" : "right"; const sub = getSubstance(s.id);
    for (const [el, c] of Object.entries(sub.composition)) atoms[side][el] = (atoms[side][el] || 0) + c * s.coeff * scale;
    charge[side] += netCharge(s.id) * s.coeff * scale;
  }
  const els = new Set([...Object.keys(atoms.left), ...Object.keys(atoms.right)]);
  const unbalanced = [...els].filter((e) => (atoms.left[e] || 0) !== (atoms.right[e] || 0));
  return { balanced: unbalanced.length === 0 && charge.left === charge.right, atoms, charge, unbalanced, chargeBalanced: charge.left === charge.right };
}

/** "2H₂(g) + O₂(g) → 2H₂O(l)" */
export function equationString(reaction, { states = true } = {}) {
  const term = (s) => { const sub = getSubstance(s.id); return `${s.coeff === 1 ? "" : s.coeff}${toUnicodeFormula(sub.formula)}${states ? `(${s.state})` : ""}`; };
  return `${reactants(reaction).map(term).join(" + ")} → ${products(reaction).map(term).join(" + ")}`;
}
/** Ion-level note for aqueous products ("NaOH(aq) = Na⁺(aq) + OH⁻(aq)"), or null. */
export function ionicNote(reaction) {
  const aq = reaction.species.filter((s) => s.side === "product" && getSubstance(s.id).kind === "aqueous-ionic");
  if (!aq.length) return null;
  return aq.map((s) => `${toUnicodeFormula(getSubstance(s.id).formula)}(aq) is present as ${getSubstance(s.id).ions.map((i) => `${i.label}(aq)`).join(" + ")}`).join("; ");
}

/** Total quanta of each ATOM type held in an amounts map { substanceId: q } (the conservation ledger). */
export function atomLedger(amountsQ) {
  const out = {};
  for (const [id, q] of Object.entries(amountsQ)) {
    if (!q) continue;
    for (const [el, c] of Object.entries(getSubstance(id).composition)) out[el] = (out[el] || 0) + c * q;
  }
  return out;
}
/** Net charge ledger (quanta x elementary charge). */
export function chargeLedger(amountsQ) { let t = 0; for (const [id, q] of Object.entries(amountsQ)) t += netCharge(id) * q; return t; }

/** Advance the reaction by `extentQ` quanta of extent.  Throws if any reactant would go negative. Returns a NEW amounts map. */
export function applyExtent(reaction, amountsQ, extentQ) {
  if (!Number.isInteger(extentQ) || extentQ < 0) throw new Error("applyExtent: extent must be a non-negative integer number of quanta");
  const next = { ...amountsQ };
  for (const s of reaction.species) {
    const delta = s.coeff * extentQ * (s.side === "reactant" ? -1 : 1);
    const v = (next[s.id] || 0) + delta;
    if (v < 0) throw new Error(`applyExtent: not enough ${s.id}`);
    next[s.id] = v;
  }
  return next;
}
