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
  { value: "109.5", label: "109.5°" }, { value: "120", label: "about 120°" }, { value: "180", label: "180° (or close to it)" },
];

/** Deterministic molecule order for the activity (a fixed shuffle, so tests and sessions are reproducible). */
export const CHALLENGE_ORDER = ["h2o", "ch4", "nh3", "bf3", "co2", "sf6", "so2", "pcl5", "xef4", "sf4", "becl2", "brf5", "clf3", "xef2", "hcn", "so3", "h2s", "ch2o"]
  .filter((id) => PRESETS.some((p) => p.id === id));

export const emptyAnswers = () => ({ domains: "", lonePairs: "", ed: "", mg: "", axe: "", angle: "" });
export const isComplete = (a) => Object.values(a).every((v) => v !== "");

/** Check a prediction against the validated preset. Returns { fields: [{key,label,correct,yours,expected,message}], score, total }. */
export function checkPrediction(preset, a) {
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
  const accepted = preset.challengeAngles.map(String);
  push("angle", "Approximate bond angle", accepted.includes(a.angle), a.angle ? `${a.angle}°` : "", preset.angles.map((x) => `${x.kind === "approx" ? "≈" : ""}${x.value}°`).join(" / "),
    accepted.includes(a.angle) ? `Good: ${preset.angles.map((x) => `${x.label} ${x.kind === "approx" ? "≈ " : ""}${x.value}°`).join("; ")}.`
      : `For ${name} the angle${preset.angles.length > 1 ? "s are" : " is"} ${preset.angles.map((x) => `${x.label} ${x.kind === "approx" ? "≈ " : ""}${x.value}°`).join("; ")}. ${l > 0 ? "Lone pairs repel more strongly than bonding pairs, so angles are a little smaller than the ideal." : "With no lone pairs the angles are the ideal ones for this arrangement."}`);
  const score = fields.filter((f) => f.correct).length;
  return { fields, score, total: fields.length };
}

/** Compare the student's built model with the target molecule (by central atom, bonding domains and lone pairs). */
export function compareBuild(preset, cls) {
  if (!cls?.hasCentral || cls.n === 0) return { built: false, text: "You did not build a model, which is fine. Use the buttons below to load the real one." };
  const same = cls.b === preset.bonding && cls.l === preset.lonePairs;
  if (same) return { built: true, match: true, text: `Your model has ${cls.b} bonding + ${cls.l} lone pair domain${cls.l === 1 ? "" : "s"} (${cls.axe}), which matches ${preset.display}.` };
  return { built: true, match: false, text: `Your model is ${cls.axe} (${cls.b} bonding + ${cls.l} lone pair${cls.l === 1 ? "" : "s"}); ${preset.display} is ${preset.axe} (${preset.bonding} bonding + ${preset.lonePairs}).` };
}
