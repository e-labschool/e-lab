// Stage 12: identify an unknown from its mass spectrum. PURE (no React). Five rounds, one unknown at a time; five tasks per round:
//   1 molecular ion   2 base peak   3 significant fragment ions   4 isotope pattern   5 most likely compound.
// The candidate compounds of task 5 include same-nominal-mass look-alikes (ethanol / methoxymethane / methanoic acid all have M = 46, propanone / propanal /
// butane all have M = 58) so that the molecular-ion mass ALONE never settles the answer. Each candidate lists the ions a textbook would expect from it (`ions`,
// with the strongest in `strong`): this is reasoning data for a teaching score, NOT measured spectra of the distractors.
// SCORE (documented in docs/MASS_SPECTROMETRY.md):
//   +3  the candidate's nominal mass equals the molecular-ion peak
//   +4 x (share of the observed significant peaks (>= 10 %, satellites excluded) that the candidate's expected ions explain)
//   -3 x (share of the candidate's strongest expected ions that are missing from the observed peaks)
//   +2 / -3  the halogen pattern (none / Cl / Br) of the candidate agrees / disagrees with the observed 2 u pairs
// This is a teaching heuristic and not structure elucidation; the tests only guarantee that the true compound scores strictly highest in every round.
import { SPECTRA, SPECTRUM_IDS } from "../data/spectra.js";

export const ROUNDS = SPECTRUM_IDS;
export const ISO_OPTIONS = [
  { id: "none", label: "No 2 u pair", sub: "no Cl or Br (a tiny M+1 only)" },
  { id: "cl", label: "Pair 2 u apart, about 3 : 1", sub: "one chlorine" },
  { id: "br", label: "Pair 2 u apart, about 1 : 1", sub: "one bromine" },
];
export const TASKS = [
  { n: 1, id: "molecular", label: "Molecular ion", prompt: "Click the peak that is the molecular ion, then press “Use this peak”.", kind: "peak" },
  { n: 2, id: "base", label: "Base peak", prompt: "Click the base peak (the tallest), then press “Use this peak”.", kind: "peak" },
  { n: 3, id: "fragments", label: "Fragments", prompt: "Select the significant fragment ions (peaks of at least 10 % that are not the molecular ion or its isotope satellites).", kind: "peaks" },
  { n: 4, id: "isotopes", label: "Isotope pattern", prompt: "What isotope pattern does the molecular ion show?", kind: "choice" },
  { n: 5, id: "compound", label: "Compound", prompt: "Which compound is the most likely?", kind: "choice" },
];

