// Challenges 3-6 (hydrogen environments, integration, splitting, identify the molecule): question generation, checking and
// explanations, all derived from the molecule data model (no per-molecule hard-coding). PURE; deterministic given a seed.

import { MOLECULES, getMolecule } from "./molecules.js";
import { MULT_NAMES, neighbourSets, simplestRatio, spectrumRows, spectrumSignature } from "./spectrum.js";

/** Candidate sets for 'identify the molecule'. Within every set the signatures (number of signals, simplest area ratio, multiplicities)
 *  are pairwise different WITHOUT using the shifts, so a student can decide from integration + splitting + number of signals. (Tested.) */
export const CANDIDATE_SETS = [
  ["ethanol", "ethyl-ethanoate", "propan-2-ol", "propan-1-ol"],
  ["propane", "ethanal", "propanone", "ethanol"],
  ["ethyl-ethanoate", "propanone", "ethanal", "propan-1-ol"],
  ["propan-2-ol", "propane", "ethanol", "ethanal"],
  ["methane", "ethanal", "propan-1-ol", "ethyl-ethanoate"],
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(list, seed) {
  const rnd = mulberry32(seed); const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const listEnvs = (mol) => mol.environments.map((e) => `${e.label} (${e.count} H)`).join(", ");

// ---------- Challenge 3: how many hydrogen environments ----------
export function envCountQuestion(moleculeId) {
  const mol = getMolecule(moleculeId);
  const n = mol.environments.length;
  const total = mol.atoms.filter((a) => a.isHydrogen).length;
  const max = Math.min(6, Math.max(4, n + 2));
  return {
    kind: "env-count", moleculeId: mol.id, answer: n, options: Array.from({ length: max }, (_, i) => i + 1),
    explanation: `${mol.name} has ${total} hydrogen atoms in ${n} distinct environment${n === 1 ? "" : "s"}: ${listEnvs(mol)}. Hydrogens are in the same environment when the molecule's symmetry (and rotation about single bonds) exchanges them; each environment gives one signal (one multiplet).`,
  };
}
export function checkEnvCount(q, choice) {
  const correct = Number(choice) === q.answer;
  const mol = getMolecule(q.moleculeId);
  const hint = correct ? "" : Number(choice) > q.answer
    ? " You probably counted hydrogens on atoms that are equivalent by symmetry as separate environments."
    : " You probably merged hydrogens that sit on different atoms with different surroundings.";
  return { correct, message: correct ? `Correct: ${q.answer}.` : `Not quite: ${mol.name} has ${q.answer} environments, not ${choice}.${hint}`, explanation: q.explanation };
}

// ---------- Challenge 4: relative proton counts from integration ----------
/** Arbitrary integral units per hydrogen (deterministic per molecule): a real integral is a number of arbitrary units, not a proton count. */
export function integralUnit(moleculeId) {
  let h = 0; for (const ch of moleculeId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [6.5, 7.2, 8.4, 9.1, 10.3, 11.6][h % 6];
}
export function ratioQuestion(moleculeId) {
  const mol = getMolecule(moleculeId);
  const rows = spectrumRows(mol);
  const counts = rows.map((r) => r.count);
  return {
    kind: "ratio", moleculeId: mol.id, rows: rows.map((r) => ({ envId: r.envId })), counts, answer: simplestRatio(counts),
    explanation: `Integration compares the AREAS of the whole multiplets, which are proportional to the number of equivalent H in each environment. Reading from left (high δ) to right: ${rows.map((r) => `${mol.environments.find((e) => e.id === r.envId).label} = ${r.count}`).join(", ")}. Simplest whole-number ratio ${simplestRatio(counts).join(" : ")}. Peak height or the number of lines in a multiplet is NOT the count.`,
  };
}
/** Accepts any positive whole-number multiple of the true ratio (so 6 : 2 and 3 : 1 are both right for propane). */
export function checkRatio(q, inputs) {
  const vals = inputs.map((v) => Number(v));
  const ok = vals.length === q.counts.length && vals.every((v) => Number.isFinite(v) && v > 0 && Number.isInteger(v));
  if (!ok) return { correct: false, message: "Enter a whole number for every signal.", explanation: q.explanation, invalid: true };
  const k = vals[0] / q.counts[0];
  const correct = vals.every((v, i) => Math.abs(v - k * q.counts[i]) < 1e-9);
  return { correct, message: correct ? `Correct: ${vals.join(" : ")} is in the ratio ${q.answer.join(" : ")}.` : `Not quite: the areas are in the ratio ${q.answer.join(" : ")}${q.counts.some((c, i) => c !== q.answer[i]) ? ` (counts ${q.counts.join(" : ")})` : ""}.`, explanation: q.explanation };
}

// ---------- Challenge 5: multiplicity of a selected environment ----------
export function splittingExplanation(mol, envId) {
  const env = mol.environments.find((e) => e.id === envId);
  const sets = neighbourSets(mol, envId);
  const n = sets.reduce((s, x) => s + x.count, 0);
  if (env.exchangeable) return `${env.label}: ${env.exchangeNote}`;
  if (n === 0) return `${env.label} (${env.count} H) has no non-equivalent hydrogen on the neighbouring atoms, so it is a singlet. The H within the group are equivalent and do not split each other.`;
  const names = sets.map((s) => `${s.count} H of ${mol.environments.find((e) => e.id === s.envId).label}`).join(" and ");
  const mult = MULT_NAMES[n];
  const base = `${env.label} (${env.count} H) has ${n} neighbouring H (${names}); n + 1 = ${n + 1}, a ${mult} with relative line intensities ${pascalOf(n)}.`;
  return sets.length > 1 ? `${base} Because there are two different neighbouring sets, this is a first-order approximation: it only looks like a ${mult} when both J values are similar.` : base;
}
const pascalOf = (n) => { let row = [1]; for (let i = 0; i < n; i += 1) { const nx = [1]; for (let k = 1; k < row.length; k += 1) nx.push(row[k - 1] + row[k]); nx.push(1); row = nx; } return row.join(":"); };

export function splittingQuestion(moleculeId, envId) {
  const mol = getMolecule(moleculeId);
  const row = spectrumRows(mol).find((r) => r.envId === envId);
  return {
    kind: "splitting", moleculeId: mol.id, envId, answer: row.mult.startsWith("multiplet") ? "multiplet" : row.mult,
    options: MULT_NAMES.slice(0, 7), explanation: splittingExplanation(mol, envId),
  };
}
export function checkSplitting(q, choice) {
  const correct = choice === q.answer;
  return { correct, message: correct ? `Correct: ${q.answer}.` : `Not quite: the answer is ${q.answer}, not ${choice}.`, explanation: q.explanation };
}

// ---------- Challenge 6: identify the molecule ----------
export function identifyQuestion(index = 0, seed = 7) {
  const setIdx = index % CANDIDATE_SETS.length;
  const set = CANDIDATE_SETS[setIdx];
  const round = Math.floor(index / CANDIDATE_SETS.length);
  const rnd = mulberry32(seed + index * 101);
  const target = set[Math.floor(rnd() * set.length)] ?? set[0];
  return { kind: "identify", index, setIndex: setIdx, targetId: target, candidates: shuffled(set, seed + setIdx * 13 + round), signature: spectrumSignature(getMolecule(target)) };
}

/** Differences between what the unknown spectrum shows and what a candidate would give (empty array = consistent). */
export function discrepancies(unknownId, candidateId) {
  const u = getMolecule(unknownId); const c = getMolecule(candidateId);
  const ur = spectrumRows(u); const cr = spectrumRows(c);
  const out = [];
  if (ur.length !== cr.length) out.push(`${c.name} would give ${cr.length} signal${cr.length === 1 ? "" : "s"} (it has ${cr.length} hydrogen environment${cr.length === 1 ? "" : "s"}), but the spectrum shows ${ur.length}.`);
  const ru = simplestRatio(ur.map((r) => r.count)).join(" : "); const rc = simplestRatio(cr.map((r) => r.count)).join(" : ");
  if (ur.length === cr.length && ru !== rc) out.push(`${c.name} would give an area ratio ${rc} (left to right), but the integration gives ${ru}.`);
  if (ur.length === cr.length) {
    const mu = ur.map((r) => r.abbr).join(", "); const mc = cr.map((r) => r.abbr).join(", ");
    if (mu !== mc) out.push(`${c.name} would give the multiplicities ${mc} (left to right); the spectrum shows ${mu}.`);
  }
  if (!out.length) {
    const du = ur.map((r) => r.delta); const dc = cr.map((r) => r.delta);
    if (du.some((d, i) => Math.abs(d - dc[i]) > 0.3)) out.push(`${c.name} has the same number of signals, ratio and splitting, but its chemical shifts are different from those in the spectrum.`);
  }
  return out;
}
export function checkIdentify(q, chosenId) {
  const target = getMolecule(q.targetId); const chosen = getMolecule(chosenId);
  const correct = chosenId === q.targetId;
  const rows = spectrumRows(target);
  const evidence = `Evidence: ${rows.length} signal${rows.length === 1 ? "" : "s"}, area ratio ${simplestRatio(rows.map((r) => r.count)).join(" : ")}, splitting ${rows.map((r) => r.abbr).join(", ")}, shifts ${rows.map((r) => r.delta.toFixed(1)).join(", ")} ppm.`;
  if (correct) return { correct, message: `Correct: it is ${target.name}.`, explanation: `${evidence} ${target.teacherNote}`, discrepancies: [] };
  const d = discrepancies(q.targetId, chosenId);
  return { correct, message: `Not ${chosen.name}.`, explanation: `${d.join(" ")} ${evidence}`, discrepancies: d };
}

export const ALL_ENV_SPLITTING_ITEMS = () => MOLECULES.flatMap((m) => m.environments.map((e) => ({ moleculeId: m.id, envId: e.id })));
