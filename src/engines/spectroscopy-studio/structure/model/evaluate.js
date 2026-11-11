// Feedback for a chosen structure, hints and the full worked explanation. PURE.
// Feedback names the SPECTRAL EVIDENCE that conflicts with the chosen structure (never the name of the correct compound). Everything is computed by
// comparing what the chosen graph would give (formula, IR groups, ¹H environments with typical shift ranges and n+1 splitting) with the compound's spectra.
import { COMPOUNDS } from "../data/compounds.js";
import { STRUCTURES } from "../data/structures.js";
import { environmentsOf, irGroupsOf, prettyFormula } from "./graph.js";
import { INTERPRET_BY_ID } from "../../ir/physics/functionalGroups.js";
import { getLevel } from "./levels.js";

export const DIAGNOSTIC_GROUPS = ["oh-alc", "oh-acid", "cdo", "aldch", "cdc"];
const OH = ["oh-alc", "oh-acid"];
const gr = (id) => INTERPRET_BY_ID[id];
const rangeText = (id) => `${gr(id).range[0]}–${gr(id).range[1]}`;
const shape = { "oh-alc": "broad", "oh-acid": "very broad", cdo: "strong, sharp", aldch: "weak", cdc: "medium to weak" };
const nm = (s) => s.replace(" (apparent)", "");

const predictedSignals = (structId) => environmentsOf(STRUCTURES[structId].graph).map((e) => ({ n: e.n, mult: nm(e.mult.shortName ?? e.mult.name), lo: e.shift.lo, hi: e.shift.hi, exchangeable: e.exchangeable }));

/** Match the signals a structure would give with the signals of the spectrum. Returns { missing: predicted signals not seen, extra: observed signals not explained }. */
export function matchNmr(structId, compound) {
  const pred = predictedSignals(structId); const actual = compound.nmr.signals.map((s) => ({ ...s, used: false }));
  const missing = [];
  for (const p of pred) {
    const a = actual.find((s) => !s.used && s.n === p.n && nm(s.multiplicity) === p.mult && s.shift >= p.lo && s.shift <= p.hi);
    if (a) a.used = true; else missing.push(p);
  }
  return { missing, extra: actual.filter((s) => !s.used), predicted: pred };
}

export const fmtPpm = (x) => (Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? x.toFixed(1) : x.toFixed(2));
const sigText = (n, mult, exchangeable) => `a ${exchangeable ? "broad " : ""}${mult} for ${n} H`;

/** Conflicts between the chosen structure and the evidence: [{ tech: "ms" | "ir" | "nmr", text }]. Empty only for the right structure (or an indistinguishable one). */
export function conflictsFor(compound, structId, levelId = compound.level) {
  const st = STRUCTURES[structId]; const lvl = getLevel(levelId); const out = [];
  // ---- mass spectrum / formula
  if (st.nominal !== compound.nominal) {
    out.push({ tech: "ms", text: lvl.formulaGiven && st.formula !== compound.formula
      ? `The molecular formula given is ${compound.formulaPretty}, but this structure is ${st.formulaPretty}.`
      : `The molecular-ion peak is at m/z ${compound.ms.mMz}, so Mᵣ = ${compound.ms.mMz}; this structure has Mᵣ = ${st.nominal}.` });
  } else if (lvl.formulaGiven && st.formula !== compound.formula) {
    out.push({ tech: "ms", text: `The molecular formula given is ${compound.formulaPretty}, but this structure is ${st.formulaPretty}.` });
  }
  if (st.msBase && st.msBase !== compound.ms.baseMz) out.push({ tech: "ms", text: `The base peak in the spectrum is at m/z ${compound.ms.baseMz}; the strongest fragment this structure would normally give is at m/z ${st.msBase}.` });
  // ---- infrared
  const obs = new Set(compound.ir.groups.filter((g) => DIAGNOSTIC_GROUPS.includes(g)));
  const exp = new Set([...irGroupsOf(st.graph)].filter((g) => DIAGNOSTIC_GROUPS.includes(g)));
  const ohObs = [...obs].filter((g) => OH.includes(g)); const ohExp = [...exp].filter((g) => OH.includes(g));
  if (ohObs.length && ohExp.length && ohObs[0] !== ohExp[0]) {
    out.push({ tech: "ir", text: `The O–H absorption in the spectrum has a different position and width from the one this structure would give (an alcohol O–H is broad, ${rangeText("oh-alc")} cm⁻¹; a carboxylic acid O–H is very broad, ${rangeText("oh-acid")} cm⁻¹).` });
  }
  for (const g of exp) if (!obs.has(g) && !(OH.includes(g) && ohObs.length)) out.push({ tech: "ir", text: `This structure contains a bond that should absorb in the ${rangeText(g)} cm⁻¹ region (${shape[g]}), but the spectrum has no absorption like that.` });
  for (const g of obs) if (!exp.has(g) && !(OH.includes(g) && ohExp.length)) out.push({ tech: "ir", text: `The spectrum has a ${shape[g]} absorption in the ${rangeText(g)} cm⁻¹ region that this structure cannot give.` });
  // ---- 1H NMR
  const m = matchNmr(structId, compound);
  const overlapped = compound.nmr.signals.some((s, i, all) => all.some((t, j) => j !== i && Math.abs(t.shift - s.shift) < 0.25 && !t.exchangeable !== !s.exchangeable));
  const npred = m.predicted.length; const nobs = compound.nmr.signals.length;
  if (npred !== nobs && !overlapped) out.push({ tech: "nmr", text: `The spectrum has ${nobs} ${nobs === 1 ? "¹H signal" : "different ¹H signals"}; this structure should give ${npred}.` });
  for (const p of m.missing.slice(0, 2)) out.push({ tech: "nmr", text: `This structure should give ${sigText(p.n, p.mult, p.exchangeable)} between ${fmtPpm(p.lo)} and ${fmtPpm(p.hi)} ppm, but no signal like that is seen.` });
  for (const s of m.extra.slice(0, 2)) {
    if (overlapped && compound.nmr.signals.some((t) => t !== s && Math.abs(t.shift - s.shift) < 0.25)) continue;
    out.push({ tech: "nmr", text: `The spectrum has ${sigText(s.n, s.multiplicity, s.exchangeable)} at ${fmtPpm(s.shift)} ppm that this structure cannot account for.` });
  }
  return out;
}