const C = (id, name, formula, M, halogen, strong, ions, why) => ({ id, name, formula, M, halogen, strong, ions, why });
export const CANDIDATES = {
  methane: [
    C("methane", "Methane", "CH₄", 16, "none", [16, 15], [12, 13, 14, 15, 16], ""),
    C("ammonia", "Ammonia", "NH₃", 17, "none", [17, 16], [14, 15, 16, 17], "Ammonia has M = 17 and its tallest peak is at 17; here the heaviest main peak is 16 and the 17 is tiny (the ¹³C satellite)."),
    C("methanol", "Methanol", "CH₄O", 32, "none", [31, 32, 29], [15, 28, 29, 30, 31, 32], "Methanol would show its molecular ion at 32 and a strong 31; nothing above 17 is seen here."),
    C("ethane", "Ethane", "C₂H₆", 30, "none", [28, 27, 30], [26, 27, 28, 29, 30], "Ethane would give M = 30 with strong peaks at 28 and 27; nothing above 17 is seen here."),
  ],
  ethanol: [
    C("ethanol", "Ethanol", "C₂H₆O", 46, "none", [31, 45, 46], [27, 29, 31, 43, 45, 46], ""),
    C("methoxymethane", "Methoxymethane", "C₂H₆O", 46, "none", [45, 46, 29, 15], [15, 29, 45, 46], "Same formula and same M = 46, but an ether's base peak is m/z 45 (and it shows a strong 15), whereas here the tallest peak is 31 and there is no strong 15."),
    C("methanoic-acid", "Methanoic acid", "CH₂O₂", 46, "none", [46, 45, 29, 17], [17, 28, 29, 45, 46], "Also M = 46, but it would show strong peaks at 29 and 17 and its tallest peak is not 31."),
    C("propan-1-ol", "Propan-1-ol", "C₃H₈O", 60, "none", [31, 60, 59], [29, 31, 42, 59, 60], "Also a primary alcohol with a 31 peak, but its molecular mass is 60 and there is no peak at 60 or 59 here: the heaviest main peak is 46."),
  ],
  propanone: [
    C("propanone", "Propanone", "C₃H₆O", 58, "none", [43, 58, 15], [15, 43, 58], ""),
    C("propanal", "Propanal", "C₃H₆O", 58, "none", [29, 58, 57], [27, 28, 29, 57, 58], "Same formula, M = 58, but an aldehyde gives its tallest peaks at 29 (and 57 for M – 1), not at 43; there is no 29 or 57 here."),
    C("butane", "Butane", "C₄H₁₀", 58, "none", [43, 29, 41, 27, 58], [27, 29, 41, 43, 58], "Also M = 58 and a strong 43, but an alkane would give a family of peaks at 41, 29 and 27; the spectrum here is much simpler and has a 15 peak."),
    C("ethanal", "Ethanal", "C₂H₄O", 44, "none", [29, 44, 43], [15, 29, 43, 44], "Ethanal has M = 44, which is below the heaviest main peak (58) seen here."),
  ],
  chloromethane: [
    C("chloromethane", "Chloromethane", "CH₃Cl", 50, "cl", [50, 52, 15], [15, 35, 37, 49, 50, 51, 52], ""),
    C("bromomethane", "Bromomethane", "CH₃Br", 94, "br", [94, 96, 15], [15, 79, 81, 93, 94, 95, 96], "A bromine compound gives a 1 : 1 pair; the pair here is about 3 : 1 and its mass is 50, not 94."),
    C("chloroethane", "Chloroethane", "C₂H₅Cl", 64, "cl", [64, 66, 29, 28], [27, 28, 29, 64, 65, 66], "Also contains Cl (a 3 : 1 pair), but its molecular ion would be at 64 and 66 with strong peaks at 29 and 28."),
    C("fluoromethane", "Fluoromethane", "CH₃F", 34, "none", [34, 33, 15], [15, 33, 34], "Fluorine has a single isotope, so there is no 2 u pair; here a 3 : 1 pair is the signature of chlorine."),
  ],
  bromomethane: [
    C("bromomethane", "Bromomethane", "CH₃Br", 94, "br", [94, 96, 15], [15, 79, 81, 93, 94, 95, 96], ""),
    C("chloromethane", "Chloromethane", "CH₃Cl", 50, "cl", [50, 52, 15], [15, 35, 37, 49, 50, 51, 52], "A chlorine compound gives a 3 : 1 pair; the pair here is about 1 : 1 and its mass is 94, not 50."),
    C("iodomethane", "Iodomethane", "CH₃I", 142, "none", [142, 127, 15], [15, 127, 142], "Iodine has a single isotope (no 2 u pair), its molecular ion would be at 142 and it shows a strong I⁺ at 127; neither is seen here."),
    C("bromoethane", "Bromoethane", "C₂H₅Br", 108, "br", [108, 110, 29, 27], [27, 28, 29, 79, 81, 108, 109, 110], "Also a 1 : 1 bromine pair, but at 108/110 with a strong 29 (C₂H₅⁺); here the pair is at 94/96."),
  ],
};

export function observedFeatures(spec) {
  const sig = spec.peaks.filter((p) => p.rel >= 10 && p.derived !== "13C");
  const present = new Set(spec.peaks.filter((p) => p.rel >= 5 && p.derived !== "13C").map((p) => p.mz));
  return { sig, present, M: spec.mMz, halogen: spec.isotopePattern };
}
export function scoreCandidate(cand, spec) {
  const o = observedFeatures(spec); const ions = new Set(cand.ions);
  const explained = o.sig.filter((p) => ions.has(p.mz)).length / o.sig.length;
  const missing = cand.strong.filter((mz) => !o.present.has(mz)).length / cand.strong.length;
  const mTerm = cand.M === o.M ? 3 : 0;
  const hTerm = cand.halogen === o.halogen ? 2 : -3;
  return { id: cand.id, score: mTerm + 4 * explained - 3 * missing + hTerm, mTerm, explained, missing, hTerm };
}
export function rankCandidates(roundId) {
  const spec = SPECTRA[roundId];
  return CANDIDATES[roundId].map((c) => scoreCandidate(c, spec)).sort((a, b) => b.score - a.score);
}
/** nominal-mass-only ambiguity: how many candidates share the molecular-ion mass of the unknown */
export const sameMassCandidates = (roundId) => CANDIDATES[roundId].filter((c) => c.M === SPECTRA[roundId].mMz);

