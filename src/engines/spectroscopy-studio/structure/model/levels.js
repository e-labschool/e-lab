// Difficulty levels, the order of the unknowns and the order of the four choices. PURE and DETERMINISTIC: nothing here uses Math.random.
import { COMPOUNDS, COMPOUND_IDS } from "../data/compounds.js";

export const LEVELS = [
  {
    id: "foundation", label: "Foundation", letter: "A", formulaGiven: true, hints: 3, justification: false, integration: "count", markersDefault: true, guided: true,
    summary: "The molecular formula is given, the characteristic peaks are clear, and guided questions and up to three hints are available. Some of the four choices have a different formula from the one given (you can rule them out with the formula).",
  },
  {
    id: "intermediate", label: "Intermediate", letter: "B", formulaGiven: false, hints: 2, justification: false, integration: "relative", markersDefault: false, guided: false,
    summary: "No formula is given. All four choices have the same molar mass, so you must use the integration ratios and splitting patterns, and the IR groups, to choose between isomers. Two hints.",
  },
  {
    id: "advanced", label: "Advanced", letter: "C", formulaGiven: false, hints: 1, justification: true, integration: "relative", markersDefault: false, guided: false,
    summary: "No formula, weak molecular ions, more complex fragmentation, overlapping NMR signals where it is realistic, one hint, and a written justification before you can submit.",
  },
];
export const LEVEL_IDS = LEVELS.map((l) => l.id);
export const getLevel = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
export const compoundsOfLevel = (levelId) => COMPOUND_IDS.filter((id) => COMPOUNDS[id].level === levelId);
export const MIN_JUSTIFICATION_WORDS = 12;

/** "Unknown A01": the letter belongs to the level, the number to the position of the unknown within the level. */
export const sampleId = (levelId, index) => `Unknown ${getLevel(levelId).letter}${String(index + 1).padStart(2, "0")}`;

// ---- deterministic order of the four choices ----
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** The four structure ids in display order (a seeded shuffle keyed on the compound: the same unknown always shows the same order). */
export function choiceOrder(compoundId) {
  const arr = [...COMPOUNDS[compoundId].choices]; const rnd = mulberry32(hash(`choices:${compoundId}`));
  for (let i = arr.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
export const wordCount = (text) => (String(text ?? "").trim().match(/\S+/g) ?? []).length;
export const justificationOk = (text) => wordCount(text) >= MIN_JUSTIFICATION_WORDS;
