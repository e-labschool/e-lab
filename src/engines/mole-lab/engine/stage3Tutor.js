// Stage 3 PREDICT and APPLY questions (spec G).  Generated from the same solution / dilution modules as the experiment itself,
// so the "correct" answer can never disagree with the calculation the lab performs.
import { fmtSig, clean, parseNumberInput } from "./numeric.js";
import { molarMass } from "./substances.js";
import { concentration, volumeForConcentration, mlToDm3 } from "./solutions.js";
import { dilute, c1v1c2v2, solutionConc } from "./dilution.js";
import { getSolute, fmtMl } from "./concLab.js";
import { experimentDef } from "./stage3.js";

const f3 = (x) => fmtSig(x, 3);
function choicesOf(correct, wrongs, fmt) {
  const seen = new Set([fmt(correct)]); const out = [{ id: "c", value: correct, label: fmt(correct), correct: true }]; let k = 0;
  for (const w of wrongs) { if (!Number.isFinite(w) || w <= 0 || seen.has(fmt(w))) continue; seen.add(fmt(w)); out.push({ id: `w${k++}`, value: w, label: fmt(w), correct: false }); }
  return out.slice(0, 4);
}
const CMT = (v) => `${f3(v)} mol dm⁻³`;

/** The Predict question for the experiment as it is currently set up, or null. */
export function stage3Prediction(scene) {
  const d = scene.data; const sol = getSolute(d.soluteId); const F = sol.formula; const M = molarMass(d.soluteId, d.policy);
  const key = (extra) => `s3:${d.exp}:${d.soluteId}:${extra}`;
  if (d.kind === "dilution") {
    const dil = d.dil; const c1 = solutionConc({ nQ: dil.stockQ0, volumeMl: dil.stockVolMl0 }); const r = dilute({ nQ: dil.stockQ0, volumeMl: dil.stockVolMl0 }, dil.aliquotMl, dil.finalMl); if (!r.ok) return null;
    const wrongs = [c1, clean(c1 * dil.finalMl / dil.aliquotMl), clean(c1 * dil.aliquotMl / dil.finalMl / 10), clean(c1 - (dil.finalMl - dil.aliquotMl) / 100)];
    return { key: key(`${dil.stockQ0}:${dil.aliquotMl}:${dil.finalMl}`), prompt: `Predict: ${fmtMl(dil.aliquotMl)} mL of a ${CMT(c1)} stock is diluted with water to ${fmtMl(dil.finalMl)} mL. What is the new concentration?`,
      choices: choicesOf(r.c2, wrongs, CMT), correctId: "c",
      explainRight: `Right: the aliquot carries n = c₁V₁ = ${f3(c1)} × ${f3(mlToDm3(dil.aliquotMl))} = ${f3(r.nAliquotMol)} mol, and that same amount is now in ${f3(mlToDm3(dil.finalMl))} dm³: c₂ = ${f3(r.c2)} mol dm⁻³ (C₁V₁ = C₂V₂).`,
      explainWrong: `Not quite. Only the aliquot's amount, n = c₁V₁ = ${f3(r.nAliquotMol)} mol, moves to the flask (not the whole stock). It is then spread over ${f3(mlToDm3(dil.finalMl))} dm³, so c₂ = ${f3(r.nAliquotMol)} ÷ ${f3(mlToDm3(dil.finalMl))} = ${f3(r.c2)} mol dm⁻³.` };
  }
  const A = d.stations.A; const B = d.stations.B;
  if (d.kind === "compare" && d.exp === 3) {
    const nA = A.massG / M; const cA = concentration(nA, A.flaskMl).c; const cB = concentration(nA, B.flaskMl).c;
    return { key: key(`${A.massG}:${A.flaskMl}:${B.flaskMl}`), prompt: `Predict: the same ${f3(A.massG)} g of ${F} is made up to ${fmtMl(A.flaskMl)} mL in beaker A and ${fmtMl(B.flaskMl)} mL in beaker B. What is the concentration in B?`,
      choices: choicesOf(cB, [cA, clean(cB / 2), clean(cA * 2), clean(nA)], CMT), correctId: "c",
      explainRight: `Right: the amount is unchanged (${f3(nA)} mol) but it is spread over ${f3(mlToDm3(B.flaskMl))} dm³: c = ${f3(nA)} ÷ ${f3(mlToDm3(B.flaskMl))} = ${f3(cB)} mol dm⁻³.`,
      explainWrong: `Not quite. The moles stay the same (${f3(nA)} mol); only the volume changes. c = n ÷ V = ${f3(nA)} ÷ ${f3(mlToDm3(B.flaskMl))} = ${f3(cB)} mol dm⁻³: twice the volume gives half the concentration.` };
  }
  if (d.kind === "compare") {
    const nA = A.massG / M; const nB = B.massG / M; const cA = concentration(nA, A.flaskMl).c; const cB = concentration(nB, B.flaskMl).c;
    return { key: key(`${A.massG}:${A.flaskMl}:${B.massG}:${B.flaskMl}`), prompt: `Predict: A has ${f3(A.massG)} g of ${F} made up to ${fmtMl(A.flaskMl)} mL; B has ${f3(B.massG)} g made up to ${fmtMl(B.flaskMl)} mL. What is the concentration of B?`,
      choices: choicesOf(cB, [cA, clean(cB * 2), clean(cB / 2), clean(nB)], CMT), correctId: "c",
      explainRight: `Right: n(B) = ${f3(B.massG)} ÷ ${fmtSig(M, 4)} = ${f3(nB)} mol, and c = n ÷ V = ${f3(nB)} ÷ ${f3(mlToDm3(B.flaskMl))} = ${f3(cB)} mol dm⁻³.`,
      explainWrong: `Not quite. Work out the amount first, n = m ÷ M = ${f3(B.massG)} ÷ ${fmtSig(M, 4)} = ${f3(nB)} mol, then divide by the volume in dm³: c = ${f3(nB)} ÷ ${f3(mlToDm3(B.flaskMl))} = ${f3(cB)} mol dm⁻³.` };
  }
  if (!(A.massG > 0)) return null;
  const n = A.massG / M; const c = concentration(n, A.flaskMl).c;
  const wrongs = [clean(n), clean(n * mlToDm3(A.flaskMl)), clean(A.massG / mlToDm3(A.flaskMl)), clean(c / 2), clean(c * 2)];
  return { key: key(`${A.massG}:${A.flaskMl}`), prompt: `Predict: ${f3(A.massG)} g of ${F} is dissolved and made up to ${fmtMl(A.flaskMl)} mL. What is the concentration? (M = ${fmtSig(M, 4)} g mol⁻¹)`,
    choices: choicesOf(c, wrongs, CMT), correctId: "c",
    explainRight: `Right: n = m ÷ M = ${f3(A.massG)} ÷ ${fmtSig(M, 4)} = ${f3(n)} mol; V = ${fmtMl(A.flaskMl)} mL = ${f3(mlToDm3(A.flaskMl))} dm³; c = n ÷ V = ${f3(c)} mol dm⁻³.`,
    explainWrong: `Not quite. First n = m ÷ M = ${f3(A.massG)} ÷ ${fmtSig(M, 4)} = ${f3(n)} mol. Then convert mL to dm³ (÷ 1000) and divide: c = ${f3(n)} ÷ ${f3(mlToDm3(A.flaskMl))} = ${f3(c)} mol dm⁻³.` };
}

