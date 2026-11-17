// Module 3 -- MOLE AND MASS CALCULATIONS.  n = m / M and m = n M, entity counts N = n N_A.
import { AVOGADRO } from "./constants.js";
import { clean, toQuanta, fromQuanta, fmtSig, fmtMol, fmtSci, fmtFixed, MAX_AMOUNT_MOL } from "./numeric.js";
import { molarMass, getSubstance, simplifiedElements } from "./substances.js";
import { MASS_POLICIES, DEFAULT_POLICY } from "./elements.js";

/** n = m / M.  Returns { ok, n, nQ, error }.  M <= 0 or non-finite is an error (never divides by zero); m < 0 is an error; m = 0 -> n = 0. */
export function molesFromMass(massG, molarMassGPerMol) {
  if (!Number.isFinite(massG)) return { ok: false, n: NaN, nQ: 0, error: "Mass must be a number." };
  if (massG < 0) return { ok: false, n: NaN, nQ: 0, error: "Mass cannot be negative." };
  if (!Number.isFinite(molarMassGPerMol) || molarMassGPerMol <= 0) return { ok: false, n: NaN, nQ: 0, error: "Molar mass must be greater than zero." };
  const n = clean(massG / molarMassGPerMol);
  if (n > MAX_AMOUNT_MOL) return { ok: false, n, nQ: 0, error: `That is more than ${MAX_AMOUNT_MOL} mol, the largest amount the lab supports.` };
  return { ok: true, n, nQ: toQuanta(n), error: null };
}
/** m = n M. */
export function massFromMoles(nMol, molarMassGPerMol) {
  if (!Number.isFinite(nMol) || nMol < 0) return { ok: false, mass: NaN, error: "Amount cannot be negative." };
  if (!Number.isFinite(molarMassGPerMol) || molarMassGPerMol <= 0) return { ok: false, mass: NaN, error: "Molar mass must be greater than zero." };
  return { ok: true, mass: clean(nMol * molarMassGPerMol), error: null };
}
/** Mass of an amount held as integer quanta. */
export const massFromQuanta = (q, M) => massFromMoles(fromQuanta(q), M);
/** Number of specified entities, N = n N_A (a plain double: for DISPLAY as scientific notation only, never used for chemistry). */
export const entityCount = (nMol) => nMol * AVOGADRO;

/** Everything a stage needs for one substance + policy: molar mass, label, simplification note. */
export function massInfo(substanceId, policy = DEFAULT_POLICY) {
  const s = getSubstance(substanceId);
  const M = molarMass(s, policy);
  const simp = simplifiedElements(s, policy);
  const p = MASS_POLICIES[policy];
  return {
    substanceId, policy, M, simplified: simp, dp: p.dp,
    label: `${simp.length ? fmtFixed(M, 1) : fmtFixed(M, p.dp)} g mol⁻¹`,
    note: simp.length ? `${simp.join(", ")} uses a simplified teaching value (${simp.map((e) => `${e} = ${fmtSig(molarMass(e === substanceId ? s : getSubstance(`atoms:${e}`), policy), 3)}`).join(", ")} g mol⁻¹).` : `Molar mass from ${p.short}.`,
  };
}

/** Worked lines for the calculation panel. */
export function massWorking({ direction, massG, nMol, M, formula }) {
  const f = formula;
  if (direction === "moles-to-mass") return [`m = n × M`, `m = ${fmtMol(nMol)} mol × ${fmtSig(M, 4)} g mol⁻¹`, `m = ${fmtSig(massG, 4)} g`];
  return [`n = m ÷ M`, `n = ${fmtSig(massG, 4)} g ÷ ${fmtSig(M, 4)} g mol⁻¹`, `n(${f}) = ${fmtMol(nMol)} mol`];
}
export { fmtSci };