/** What the student is told after a submission: { correct, conflicts (at most 4, mixed techniques), text }. Never contains the name of the right compound. */
export function feedbackFor(compound, structId) {
  if (structId === compound.id) return { correct: true, conflicts: [], text: "Correct. This structure fits all of the evidence." };
  const all = conflictsFor(compound, structId);
  const pick = []; for (const t of ["ms", "ir", "nmr"]) pick.push(...all.filter((c) => c.tech === t).slice(0, 2));
  const conflicts = pick.slice(0, 4);
  return { correct: false, conflicts, text: conflicts.length ? "Not yet. This structure conflicts with the evidence:" : "Not yet. This structure does not fit every piece of the evidence: look again at all three spectra." };
}

// ------------------------------------------------------------------ hints (never name or describe the answer)
export function hintsFor(compound, levelId = compound.level) {
  const lvl = getLevel(levelId); const nSig = compound.nmr.signals.length;
  const all = {
    foundation: [
      "Start with the mass spectrum. The molecular ion is the peak at the highest m/z, not counting the tiny M+1 satellite one unit above it. Does it agree with the molar mass of the formula you were given?",
      "In the IR spectrum look first at two places: above 3000 cm⁻¹, and between 1650 and 1800 cm⁻¹. Is there an absorption in either of them? Is it broad or sharp, strong or weak?",
      `In the ¹H NMR spectrum count the signals (there are ${nSig}) and share the hydrogens of the formula out between them using the integration. Then apply the n + 1 rule to each splitting pattern.`,
    ],
    intermediate: [
      "Use all three spectra for every candidate. If the structures share a molar mass, the IR groups and the integration ratios separate them first; the splitting patterns separate the rest.",
      "Apply n + 1 to every multiplet, and note every singlet: a singlet means that the neighbouring atoms carry no hydrogen.",
    ],
    advanced: [
      "Several candidates share a molar mass and may share the same splitting patterns. Compare chemical shifts as well as splitting, check which signals might overlap, and compare the base-peak fragment with what each candidate can lose.",
    ],
  };
  return (all[lvl.id] ?? all.foundation).slice(0, lvl.hints);
}

