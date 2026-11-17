// Predict -> Interact -> Observe -> Explain -> Apply for Stages 4, 5 and 6.  The questions, the right answers and the feedback are
// GENERATED from the chemistry modules (gasLab, limiting, reactions), so an answer can never disagree with the calculation.
import { orderChoices } from "./tutor.js";
import { getSubstance, molarMass } from "./substances.js";
import { getReaction, reactants, products } from "./reactions.js";
import { limitingReagent, limitingFromMasses, theoreticalYieldMass } from "./limiting.js";
import { gasLabState, RTP_CONVENTION } from "./gasLab.js";
import { fmtSig, fmtMol, fromQuanta, clean } from "./numeric.js";
import { toUnicodeFormula } from "./formula.js";

const nm = (id) => toUnicodeFormula(getSubstance(id).formula);
function uniq(correct, wrongs, fmt) {
  const seen = new Set([fmt(correct)]); const out = [{ id: "c", value: correct, label: fmt(correct), correct: true }]; let k = 0;
  for (const w of wrongs) { if (!Number.isFinite(w) || w < 0 || seen.has(fmt(w))) continue; seen.add(fmt(w)); out.push({ id: `w${k++}`, value: w, label: fmt(w), correct: false }); }
  return out;
}
export { orderChoices };

/** Stage 4 predict: RTP -> volume of n mol; advanced -> larger / smaller / same as the 24 convention. */
export function stage4Prediction({ gasId, nMol, model, tK, pPa, policy = "booklet" }) {
  if (!(nMol > 0)) return null; const g = nm(gasId);
  if (model === "rtp") {
    const V = clean(nMol * 24); const f = (v) => `${Number(v.toPrecision(3))} dm³`;
    return {
      key: `s4:rtp:${gasId}:${nMol}`, prompt: `Predict: at RTP (Vm ≈ 24 dm³ mol⁻¹), what volume will ${fmtMol(nMol)} mol of ${g} occupy?`,
      choices: uniq(V, [clean(nMol * 22.4), clean(24 / nMol), clean(nMol / 24), clean(V * 2)], f).slice(0, 4), correctId: "c",
      explainRight: `Right: V = n × Vm = ${fmtMol(nMol)} mol × 24 dm³ mol⁻¹ = ${Number(V.toPrecision(3))} dm³. The same for any ideal gas, because equal volumes hold equal numbers of molecules.`,
      explainWrong: `Not quite. At constant temperature and pressure the volume is proportional to the amount: V = n × Vm = ${fmtMol(nMol)} × 24 = ${Number(V.toPrecision(3))} dm³. (22.4 dm³ mol⁻¹ is the value at 273 K, not at room temperature.)`,
    };
  }
  const s = gasLabState({ model: "ideal", nQ: Math.round(nMol * 1e9), gasId, tK, pPa, policy }); const conv = clean(nMol * 24);
  const rel = Math.abs(s.volumeDm3 - conv) / conv < 5e-4 ? "same" : s.volumeDm3 > conv ? "larger" : "smaller";
  const lab = { larger: "Larger than n × 24 dm³", smaller: "Smaller than n × 24 dm³", same: "The same as n × 24 dm³" };
  return {
    key: `s4:ideal:${gasId}:${nMol}:${tK}:${pPa}`, prompt: `Predict: at ${fmtSig(tK, 4)} K and ${fmtSig(pPa / 1000, 4)} kPa, will ${fmtMol(nMol)} mol of ${g} occupy more or less than ${fmtSig(conv, 3)} dm³ (the 24 dm³ mol⁻¹ convention)?`,
    choices: ["larger", "smaller", "same"].map((k) => ({ id: k === rel ? "c" : k, value: k, label: lab[k], correct: k === rel })), correctId: "c",
    explainRight: `Right: V = nRT/P gives ${fmtSig(s.volumeDm3, 4)} dm³ here (Vm = ${fmtSig(s.vm, 4)} dm³ mol⁻¹). Volume rises with T and falls with P, so 24.0 is only right near 25 °C and 1 atm.`,
    explainWrong: `Not quite. V = nRT/P = ${fmtSig(s.volumeDm3, 4)} dm³ here, which is ${rel} than ${fmtSig(conv, 3)} dm³. Warmer or lower-pressure gas takes more room (Vm = ${fmtSig(s.vm, 4)} dm³ mol⁻¹).`,
  };
}
/** Stage 4 apply: "A syringe holds V dm3 of gas at RTP. How many moles?"  (a value within 0.5 % counts as right) */
export function stage4Apply(gasId) { return { volumeDm3: 36, prompt: `A gas syringe holds 36.0 dm³ of ${nm(gasId)} at RTP (Vm = 24 dm³ mol⁻¹). How many moles of ${nm(gasId)} is that?`, expected: 1.5 }; }
export function checkNumeric(answer, expected, unit, how) {
  if (!Number.isFinite(answer) || answer < 0) return { ok: false, correct: false, feedback: `Enter a number (${unit}) that is not negative.` };
  const correct = Math.abs(answer - expected) <= Math.max(0.005 * Math.abs(expected), 1e-9);
  return { ok: true, correct, expected, feedback: correct ? `Right: ${how} = ${fmtSig(expected, 4)} ${unit}.` : `Not quite: ${how} = ${fmtSig(expected, 4)} ${unit} (you gave ${fmtSig(answer, 4)}).` };
}