export const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** candidates in a reproducible shuffled order (the true one is not always first) */
export function candidateOrder(roundId, seed = 1) {
  const rnd = mulberry32(seed * 7919 + ROUNDS.indexOf(roundId) * 131 + 17);
  const a = CANDIDATES[roundId].map((c) => c.id);
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- guided hints (no answer leakage: they describe the clicked peak and give method hints; they never say "this is the molecular ion / base peak") ----
export const COMMON_LOSSES = { 1: "H•", 2: "H₂", 15: "•CH₃", 16: "•NH₂ or O", 17: "•OH or NH₃", 18: "H₂O", 28: "CO or C₂H₄", 29: "C₂H₅• or •CHO", 31: "•OCH₃ or CH₃NH₂", 35: "Cl•", 36: "HCl", 43: "C₃H₇• or CH₃CO•", 45: "C₂H₅O• or COOH•", 79: "Br•" };
export function peakHint(spec, mz) {
  const p = spec.byMz[mz]; if (!p) return null;
  const lines = [`m/z ${mz}: height ${p.rel >= 10 ? Math.round(p.rel) : p.rel.toFixed(1)} % of the tallest peak.`];
  const up1 = spec.byMz[mz + 1]; const up2 = spec.byMz[mz + 2]; const dn2 = spec.byMz[mz - 2];
  if (up1 && up1.rel < 0.06 * p.rel + 3 && up1.rel < 5) lines.push("A very small peak one unit higher is the signature of ¹³C (about 1.1 % per carbon atom), not a new ion.");
  if (up2 && up2.rel >= 0.2 * p.rel && up2.rel <= 1.1 * p.rel) lines.push(`There is a partner peak 2 u higher at m/z ${mz + 2} (${(100 * up2.rel / p.rel).toFixed(0)} % of this one). Two peaks 2 u apart point to chlorine (about 3 : 1) or bromine (about 1 : 1).`);
  else if (dn2 && dn2.rel >= 0.9 * p.rel && dn2.rel <= 5 * p.rel) lines.push(`This looks like the heavier partner of the peak at m/z ${mz - 2} (this one is ${(100 * p.rel / dn2.rel).toFixed(0)} % of it): a pair 2 u apart.`);
  const dn1 = spec.byMz[mz - 1]; const isSatellite = dn1 && p.rel < 5 && p.rel < 0.06 * dn1.rel + 3;
  if (isSatellite) { lines.push("A tiny peak one unit above a much taller one is the ¹³C satellite of that ion, not a new ion."); return { mz, rel: p.rel, lines }; }
  const main = spec.peaks.filter((q) => q.rel >= 5 && q.derived !== "13C");
  const heaviest = main.reduce((m, q) => Math.max(m, q.mz), 0);
  if (mz < heaviest) { const d = heaviest - mz; const loss = COMMON_LOSSES[d]; lines.push(`It is ${d} u below the heaviest main peak (m/z ${heaviest}). ${loss ? `A loss of ${d} u is typically ${loss}.` : `A loss of ${d} u is not one of the usual small neutral losses.`}`); }
  else lines.push("It is the heaviest main peak. The molecular ion is the heaviest ion made from the whole molecule; ignore tiny satellites one unit above.");
  return { mz, rel: p.rel, lines };
}

// ---- evaluating the answers ----
export function evaluateAnswers(roundId, picks) {
  const spec = SPECTRA[roundId];
  const m2 = spec.peaks.find((p) => p.role === "M+2")?.mz ?? null;
  const t1 = picks.t1 === spec.mMz ? "correct" : picks.t1 !== null && picks.t1 === m2 ? "partial" : "wrong";
  const t2 = picks.t2 === spec.baseMz ? "correct" : "wrong";
  const truth = new Set(spec.significant); const sel = new Set(picks.t3 ?? []);
  const hit = [...sel].filter((m) => truth.has(m)).length; const t3 = hit === truth.size && sel.size === truth.size ? "correct" : hit > 0 ? "partial" : "wrong";
  const t4 = picks.t4 === spec.isotopePattern ? "correct" : "wrong";
  const t5 = picks.t5 === roundId ? "correct" : "wrong";
  return { t1, t2, t3, t4, t5, all: [t1, t2, t3, t4, t5].every((x) => x === "correct") };
}
export const answered = (picks) => picks.t1 !== null && picks.t2 !== null && (picks.t3 ?? []).length > 0 && picks.t4 !== null && picks.t5 !== null;
export const EMPTY_PICKS = Object.freeze({ t1: null, t2: null, t3: [], t4: null, t5: null });