// ------------------------------------------------------------------ guided prompts (shown on request, they do not give the answer)
export const PROMPTS = {
  ms: [
    { q: "What might the molecular-ion peak tell you?", a: "The molecular ion, M⁺•, is normally the peak at the highest m/z (apart from a small M+1 peak from ¹³C). Its m/z equals the relative molecular mass of the compound. It can be weak, or even absent, if the molecular ion fragments easily." },
    { q: "Which fragment could explain the base peak?", a: "The base peak is the tallest peak (100 %). Subtract its m/z from M: the difference is the mass of the neutral piece that was lost. Which small groups have that mass, and which ions of that m/z would be stable?" },
  ],
  ir: [
    { q: "Which regions of the spectrum contain absorptions?", a: "Note each absorption's wavenumber, strength (strong, medium, weak) and width (broad or sharp). Compare them with the Reference Table, and also notice the regions where there is NO absorption: absence is evidence too." },
  ],
  nmr: [
    { q: "How many different hydrogen environments are there, and how many hydrogens in each?", a: "Count the signals (equivalent hydrogens give one signal). The integration shows the ratio of hydrogens in the signals; scale it so that it adds up to the number of hydrogens in the molecule." },
    { q: "What does each splitting pattern tell you?", a: "The n + 1 rule: a signal split into n + 1 lines has n hydrogens on the neighbouring atoms. A singlet means no hydrogen on the neighbouring atoms. Hydrogens on O (O–H) are usually not split." },
  ],
};

// ------------------------------------------------------------------ the complete explanation
const dou = (d) => (d === 0 ? "0: a saturated molecule with no ring, C=C or C=O" : d === 1 ? "1: one C=O, one C=C or one ring" : String(d));
export function explanationFor(compound) {
  const ms = compound.ms; const M = ms.byMz[ms.mMz]; const base = ms.byMz[ms.baseMz];
  const msLines = [
    `The molecular ion is the peak at m/z ${ms.mMz} (${M.label}, ${M.rel} %), so the relative molecular mass is ${ms.mMz}; with the formula ${compound.formulaPretty} (Mᵣ = ${compound.molarMass}).`,
    `Degree of unsaturation = (2×${compound.formula.match(/C(\d*)/)[1] || 1} + 2 − ${compound.formula.match(/H(\d*)/)[1] || 1}) / 2 = ${dou(compound.dou)}.`,
    `The base peak is m/z ${ms.baseMz} (${base.label}): ${base.origin}`,
    ...ms.peaks.filter((p) => p.role === "fragment" && p.mz !== ms.baseMz).sort((a, b) => b.rel - a.rel).slice(0, 3).map((p) => `m/z ${p.mz} (${p.label}, ${Math.round(p.rel)} %): ${p.origin}`),
  ];
  const seen = new Set(); const irLines = [];
  for (const b of [...compound.ir.bands].filter((x) => x.group).sort((a, c) => c.A - a.A)) {
    const key = b.group === "ch" ? "ch" : `${b.group}`; if (seen.has(key)) continue; seen.add(key);
    irLines.push(`${b.nu} cm⁻¹: ${b.assign}.`);
  }
  const has = (g) => compound.ir.groups.includes(g);
  if (!has("cdo")) irLines.push("No strong, sharp absorption between 1650 and 1750 cm⁻¹: there is no C=O group.");
  if (!has("oh-alc") && !has("oh-acid")) irLines.push("No broad absorption above 2500 cm⁻¹ from O–H: there is no O–H group.");
  const nmrLines = compound.nmr.signals.map((s) => {
    const split = s.exchangeable ? "a broad singlet (the hydrogen exchanges, so it is not split)" : s.nNeighbours === 0 ? "a singlet (no hydrogen on the neighbouring atoms)" : `${s.apparent ? "an apparent " : "a "}${s.multiplicity} (${s.nNeighbours} neighbouring H)`;
    return `δ ${fmtPpm(s.shift)} ppm, ${s.n} H, ${split}: ${s.assign}.`;
  });
  const others = compound.choices.filter((c) => c !== compound.id).map((c) => {
    const all = conflictsFor(compound, c); const k = ["ir", "nmr", "ms"].map((t) => all.find((x) => x.tech === t)).find(Boolean);
    return `${STRUCTURES[c].name} (${prettyFormula(STRUCTURES[c].formula)}): ${k ? k.text : "fits only part of the evidence."}`;
  });
  return {
    title: `${compound.name} (${compound.condensed.replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d])})`,
    sections: [
      { tech: "ms", heading: "Mass spectrum", lines: msLines },
      { tech: "ir", heading: "Infrared spectrum", lines: irLines },
      { tech: "nmr", heading: "¹H NMR spectrum", lines: nmrLines },
      { tech: "others", heading: "Why the other choices do not fit", lines: others },
    ],
    conclusion: `All three techniques give the same picture: the unknown is ${compound.name}, ${compound.formulaPretty}.`,
  };
}
