// Unknown-compound challenge logic (stage 9) and the spectrum helpers of stage 8 (pure).
//
// A round = one unknown spectrum (the representative bands of one compound, with small random position / intensity changes so that no two rounds are
// identical) + three or four candidate structures. Students read DIAGNOSTIC FEATURES from the picture (broad O–H, very broad acid O–H, C=O, aldehyde C–H,
// strong C–O); a deliberately simple scoring then says how well each candidate explains them:
//     for every diagnostic group the candidate expects  (1): +1 if a matching feature is seen, -2 if not
//     for every group the candidate should NOT show     (0): -2 if a matching feature IS seen
//     groups marked "opt" (e.g. C–O for a ketone, whose C–C(=O)–C stretch lies in the same region) are not scored.
// This is a teaching heuristic, NOT a structure-elucidation algorithm: the tests only check that each round has exactly one best candidate.
import { COMPOUNDS } from "../data/compounds.js";
import { analyseSpectrum, buildSpectrum, wavenumberGrid } from "./spectrum.js";

export const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const shuffled = (list, rnd) => { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Bands of a compound with a reproducible small perturbation (positions ±(3% of width, at most 8 cm^-1), absorbance ±8 %). jitter = 0 gives the data as stored. */
export function jitteredBands(id, seed = 0, amount = 1) {
  const rnd = mulberry32(seed * 7919 + 13);
  return COMPOUNDS[id].bands.map((b) => ({ ...b, nu: b.nu + amount * (rnd() * 2 - 1) * Math.min(8, 0.06 * b.fwhm + 2), A: b.A * (1 + amount * (rnd() * 2 - 1) * 0.08), fwhm: b.fwhm * (1 + amount * (rnd() * 2 - 1) * 0.06) }));
}
const GRID = wavenumberGrid(2);
export const compoundSpectrum = (id, seed = 0, amount = 0) => { const bands = jitteredBands(id, seed, amount); return { bands, ...buildSpectrum(bands, GRID) }; };

/** Diagnostic groups and the rule that finds them among the features of a spectrum ({nu, A, fwhm}). */
export const DIAGNOSTIC = [
  { id: "oh-alc", label: "O–H (alcohol)", seen: (f) => f.nu >= 3200 && f.nu <= 3600 && f.fwhm >= 150 && f.fwhm < 400, text: "a broad, strong band between 3200 and 3600 cm⁻¹" },
  { id: "oh-acid", label: "O–H (carboxylic acid)", seen: (f) => f.nu >= 2500 && f.nu <= 3300 && f.fwhm >= 400, text: "a very broad band covering about 2500–3300 cm⁻¹" },
  { id: "cdo", label: "C=O", seen: (f) => f.nu >= 1650 && f.nu <= 1750 && f.A >= 0.5, text: "a strong, sharp band between 1650 and 1750 cm⁻¹" },
  { id: "aldch", label: "aldehyde C–H", seen: (f) => f.nu >= 2700 && f.nu <= 2850 && f.fwhm < 80 && f.A >= 0.12, text: "weak, sharp band(s) near 2700–2850 cm⁻¹ (below the ordinary C–H bands)" },
  { id: "co", label: "C–O", seen: (f) => f.nu >= 1050 && f.nu <= 1410 && f.A >= 0.4, text: "a strong band between 1050 and 1410 cm⁻¹" },
];
export const observedGroups = (features) => Object.fromEntries(DIAGNOSTIC.map((d) => [d.id, features.some(d.seen)]));
export const featuresOf = (spec) => analyseSpectrum(spec, { minA: 0.08, minProminence: 0.04 });

export function scoreCandidate(candidateId, observed) {
  const expect = COMPOUNDS[candidateId].expect; let score = 0; const missing = []; const unexpected = []; const matched = [];
  for (const d of DIAGNOSTIC) {
    const e = expect[d.id]; const o = observed[d.id];
    if (e === 1) { if (o) { score += 1; matched.push(d.id); } else { score -= 2; missing.push(d.id); } }
    else if (e === 0 && o) { score -= 2; unexpected.push(d.id); }
  }
  return { score, missing, unexpected, matched };
}

/** The candidate groups of the rounds: the unknown plus 2-3 others from the same set, chosen so the simple scoring has exactly one best answer. */
export const CHALLENGES = [
  { id: "c-ethanol", unknown: "ethanol", others: ["ethanal", "ethyl-ethanoate", "ethanoic-acid"] },
  { id: "c-propanone", unknown: "propanone", others: ["ethanal", "ethanol", "ethanoic-acid"] },
  { id: "c-acid", unknown: "ethanoic-acid", others: ["ethyl-ethanoate", "propanone", "propan-1-ol"] },
  { id: "c-ester", unknown: "ethyl-ethanoate", others: ["propanone", "ethanoic-acid", "propan-1-ol"] },
  { id: "c-ethanal", unknown: "ethanal", others: ["propanone", "ethanol", "ethanoic-acid"] },
  { id: "c-propanol", unknown: "propan-1-ol", others: ["propanone", "ethanal", "ethanoic-acid"] },
  { id: "c-ethanol3", unknown: "ethanol", others: ["propanone", "ethyl-ethanoate"] },
  { id: "c-ethanal3", unknown: "ethanal", others: ["ethanol", "ethanoic-acid"] },
];

/** Round number r of the challenge series with the given seed: which challenge, the candidates in a shuffled order, and the perturbation seed. */
export function makeRound(seed, r) {
  const rnd = mulberry32(seed * 104729 + 31);
  const order = []; let pool = [];
  for (let i = 0; i <= r; i += 1) { if (!pool.length) pool = shuffled(CHALLENGES.map((_, k) => k), rnd); order.push(pool.shift()); }
  const ch = CHALLENGES[order[r]];
  const rnd2 = mulberry32(seed * 15485863 + r * 97 + 5);
  const candidates = shuffled([ch.unknown, ...ch.others], rnd2);
  return { r, challengeId: ch.id, unknown: ch.unknown, candidates, jitterSeed: Math.floor(rnd2() * 1e6) + 1 };
}

export function evaluateRound(round) {
  const spec = compoundSpectrum(round.unknown, round.jitterSeed, 1);
  const features = featuresOf(spec); const observed = observedGroups(features);
  const scores = round.candidates.map((id) => ({ id, ...scoreCandidate(id, observed) })).sort((a, b) => b.score - a.score);
  return { spec, features, observed, scores, best: scores[0].id, unique: scores.length < 2 || scores[0].score > scores[1].score };
}

const GROUP_LABEL = Object.fromEntries(DIAGNOSTIC.map((d) => [d.id, d.label]));
export const groupLabel = (id) => GROUP_LABEL[id] ?? id;
