// Chemistry of the Equivalence Point balance (pure). Built on the shared exact solver, so the pH is right on both sides of
// equivalence (no "approaching" past it), H2SO4 uses pKa2 = 1.99 for HSO4-, and reagents are checked against solubility.
import { solveSolution } from "../../../lib/acidbase/solver.js";
import { niceAxisMax } from "../../../lib/acidbase/titration.js";

export const FLASK_CM3 = 25.0;
export const ACIDS = {
  HCl: { id: "HCl", label: "HCl", factor: 1, ratio: "1 mol HCl gives 1 mol H⁺" },
  H2SO4: { id: "H2SO4", label: "H₂SO₄", factor: 2, pKa2: 1.99, ratio: "1 mol H₂SO₄ gives up to 2 mol H⁺ (HSO₄⁻ has pKa 1.99)" },
};
// Ca(OH)2: about 1.7 g dm-3 (0.023 mol dm-3) dissolves at 20 degC and less when warmer; ideal Ksp ~5e-6 gives about 0.011 mol dm-3.
// 0.020 mol dm-3 is used as the highest concentration that is physically possible at 25 degC. Sources in docs/sim-review/acids-fixes.md.
export const BASES = {
  NaOH: { id: "NaOH", label: "NaOH", factor: 1, maxConc: Infinity, ratio: "1 mol NaOH gives 1 mol OH⁻" },
  CaOH2: { id: "CaOH2", label: "Ca(OH)₂", factor: 2, maxConc: 0.02, ratio: "1 mol Ca(OH)₂ gives 2 mol OH⁻" },
};
export const ACID_CONCS = [0.01, 0.05, 0.1];
export const BASE_CONCS = [0.01, 0.02, 0.05, 0.1];
export const KSP_CASO4 = 4.9e-5; // ideal; used only to warn that CaSO4 may precipitate

export const EQUATIONS = {
  "HCl+NaOH": "HCl + NaOH → NaCl + H₂O",
  "HCl+CaOH2": "2HCl + Ca(OH)₂ → CaCl₂ + 2H₂O",
  "H2SO4+NaOH": "H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O",
  "H2SO4+CaOH2": "H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2H₂O",
};

export function validate(baseId, cBase) {
  const b = BASES[baseId];
  return cBase <= b.maxConc + 1e-12 ? { ok: true } : { ok: false, message: `${b.label} cannot be ${cBase.toFixed(3)} mol dm⁻³: it dissolves only to about ${b.maxConc.toFixed(3)} mol dm⁻³ (about 1.7 g dm⁻³) at 25 °C.` };
}

export function equivalenceAcidVolume({ acidId, baseId, cAcid, cBase, baseVolume = FLASK_CM3 }) {
  return Math.round(((cBase * baseVolume * BASES[baseId].factor) / (cAcid * ACIDS[acidId].factor)) * 1e9) / 1e9;
}

export function state({ acidId, baseId, cAcid, cBase, acidVolume, baseVolume }) {
  const a = ACIDS[acidId], b = BASES[baseId];
  const nAcid = (cAcid * acidVolume) / 1000, nBase = (cBase * baseVolume) / 1000; // mol of formula units
  const eqH = nAcid * a.factor, eqOH = nBase * b.factor; // mol of H+ / OH- equivalents
  const V = (acidVolume + baseVolume) / 1000;
  const sol = { strongAnions: (nAcid * 1) / V, strongCations: (nBase * b.factor) / V, weakAcids: [] };
  if (a.id === "H2SO4") sol.weakAcids.push({ c: nAcid / V, pKa: a.pKa2 });
  else sol.strongAnions = nAcid / V;
  const r = solveSolution(sol);
  const diff = eqH - eqOH; const tol = 1e-9 * Math.max(eqOH, 1e-12);
  const status = Math.abs(diff) <= tol ? "equivalence" : diff > 0 ? "acid" : "base";
  const veq = equivalenceAcidVolume({ acidId, baseId, cAcid, cBase, baseVolume });
  // calcium sulfate: warn when the ion product would exceed Ksp (the solid would form and the pH model is no longer exact)
  let precipitate = false;
  if (a.id === "H2SO4" && b.id === "CaOH2") { const so4 = (nAcid / V) * (a.pKa2 ? Math.pow(10, -a.pKa2) / (Math.pow(10, -a.pKa2) + r.H) : 1); precipitate = (nBase / V) * so4 > KSP_CASO4; }
  return { ...r, nAcid, nBase, eqH, eqOH, diff, status, veq, V, precipitate };
}

/** Direction-aware wording: "approaching" only BEFORE equivalence. relative = |excess| / reference equivalents. */
export function statusText(s, acidVolume, refEquivalents) {
  const rel = Math.abs(s.diff) / refEquivalents;
  if (s.status === "equivalence") return { key: "equivalence", title: "Equivalence point", detail: "Neither H⁺ nor OH⁻ is in excess" };
  if (s.status === "base") return rel < 0.15 ? { key: "approaching", title: "Approaching equivalence", detail: "OH⁻ still in excess (basic)" } : { key: "base", title: "OH⁻ in excess", detail: "Basic" };
  return rel < 0.15 ? { key: "past", title: "Just past equivalence", detail: "H⁺ now in excess (acidic)" } : { key: "acid", title: "H⁺ in excess", detail: "Acidic" };
}
export const axisFor = (veq) => niceAxisMax(veq);
