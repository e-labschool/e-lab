// Predict -> Interact -> Observe -> Explain -> Apply (spec G).  The PREDICT questions and their feedback are generated here
// from the chemistry modules (never typed in by hand), so the "correct" answer can never disagree with the calculation.
import { getSubstance } from "./substances.js";
import { composition } from "./composition.js";
import { fmtMol, fmtSig, fromQuanta, toQuanta, clean } from "./numeric.js";
import { molarMass } from "./substances.js";

function uniqueChoices(correct, wrongs, fmt) {
  const seen = new Set([fmt(correct)]); const out = [{ id: "c", value: correct, label: fmt(correct), correct: true }];
  let k = 0;
  for (const w of wrongs) { if (!Number.isFinite(w) || w < 0 || seen.has(fmt(w))) continue; seen.add(fmt(w)); out.push({ id: `w${k++}`, value: w, label: fmt(w), correct: false }); }
  return out;
}
/** Deterministic shuffle keyed by a seed string (so tests and screenshots are reproducible). */
export function orderChoices(choices, seed) {
  let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const arr = choices.slice(); for (let i = arr.length - 1; i > 0; i -= 1) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

/** Stage 1: "How many moles of <element / ion> are in n mol of <substance>?"  Asks about the first element/ion with a subscript > 1 (else the first). */
export function stage1Prediction(substanceId, amountQ) {
  const s = getSubstance(substanceId); const c = composition(substanceId, amountQ); const n = fromQuanta(amountQ);
  if (s.kind === "metallic" || amountQ === 0) return null;
  const ionic = s.kind === "ionic";
  const lines = ionic ? c.ions : c.atoms;
  const target = lines.find((l) => l.perEntity > 1) ?? lines[lines.length - 1];
  const name = ionic ? target.label : `${target.element} atoms`;
  const total = c.totalAtomsMol;
  const choices = uniqueChoices(target.mol, [n, total, n * 2, n / 2, target.mol + n], (v) => `${fmtMol(v)} mol`).slice(0, 4);
  const sub = target.perEntity;
  return {
    key: `s1:${substanceId}:${amountQ}`, prompt: `Predict: how many moles of ${name} are in ${fmtMol(n)} mol of ${s.formulaDisplay}?`, choices, correctId: "c",
    explainRight: `Right: each ${s.entity.singular} contains ${sub} ${ionic ? target.label : target.element}${sub > 1 ? "s" : ""} (the subscript), so n = ${sub} × ${fmtMol(n)} = ${fmtMol(target.mol)} mol.`,
    explainWrong: `Not quite. The subscript ${sub} in ${s.formulaDisplay} counts ${ionic ? "ions" : "atoms"} inside ONE ${s.entity.singular}; multiply it by the amount: ${sub} × ${fmtMol(n)} = ${fmtMol(target.mol)} mol.`,
  };
}

/** Stage 2: "What amount is m g of X?"  Distractors are the classic errors: inverting the formula, forgetting M. */
export function stage2Prediction(substanceId, massG, policy = "booklet") {
  const s = getSubstance(substanceId); const M = molarMass(s, policy);
  if (!(massG > 0)) return null;
  const n = clean(massG / M);
  const choices = uniqueChoices(n, [clean(M / massG), massG, clean(massG * M), n * 2], (v) => `${fmtSig(v, 3)} mol`).slice(0, 4);
  return {
    key: `s2:${substanceId}:${massG}:${policy}`, prompt: `Predict: how many moles are in ${fmtSig(massG, 3)} g of ${s.formulaDisplay}? (M = ${fmtSig(M, 4)} g mol⁻¹)`, choices, correctId: "c",
    explainRight: `Right: n = m ÷ M = ${fmtSig(massG, 3)} ÷ ${fmtSig(M, 4)} = ${fmtSig(n, 3)} mol.`,
    explainWrong: `Not quite. Divide the mass by the molar mass: n = m ÷ M = ${fmtSig(massG, 3)} ÷ ${fmtSig(M, 4)} = ${fmtSig(n, 3)} mol. Dividing the other way round gives g² mol⁻¹, not mol.`,
  };
}
export { toQuanta };

/** Stage 2 "Apply": the student weighs out a target amount.  Returns { ok, correct, feedback, expectedG } (a mass within 0.5 % counts as right). */
export function checkApplyMass(substanceId, targetMol, answerG, policy = "booklet") {
  const s = getSubstance(substanceId); const M = molarMass(s, policy); const expected = clean(targetMol * M);
  if (!Number.isFinite(answerG) || answerG < 0) return { ok: false, correct: false, expectedG: expected, feedback: "Enter a mass in grams (a number that is not negative)." };
  const correct = Math.abs(answerG - expected) <= 0.005 * expected;
  return { ok: true, correct, expectedG: expected, feedback: correct ? `Right: m = n × M = ${fmtSig(targetMol, 3)} mol × ${fmtSig(M, 4)} g mol⁻¹ = ${fmtSig(expected, 4)} g.` : `Not quite: m = n × M = ${fmtSig(targetMol, 3)} mol × ${fmtSig(M, 4)} g mol⁻¹ = ${fmtSig(expected, 4)} g (you gave ${fmtSig(answerG, 4)} g).` };
}