/** The Apply task (numeric answer) for the experiment, or null.  `expected` is computed by the engine modules. */
export function stage3Apply(scene) {
  const d = scene.data; const sol = getSolute(d.soluteId); const F = sol.formula; const M = molarMass(d.soluteId, d.policy);
  if (d.kind === "dilution") {
    const c1 = solutionConc({ nQ: d.dil.stockQ0, volumeMl: d.dil.stockVolMl0 }); const target = clean(c1 / 4); const V2 = 100;
    const r = c1v1c2v2({ c1, c2: target, v2: V2 }); if (!r.ok) return null;
    return { key: `s3:${d.exp}:apply:${c1}`, prompt: `Apply: you need ${V2} mL of ${CMT(target)} ${F} from this ${CMT(c1)} stock. What aliquot volume V₁ do you take?`, unit: "mL", expected: r.v1, tolerancePct: 1,
      working: `V₁ = c₂V₂ ÷ c₁ = ${f3(target)} × ${V2} ÷ ${f3(c1)} = ${f3(r.v1)} mL` };
  }
  if (d.kind === "compare" && d.exp === 5) {
    const B = d.stations.B; const A = d.stations.A; const nB = B.massG / M; const cA = concentration(A.massG / M, A.flaskMl).c; const r = volumeForConcentration(nB, cA); if (!r.ok) return null;
    return { key: `s3:${d.exp}:apply:${A.massG}:${A.flaskMl}:${B.massG}`, prompt: `Apply: keep ${f3(B.massG)} g of ${F} in beaker B. To match beaker A (${CMT(cA)}), what final volume must B be made up to?`, unit: "mL", expected: r.volumeMl, tolerancePct: 1,
      working: `V = n ÷ c = ${f3(nB)} mol ÷ ${f3(cA)} mol dm⁻³ = ${f3(r.volumeMl / 1000)} dm³ = ${f3(r.volumeMl)} mL` };
  }
  if (d.kind === "compare") { // experiment 3
    const A = d.stations.A; const n = A.massG / M; const t = 0.5; const rr = volumeForConcentration(n, t); if (!rr.ok) return null;
    return { key: `s3:${d.exp}:apply:${A.massG}`, prompt: `Apply: you have ${f3(A.massG)} g of ${F}. To make a ${CMT(t)} solution, what final volume do you make it up to?`, unit: "mL", expected: rr.volumeMl, tolerancePct: 1,
      working: `V = n ÷ c = ${f3(n)} mol ÷ ${f3(t)} mol dm⁻³ = ${f3(rr.volumeMl / 1000)} dm³ = ${f3(rr.volumeMl)} mL` };
  }
  // experiments 1 and 2: how much solute for a target solution (m = c V M)
  const targetC = 1; const V = 250; const n = clean(targetC * mlToDm3(V)); const m = clean(n * M);
  return { key: `s3:${d.exp}:apply:${d.soluteId}:${d.policy}`, prompt: `Apply: what mass of ${F} do you weigh to make ${V} mL of a ${CMT(targetC)} solution?`, unit: "g", expected: m, tolerancePct: 0.5,
    working: `n = c × V = ${f3(targetC)} × ${f3(mlToDm3(V))} = ${f3(n)} mol; m = n × M = ${f3(n)} × ${fmtSig(M, 4)} = ${f3(m)} g` };
}

/** Mark an Apply answer: a value within the task's tolerance is right.  Returns { ok, correct, feedback }. */
export function checkStage3Apply(task, raw) {
  const p = parseNumberInput(raw, { label: "Your answer", allowZero: false });
  if (!p.ok) return { ok: false, correct: false, feedback: p.error };
  const correct = Math.abs(p.value - task.expected) <= (task.tolerancePct / 100) * task.expected;
  return { ok: true, correct, feedback: correct ? `Right: ${task.working}.` : `Not quite: ${task.working}.` };
}
export { experimentDef };