/** Stage 5 predict: how many moles of the main product from the reactants set up on the bench. */
export function stage5Prediction(reactionId, initialQ) {
  const r = getReaction(reactionId); const lim = limitingReagent(r, initialQ); const prod = products(r)[0]; const produced = lim.products.find((p) => p.id === prod.id).produced;
  if (lim.noReaction) return null;
  const amts = reactants(r).map((s) => ({ s, n: fromQuanta(initialQ[s.id] ?? 0) }));
  const txt = amts.map((a) => `${fmtMol(a.n)} mol ${nm(a.s.id)}`).join(" + ");
  const f = (v) => `${fmtMol(v)} mol`;
  const choices = uniq(produced, [amts.reduce((a, x) => a + x.n, 0), produced * 2, produced / 2, amts[0].n, produced + 1], f).slice(0, 4);
  const eqTxt = `${reactants(r).map((s) => `${s.coeff === 1 ? "" : s.coeff} ${nm(s.id)}`.trim()).join(" + ")} → ${prod.coeff === 1 ? "" : prod.coeff} ${nm(prod.id)}`.replace(/\s+/g, " ");
  return {
    key: `s5:${reactionId}:${reactants(r).map((s) => initialQ[s.id] ?? 0).join("-")}`, prompt: `Predict: how many moles of ${nm(prod.id)}${prod.state === "aq" ? "(aq)" : ""} form from ${txt}?`, choices, correctId: "c",
    explainRight: `Right: the equation gives ${eqTxt} (… ${prod.coeff} mol of ${nm(prod.id)} for the extent ξ = ${fmtMol(lim.extent)} mol): n(${nm(prod.id)}) = ${prod.coeff} × ${fmtMol(lim.extent)} = ${fmtMol(produced)} mol.`,
    explainWrong: `Not quite. Moles are not conserved, atoms are: use the coefficients as a mole ratio. Here ξ = ${fmtMol(lim.extent)} mol, so n(${nm(prod.id)}) = ${prod.coeff} × ${fmtMol(lim.extent)} = ${fmtMol(produced)} mol.`,
  };
}
/** Stage 5 apply: "You have k mol of A.  How many moles of B are needed to react completely?" */
export function stage5Apply(reactionId) {
  const r = getReaction(reactionId); const [A, B] = reactants(r); const k = 5; const expected = clean((k * B.coeff) / A.coeff);
  return { a: A.id, b: B.id, k, expected, prompt: `Apply: you have ${k} mol of ${nm(A.id)}. How many moles of ${nm(B.id)} are needed to react with all of it?`, how: `n(${nm(B.id)}) = ${k} × ${B.coeff} ÷ ${A.coeff}` };
}

/** Stage 6 predict: which reactant limits?  Options: each reactant, or "both at once". */
export function stage6Prediction(reactionId, initialQ) {
  const r = getReaction(reactionId); const lim = limitingReagent(r, initialQ); const rs = reactants(r);
  const rows = lim.perReactant;
  const correctId = lim.tied ? "both" : lim.limiting[0];
  const opts = [...rs.map((s) => ({ id: s.id, label: `${nm(s.id)} runs out first`, correct: correctId === s.id })), { id: "both", label: "Both run out together", correct: correctId === "both" }];
  const calc = rows.map((p) => `${nm(p.id)}: ${fmtMol(p.available)} ÷ ${p.coeff} = ${fmtMol(p.ratioMol)}`).join("; ");
  const worded = lim.tied ? "The ratios are equal, so both reactants are used up at the same moment (neither is in excess)." : `${nm(lim.limiting[0])} has the smallest value, so it limits the reaction (the other is in excess).`;
  return {
    key: `s6:${reactionId}:${rs.map((s) => initialQ[s.id] ?? 0).join("-")}`, prompt: `Predict: which reactant will run out first?`, choices: opts.map((o) => ({ id: o.id === correctId ? "c" : o.id, value: o.id, label: o.label, correct: o.correct })), correctId: "c",
    explainRight: `Right. Divide each amount by its coefficient: ${calc} mol. ${worded}`,
    explainWrong: `Not quite. Divide each amount by its coefficient: ${calc} mol. ${worded}`,
  };
}
/** Stage 6 apply: a theoretical-yield question from MASSES. */
export function stage6Apply(reactionId, initialQ, policy = "booklet") {
  const r = getReaction(reactionId); const rs = reactants(r); const prod = products(r)[0];
  const masses = Object.fromEntries(rs.map((s) => [s.id, clean(fromQuanta(initialQ[s.id] ?? 0) * molarMass(s.id, policy))]));
  const res = limitingFromMasses(r, masses, policy); if (!res.ok) return null;
  const yieldG = theoreticalYieldMass(res.result, prod.id, policy);
  if (!yieldG.ok || !(yieldG.mass > 0)) return null;
  return { masses, productId: prod.id, expected: yieldG.mass, prompt: `Apply: ${rs.map((s) => `${fmtSig(masses[s.id], 4)} g ${nm(s.id)}`).join(" and ")} are mixed. What is the theoretical mass of ${nm(prod.id)} (g)?`, how: `m = n × M` };
}
