// Challenge mode (Predict -> Build -> Observe -> Explain): pure answer checking, no React.
import { ED_NAMES, axePlain, axeNotation } from "./geometry.js";
import { PRESETS } from "./presets.js";

export const CHALLENGE_STEPS = ["predict", "build", "observe", "explain"];
export const CHALLENGE_STEP_LABELS = { predict: "Predict", build: "Build", observe: "Observe", explain: "Explain" };

export const DOMAIN_OPTIONS = [2, 3, 4, 5, 6];
export const LONE_PAIR_OPTIONS = [0, 1, 2, 3];
export const ED_OPTIONS = ["Linear", "Trigonal planar", "Tetrahedral", "Trigonal bipyramidal", "Octahedral"];
export const MG_OPTIONS = ["Linear", "Bent", "Trigonal planar", "Trigonal pyramidal", "Tetrahedral", "Seesaw", "T-shaped", "Trigonal bipyramidal", "Square planar", "Square pyramidal", "Octahedral"];
export const AXE_OPTIONS = [[2, 0], [3, 0], [2, 1], [4, 0], [3, 1], [2, 2], [5, 0], [4, 1], [3, 2], [2, 3], [6, 0], [5, 1], [4, 2]].map(([b, l]) => ({ value: axePlain(b, l), label: axeNotation(b, l) }));
export const ANGLE_OPTIONS = [
  { value: "90", label: "about 90°" }, { value: "102", label: "about 102°" }, { value: "104.5", label: "about 104.5°" }, { value: "107", label: "about 107°" },
  { value: "109.5", label: "109.5°" }, { value: "113", label: "about 113°" }, { value: "116", label: "about 115–117°" }, { value: "120", label: "about 120°" }, { value: "180", label: "180° (or close to it)" },
];

/** Deterministic molecule order for the activity (a fixed shuffle, so tests and sessions are reproducible). */
const FIXED_START = ["h2o", "ch4", "nh3", "bf3", "co2", "sf6", "so2", "pcl5", "xef4", "sf4", "becl2", "brf5", "clf3", "xef2", "hcn", "so3", "h2s", "ch2o"];
export const CHALLENGE_ORDER = [...FIXED_START, ...PRESETS.map((p) => p.id).filter((id) => !FIXED_START.includes(id))].filter((id) => PRESETS.some((p) => p.id === id));

export const emptyAnswers = () => ({ domains: "", lonePairs: "", ed: "", mg: "", axe: "", angle: "" });
export const isComplete = (a) => Object.values(a).every((v) => v !== "");

/** Check a prediction against the validated preset. Returns { fields: [{key,label,correct,yours,expected,message}], score, total }. */
export function checkPrediction(preset, a, { hinted = false } = {}) {
  const n = preset.domains; const l = preset.lonePairs; const b = preset.bonding;
  const name = preset.display;
  const yourDomains = Number(a.domains); const yourL = Number(a.lonePairs);
  const fields = [];
  const push = (key, label, correct, yours, expected, message) => fields.push({ key, label, correct, yours, expected, message });
  push("domains", "Electron domains", yourDomains === n, a.domains, String(n),
    yourDomains === n ? `Yes: ${b} bonding domain${b > 1 ? "s" : ""}${l ? ` + ${l} lone pair${l > 1 ? "s" : ""}` : ""} = ${n}. A double or triple bond still counts as ONE domain.`
      : `Count domains on the central ${preset.central}: ${b} surrounding atom${b > 1 ? "s" : ""} (each bond, whatever its order, is one domain) plus ${l} lone pair${l === 1 ? "" : "s"} = ${n}.`);
  push("lonePairs", "Lone pairs on the central atom", yourL === l, a.lonePairs, String(l),
    yourL === l ? `Correct: ${l} lone pair${l === 1 ? "" : "s"} on ${preset.central}.` : `${preset.central} has ${l} lone pair${l === 1 ? "" : "s"}. Lone pairs on the surrounding atoms do not count: only the central atom's domains decide the shape.`);
  push("ed", "Electron-domain geometry", a.ed === preset.ed, a.ed, preset.ed,
    a.ed === preset.ed ? `${n} domains spread out as ${preset.ed.toLowerCase()}.` : `${n} electron domains arrange as ${preset.ed.toLowerCase()}${a.ed && a.ed === ED_NAMES[yourDomains] ? ` (your answer fits ${yourDomains} domains, not ${n})` : ""}. Count lone pairs as domains.`);
  push("mg", "Molecular geometry", a.mg === preset.mg, a.mg, preset.mg,
    a.mg === preset.mg ? `Only the atoms define the molecular shape: ${preset.mg.toLowerCase()}.` : `The molecular geometry names the arrangement of ATOMS only. With ${b} atoms and ${l} lone pair${l === 1 ? "" : "s"} on a ${preset.ed.toLowerCase()} arrangement the shape is ${preset.mg.toLowerCase()}.`);
  push("axe", "AXE notation", a.axe === axePlain(b, l), a.axe, axeNotation(b, l),
    a.axe === axePlain(b, l) ? `${axeNotation(b, l)}: A = central atom, X = ${b} bonded atom${b > 1 ? "s" : ""}, E = ${l} lone pair${l === 1 ? "" : "s"}.` : `A is the central atom, X the number of bonded atoms (${b}) and E the lone pairs (${l}): ${axeNotation(b, l)}.`);
  // ALL distinct bond angles of the molecule must be chosen (answers.angle is a comma-separated list of option values)
  const accepted = [...new Set(preset.challengeAngles.map(String))].sort();
  const chosen = String(a.angle ?? "").split(",").filter(Boolean).sort();
  const angleOk = chosen.length === accepted.length && chosen.every((v, i) => v === accepted[i]);
  const angleLabels = (vals) => vals.map((v) => ANGLE_OPTIONS.find((o) => o.value === v)?.label ?? `${v}°`).join(" + ");
  push("angle", "Bond angle(s)", angleOk, chosen.length ? angleLabels(chosen) : "", preset.angles.map((x) => `${x.kind === "approx" ? "≈" : ""}${x.value}°`).join(" / "),
    angleOk ? `Good: ${preset.angles.map((x) => `${x.label} ${x.kind === "approx" ? "≈ " : ""}${x.value}°`).join("; ")}.`
      : `For ${name} the angle${preset.angles.length > 1 ? "s are" : " is"} ${preset.angles.map((x) => `${x.label} ${x.kind === "approx" ? "≈ " : ""}${x.value}°`).join("; ")}${accepted.length > 1 ? ` (select every distinct angle: ${accepted.length} here)` : ""}. ${l > 0 ? "Lone pairs repel more strongly than bonding pairs, so angles are a little smaller than the ideal." : "With no lone pairs the angles are the ideal ones for this arrangement."}`);
  // a hint hands over the two counting answers: they are shown as given and do not score
  if (hinted) for (const f of fields) if (f.key === "domains" || f.key === "lonePairs") { f.given = true; f.correct = true; }
  const scored = fields.filter((f) => !f.given);
  const score = scored.filter((f) => f.correct).length;
  return { fields, score, total: scored.length, hinted };
}

