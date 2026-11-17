// Quiz mode (predict first): every question's correct answer is COMPUTED from the same property data and run models the
// simulation uses, so the quiz can never disagree with what the student sees when they press "Watch it run".
import { SUBSTANCES, crystalsAt, subName } from "./chem.js";
import { MIXTURES, getMixture, sampleOf } from "./mixtures.js";
import { METHODS, getMethod } from "./methods.js";
import { runToEnd } from "./runs.js";
import { rfFrom, measureRf } from "./chromatography.js";
import { makeRng } from "../../../lib/particles/particleCore.js";

const shuffle = (arr, rng) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const lc = (s) => s[0].toLowerCase() + s.slice(1);
const listNames = (subs) => (subs.length ? subs.map((id) => lc(subName(id))).join(" and ") : "nothing");

function finish(q, rng) {
  // q.options: array of strings with q.correct as the right one; remove duplicates, pad if needed, shuffle
  const uniq = [...new Set(q.options)];
  const opts = shuffle(uniq, rng);
  return { ...q, options: opts, answer: opts.indexOf(q.correctText) };
}

/** Which method should be used? (one-step mixtures only) */
function qBestMethod(rng) {
  const m = pick(MIXTURES.filter((x) => !x.needsSteps), rng);
  const best = pick(m.best, rng);
  const wrong = METHODS.filter((meth) => meth.id !== "dissolve" && !m.best.includes(meth.id)).filter((meth) => { const { result } = runToEnd(meth.id, sampleOf(m), { solvent: m.id === "permanent-marker" ? "ethanol" : "water" }); return result.verdict === "fails" || result.verdict === "unsafe" || result.verdict === "reaction"; });
  const picks = shuffle(wrong, rng).slice(0, 3);
  return finish({ kind: "best", prompt: `Which method is best for separating ${lc(m.name)} (${m.short.toLowerCase()})?`, correctText: getMethod(best).label, options: [getMethod(best).label, ...picks.map((p) => p.label)], why: m.deciding, see: { mixtureId: m.id, methodId: best } }, rng);
}

/** What ends up in the filtrate? computed by running the filtration. */
function qFiltrate(rng) {
  const m = getMixture(pick(["muddy-water", "salt-solution", "copper-sulfate", "oil-water"], rng));
  const { result } = runToEnd("filtration", sampleOf(m));
  const filtrate = result.outputs.find((o) => o.id === "filtrate");
  const subs = [...new Set(filtrate.sample.parts.map((p) => p.sub))];
  const phrase = (list) => (list.length === 1 ? `${lc(subName(list[0]))} only` : list.map((s) => lc(subName(s))).join(" and "));
  const correct = phrase(subs);
  const all = [...new Set(m.parts.map((p) => p.sub))];
  const options = [correct, ...all.map((s) => phrase([s])), phrase(all), "nothing: it all stays on the paper"];
  return finish({ kind: "filtrate", prompt: `You filter ${lc(m.name)} through filter paper. What passes through into the beaker (the filtrate)?`, correctText: correct, options, why: result.lines.join(" "), see: { mixtureId: m.id, methodId: "filtration" } }, rng);
}

function qFirstOver(rng) {
  const sets = [["ethanol", "water"], ["hexane", "decane", "hexadecane"]];
  const ids = pick(sets, rng); const first = [...ids].sort((a, b) => SUBSTANCES[a].bp - SUBSTANCES[b].bp)[0];
  const mix = ids.includes("ethanol") ? "ethanol-water" : "crude-oil";
  return finish({ kind: "first", prompt: `${ids.includes("ethanol") ? "Ethanol (boiling point 78 °C) and water (100 °C)" : "A mixture of hexane (69 °C), decane (174 °C) and hexadecane (287 °C)"} are fractionally distilled. Which comes off FIRST?`, correctText: subName(first), options: ids.map((i) => subName(i)), why: `The liquid with the lowest boiling point is the most volatile, so it reaches the top of the column first (${subName(first)}, ${SUBSTANCES[first].bp} °C).`, see: { mixtureId: mix, methodId: "fractional-distillation" } }, rng);
}

function qHeadTemp(rng) {
  const { run } = runToEnd("fractional-distillation", sampleOf(getMixture("ethanol-water")));
  const plateau = run.series.map((r) => r[2]).filter((v) => v > 70 && v < 85).sort((a, b) => a - b); const t = plateau.length ? Math.round(plateau[Math.floor(plateau.length / 2)]) : 78;
  const near = Math.round(t / 2) * 2;
  return finish({ kind: "head", prompt: "During the first part of the fractional distillation of ethanol and water, the thermometer at the top of the column holds steady. Near which temperature?", correctText: `about ${t} °C`, options: [`about ${t} °C`, "about 100 °C", "about 60 °C", "it keeps rising steadily"], why: `Ethanol (bp 78 °C) is leaving, so the vapour at the top is at ethanol's boiling point (the thermometer read about ${near}). It only rises towards 100 °C when the ethanol has gone and water takes over.`, see: { mixtureId: "ethanol-water", methodId: "fractional-distillation" } }, rng);
}