/** Compare the student's built model with the target molecule (by central atom, bonding domains and lone pairs). */
export function compareBuild(preset, cls) {
  if (!cls?.hasCentral || cls.n === 0) return { built: false, text: "You did not build a model, which is fine. Use the buttons below to load the real one." };
  const same = cls.b === preset.bonding && cls.l === preset.lonePairs;
  if (same) return { built: true, match: true, text: `Your model has ${cls.b} bonding + ${cls.l} lone pair domain${cls.l === 1 ? "" : "s"} (${cls.axe}), which matches ${preset.display}.` };
  return { built: true, match: false, text: `Your model is ${cls.axe} (${cls.b} bonding + ${cls.l} lone pair${cls.l === 1 ? "" : "s"}); ${preset.display} is ${preset.axe} (${preset.bonding} bonding + ${preset.lonePairs}).` };
}


// ---------------------------------------------------------------------------------------------------------------
// Scored round (pure): level, seeded random order, score, streak, hint, summary.
// ---------------------------------------------------------------------------------------------------------------
export const LEVELS = [
  { id: "sl", label: "Standard level", sub: "2-4 domains", test: (p) => p.domains <= 4 && !p.charge },
  { id: "hl", label: "Higher level", sub: "5-6 domains", test: (p) => p.domains >= 5 },
  { id: "ions", label: "Ions", sub: "polyatomic ions", test: (p) => p.charge !== 0 },
  { id: "all", label: "Everything", sub: "all species", test: () => true },
];
export const ROUND_LENGTH = 8;
export function mulberry32(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Deterministic for a given seed: ids of the molecules in a round. */
export function buildRound(levelId, seed = 1, length = ROUND_LENGTH) {
  const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[3];
  const pool = PRESETS.filter(level.test).map((p) => p.id); const rnd = mulberry32(seed);
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, Math.min(length, pool.length));
}
export const emptyScore = () => ({ results: [], points: 0, possible: 0, streak: 0, bestStreak: 0 });
/** Add one checked molecule (first check only). A "perfect" answer extends the streak. */
export function recordResult(score, preset, result) {
  const perfect = result.score === result.total; const streak = perfect ? score.streak + 1 : 0;
  return {
    results: [...score.results, { id: preset.id, display: preset.display, score: result.score, total: result.total, hinted: !!result.hinted, missed: result.fields.filter((f) => !f.correct).map((f) => f.key) }],
    points: score.points + result.score, possible: score.possible + result.total, streak, bestStreak: Math.max(score.bestStreak, streak),
  };
}
export function summarise(score) {
  const miss = {}; for (const r of score.results) for (const k of r.missed) miss[k] = (miss[k] ?? 0) + 1;
  const worst = Object.entries(miss).sort((a, b) => b[1] - a[1])[0] ?? null;
  const pct = score.possible ? Math.round((100 * score.points) / score.possible) : 0;
  return { pct, worst: worst ? { key: worst[0], count: worst[1] } : null, text: `VSEPR challenge: ${score.points} / ${score.possible} (${pct}%). ${score.results.map((r) => `${r.display} ${r.score}/${r.total}${r.hinted ? " (hint)" : ""}`).join("; ")}.` };
}