function qRf(rng) {
  const front = 6 + Math.round(rng() * 40) / 10; const spot = Math.round((0.2 + rng() * 0.6) * front * 10) / 10;
  const m = measureRf(spot, front); const right = m.rf.toFixed(2);
  const inv = (front / spot).toFixed(2); const diff = ((front - spot) / front).toFixed(2); const half = (spot / (front + 1.5)).toFixed(2);
  return finish({ kind: "rf", prompt: `On a chromatogram a spot has moved ${spot.toFixed(1)} cm and the solvent front ${front.toFixed(1)} cm, both measured from the baseline. What is the Rf value?`, correctText: right, options: [right, inv, diff, half], why: `Rf = spot distance ÷ solvent distance = ${spot.toFixed(1)} ÷ ${front.toFixed(1)} = ${right}. It can never be more than 1, because a spot cannot travel further than the solvent.`, see: { mixtureId: "black-ink", methodId: "chromatography" } }, rng);
}

function qFurthest(rng) {
  const dyes = ["dyeYellow", "dyeRed", "dyeBlue"]; const sorted = [...dyes].sort((a, b) => SUBSTANCES[b].rf.water - SUBSTANCES[a].rf.water);
  return finish({ kind: "furthest", prompt: `In water, the Rf values are ${dyes.map((d) => `${lc(subName(d))} ${SUBSTANCES[d].rf.water.toFixed(2)}`).join(", ")}. Which dye is most soluble in the solvent and sticks least to the paper?`, correctText: subName(sorted[0]), options: dyes.map((d) => subName(d)), why: `The highest Rf means it travels furthest relative to the solvent: ${lc(subName(sorted[0]))}.`, see: { mixtureId: "black-ink", methodId: "chromatography" } }, rng);
}

function qCrystal(rng) {
  const a = "salt"; const b = "copperSulfate"; const gain = (id) => { const g = 10; const w = (g * 100) / SUBSTANCES[id].solubility[SUBSTANCES[id].solubility.length - 1][1]; return crystalsAt(id, g, w, 20) / g; };
  const better = gain(b) > gain(a) ? b : a;
  return finish({ kind: "crystal", prompt: "Equal masses of hot, just-saturated solutions of sodium chloride and copper(II) sulfate are cooled to 20 °C. Which gives MORE crystals?", correctText: subName(better), options: [subName(a), subName(b), "They give the same amount", "Neither: cooling never gives crystals"], why: `Copper(II) sulfate's solubility falls steeply on cooling (75 g to 21 g per 100 g water between 100 and 20 °C), so about ${Math.round(100 * gain(b))} % crystallises; sodium chloride's hardly changes (39 g to 36 g), so only about ${Math.round(100 * gain(a))} % does.`, see: { mixtureId: "copper-sulfate", methodId: "crystallisation" } }, rng);
}

function qWhyNot(rng) {
  const cases = [
    { m: "salt-solution", meth: "filtration", prompt: "Why does filtering salt solution NOT separate the salt from the water?", correct: "The dissolved ions are far smaller than the pores in the paper", opts: ["The dissolved ions are far smaller than the pores in the paper", "Salt is magnetic", "Water cannot pass through filter paper", "The paper dissolves in salt water"] },
    { m: "iron-sulfur", meth: "evaporation", prompt: "Why must iron filings and sulfur NOT be heated strongly if you want to separate them with a magnet?", correct: "They react to form iron(II) sulfide, which is not magnetic", opts: ["They react to form iron(II) sulfide, which is not magnetic", "Sulfur becomes magnetic", "Iron melts and runs away", "Nothing happens: heating makes no difference"] },
    { m: "ethanol-water", meth: "evaporation", prompt: "Why is it unsafe to evaporate ethanol and water over a Bunsen flame?", correct: "Ethanol vapour is flammable and can catch fire in the flame", opts: ["Ethanol vapour is flammable and can catch fire in the flame", "Water explodes when it boils", "Ethanol is magnetic", "The basin cracks at 78 °C"] },
  ];
  const c = pick(cases, rng);
  return finish({ kind: "why", prompt: c.prompt, correctText: c.correct, options: c.opts, why: runToEnd(c.meth, sampleOf(getMixture(c.m))).result.lines.join(" "), see: { mixtureId: c.m, methodId: c.meth } }, rng);
}

const BUILDERS = [qBestMethod, qFiltrate, qFirstOver, qRf, qCrystal, qFurthest, qWhyNot, qHeadTemp, qBestMethod, qFiltrate];

/** A repeatable quiz of `n` questions for a seed. */
export function buildQuiz(seed = 1, n = 8) {
  const rng = makeRng(seed);
  const order = shuffle(BUILDERS.slice(0, 8), rng).concat(BUILDERS.slice(8)).slice(0, n);
  return order.map((fn, i) => ({ id: `q${i + 1}`, ...fn(rng) }));
}

export { rfFrom };
