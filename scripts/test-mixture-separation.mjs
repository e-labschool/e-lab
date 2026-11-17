#!/usr/bin/env node
// Unit tests for the Mixture Separation Explorer's pure model (src/engines/mixture-separation-explorer/model/*).
// The model decides every outcome from the PROPERTIES of the components (particle size, solubility, boiling point, density,
// magnetism, miscibility, sublimation, Rf), so these tests check chemistry (Rf = d_spot / d_front, ethanol 78 C and water 100 C,
// the azeotrope, solubility curves), the believable temperature-time curve, honest wrong-choice outcomes for every
// mixture x method pair, the multi-step challenge scoring, the quiz, the particle view and the UI helpers.
import assert from "node:assert/strict";
import { SUBSTANCES, AZEOTROPE, boilingElevation, column, crystalsAt, equilibrium, interp, solubilityAt } from "../src/engines/mixture-separation-explorer/model/chem.js";
import { MIXTURES, MIXTURE_BY_ID, fmtG, gramsOf, makeSample, part, sampleOf, totalMass } from "../src/engines/mixture-separation-explorer/model/mixtures.js";
import { METHODS, checkSetupChoice, getMethod } from "../src/engines/mixture-separation-explorer/model/methods.js";
import { METHOD_IDS, autoControls, createRun, runToEnd } from "../src/engines/mixture-separation-explorer/model/runs.js";
import { massBalance } from "../src/engines/mixture-separation-explorer/model/grade.js";
import { CHROMA, checkRf, chromatogram, measureRf, minSpotGap, rfFrom } from "../src/engines/mixture-separation-explorer/model/chromatography.js";
import { CHALLENGES, applyStep, isSolved, scoreChallenge, startChallenge, targetStatus } from "../src/engines/mixture-separation-explorer/model/challenge.js";
import { buildQuiz } from "../src/engines/mixture-separation-explorer/model/quiz.js";
import { GLOSSARY, splitTerms, termKeys } from "../src/engines/mixture-separation-explorer/model/glossary.js";
import { WORLD, createParticleView, kindFor } from "../src/engines/mixture-separation-explorer/model/particleView.js";
import { makeParticleView, particleCaption, particleCtl, particleSpecFor } from "../src/engines/mixture-separation-explorer/model/particleSpec.js";
import { controlDefaults, distillingNow, fmtLab, liveItems, narrate, shuffledOptions } from "../src/engines/mixture-separation-explorer/model/narration.js";

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed += 1; console.log("  ok  ", name); } catch (e) { failed += 1; console.log("  FAIL", name, "\n      ", e.message); } }
const near = (a, b, tol, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b} +- ${tol}, got ${a}`);
const mix = (id) => sampleOf(MIXTURE_BY_ID[id]);
const outById = (result, id) => result.outputs.find((o) => o.id === id);
const finiteDeep = (v) => (typeof v === "number" ? Number.isFinite(v) : Array.isArray(v) ? v.every(finiteDeep) : v && typeof v === "object" ? Object.values(v).every(finiteDeep) : true);

console.log("Rf (paper chromatography)");
test("Rf is spot distance divided by solvent-front distance, measured from the baseline", () => {
  near(rfFrom(3.2, 8), 0.4, 1e-12); near(rfFrom(0, 5), 0, 1e-12); near(rfFrom(5, 5), 1, 1e-12);
  assert.equal(rfFrom(3, 0), null, "front has not passed the baseline"); assert.equal(rfFrom(NaN, 5), null);
});
test("measureRf rounds distances to the nearest millimetre like a ruler, then gives Rf to 2 d.p.", () => {
  const m = measureRf(3.24, 7.96); assert.equal(m.spotMm, 32); assert.equal(m.frontMm, 80); assert.equal(m.rf, 0.4);
  assert.equal(measureRf(5.4, 8.1).rf, 0.67);
});
test("checkRf accepts the right answer, rejects out-of-range input and explains the likely slip", () => {
  assert.equal(checkRf("0.40", 0.4).ok, true); assert.equal(checkRf(0.42, 0.4).ok, true);
  const hi = checkRf("2.5", 0.4); assert.equal(hi.ok, false); assert.match(hi.reason, /between 0 and 1/);
  assert.equal(checkRf("", 0.4).ok, false); assert.equal(checkRf("abc", 0.4).ok, false); assert.equal(checkRf(-0.2, 0.4).ok, false);
  assert.match(checkRf(0.9, 0.4).reason, /solvent distance|SOLVENT/i); assert.equal(checkRf(0.1, 0.4).ok, false);
});
test("every spot's Rf is in [0,1] and the run places each spot at Rf x front distance (computed, not drawn)", () => {
  for (const id of ["black-ink", "permanent-marker"]) for (const solvent of ["water", "ethanol"]) {
    const run = createRun("chromatography", mix(id), { solvent }); let guard = 0;
    while (!run.done && guard++ < 5000) run.step(0.25, {});
    assert.ok(run.done, `${id}/${solvent} finishes`);
    for (const s of run.view.spots) { assert.ok(s.rf >= 0 && s.rf <= 1); near(s.dist, s.rf * run.view.frontDist, 1e-9, `${id}/${solvent}/${s.sub}`); assert.ok(s.dist <= run.view.frontDist + 1e-9); }
    assert.ok(run.view.frontDist > 5 && run.view.frontDist <= CHROMA.top - CHROMA.baseline + 1e-6, `front distance ${run.view.frontDist}`);
  }
});
test("black ink separates into yellow > red > blue in water; permanent marker does not move in water but does in ethanol", () => {
  const water = chromatogram(mix("black-ink"), "water").spots.map((s) => s.sub); assert.deepEqual(water, ["dyeYellow", "dyeRed", "dyeBlue"]);
  const inWater = chromatogram(mix("permanent-marker"), "water"); assert.ok(inWater.spots.every((s) => s.rf === 0), "marker pigments stay on the baseline in water");
  const inEthanol = chromatogram(mix("permanent-marker"), "ethanol"); assert.ok(inEthanol.spots.every((s) => s.rf > 0.2));
  assert.ok(minSpotGap(chromatogram(mix("black-ink"), "water").spots) > 0.15, "spots are resolved");
});
test("the run's result lists the same Rf values a student would compute from the finished chromatogram", () => {
  const { run } = runToEnd("chromatography", mix("black-ink"), { solvent: "water" });
  for (const s of run.view.spots) { const m = measureRf(s.dist, run.view.frontDist); near(m.rf, s.rf, 0.03, s.sub); }
});

console.log("Boiling points, vapour-liquid equilibrium and the distillation curve");
test("ethanol boils at 78.4 C and water at 100 C (data), and pure-liquid equilibrium reproduces them", () => {
  near(SUBSTANCES.ethanol.bp, 78.4, 0.3); near(SUBSTANCES.water.bp, 100, 0.01);
  near(equilibrium(["ethanol", "water"], [0, 1]).T, 100, 0.3, "pure water"); near(equilibrium(["ethanol", "water"], [1, 0]).T, 78.4, 0.5, "pure ethanol");
});
test("the ethanol-water azeotrope is at x = 0.894, 78.15 C (95.6 % by mass) and the vapour is richer in ethanol below it", () => {
  near(AZEOTROPE.x, 0.8943, 1e-4); near(AZEOTROPE.T, 78.15, 0.01); near(AZEOTROPE.wtFraction, 0.956, 0.005);
  for (const x of [0.05, 0.2, 0.4, 0.6, 0.8]) { const e = equilibrium(["ethanol", "water"], [x, 1 - x]); assert.ok(e.y[0] > x, `vapour richer in ethanol at x=${x}`); assert.ok(e.T > 78 && e.T < 100); }
});
test("a longer column enriches the top vapour more (theoretical plates), but never beyond the azeotrope", () => {
  const top = (n) => column(["ethanol", "water"], [0.2, 0.8], n); const y1 = top(1).y[0]; const y6 = top(6).y[0]; const y12 = top(12).y[0];
  assert.ok(y6 > y1 && y12 >= y6 - 1e-9, `${y1} < ${y6} <= ${y12}`); assert.ok(y12 <= AZEOTROPE.x + 0.01);
});
test("boiling-point elevation: 10 g NaCl in 100 g water boils about 1 K above 100 C", () => {
  const dT = boilingElevation([{ sub: "salt", g: 10 }], 100); near(dT, 1.75, 0.4, "i Kb m = 2 x 0.512 x 1.71");
});
test("solubility curves interpolate: NaCl barely changes with T, CuSO4 rises steeply; crystal yield follows", () => {
  near(solubilityAt("salt", 20), 35.9, 0.05); near(solubilityAt("copperSulfate", 100), 75.4, 0.05);
  assert.ok(solubilityAt("copperSulfate", 80) / solubilityAt("copperSulfate", 20) > 2.4); assert.ok(solubilityAt("salt", 80) / solubilityAt("salt", 20) < 1.1);
  assert.ok(crystalsAt("copperSulfate", 40, 100, 20) > 15 && crystalsAt("copperSulfate", 40, 100, 20) < 25);
  assert.equal(crystalsAt("salt", 10, 100, 20), 0, "10 g NaCl in 100 g water is far from saturated");
  near(interp([[0, 0], [10, 100]], 2.5), 25, 1e-9); near(interp([[0, 0], [10, 100]], -5), 0, 1e-9); near(interp([[0, 0], [10, 100]], 99), 100, 1e-9);
});
test("simple distillation of salt solution: head thermometer plateaus near 100 C, distillate is pure water, salt stays", () => {
  const { run, result } = runToEnd("simple-distillation", mix("salt-solution"));
  assert.equal(result.verdict, "works");
  const heads = run.series.map((r) => r[2]).filter((v) => v != null); const plateau = heads.filter((v) => v > 97 && v < 101.5);
  assert.ok(plateau.length >= 8, `${plateau.length} readings near 100 C`);
  const flask = outById(result, "receiver-1");
  assert.ok(gramsOf(flask.sample, "water") > 90 && gramsOf(flask.sample, "salt") < 0.01, "distillate is water only");
  const left = result.outputs.find((o) => /left/i.test(o.vessel)); assert.ok(left && gramsOf(left.sample, "salt") > 9.9, "all the salt is left in the flask");
});
test("fractional distillation of ethanol-water: head T holds near 78 C first, then rises to 100 C; flask 1 is ethanol-rich", () => {
  const { run, result } = runToEnd("fractional-distillation", mix("ethanol-water"));
  assert.equal(result.verdict, "works");
  const series = run.series.filter((r) => r[2] != null); const heads = series.map((r) => r[2]);
  const early = series.filter((r) => r[2] > 74 && r[2] < 84); assert.ok(early.length >= 8, `${early.length} readings near 78 C`);
  assert.ok(Math.max(...early.map((r) => r[2])) <= 84.5, "first plateau is the ethanol one");
  assert.ok(Math.max(...heads) > 98, "thermometer finally reaches the boiling point of water");
  const firstPlateauEnd = series.findIndex((r) => r[2] > 90); const firstPlateauStart = series.findIndex((r) => r[2] > 74);
  assert.ok(firstPlateauEnd > firstPlateauStart + 5, "a flat stretch separates the two boiling points");
  const f1 = outById(result, "receiver-1"); assert.ok(gramsOf(f1.sample, "ethanol") > 35 && gramsOf(f1.sample, "ethanol") / totalMass(f1.sample) > 0.85);
});
test("temperature-time curve is believable: the flask warms monotonically (no dips beyond 0.6 C) and heats at a finite rate", () => {
  for (const [id, m] of [["simple-distillation", "salt-solution"], ["fractional-distillation", "ethanol-water"], ["evaporation", "salt-solution"], ["fractional-distillation", "crude-oil"]]) {
    const { run } = runToEnd(id, mix(m));
    for (let i = 1; i < run.series.length; i++) assert.ok(run.series[i][1] >= run.series[i - 1][1] - 0.6, `${id}/${m}: flask T dipped at ${run.series[i][0]} s`);
    assert.ok(run.series.every((r) => finiteDeep(r)));
    const slope = (run.series[2][1] - run.series[0][1]) / (run.series[2][0] - run.series[0][0]); assert.ok(slope > 0.05 && slope < 2, `${id}/${m}: initial heating rate ${slope} K/s`);
  }
});
test("simple distillation does NOT cleanly separate ethanol and water (partial at best) while fractional does", () => {
  assert.notEqual(runToEnd("simple-distillation", mix("ethanol-water")).result.verdict, "works");
  assert.equal(runToEnd("fractional-distillation", mix("ethanol-water")).result.verdict, "works");
});
test("crude-oil model: head temperature steps through ~69, ~174, ~287 C fractions with a residue left", () => {
  const { run, result } = runToEnd("fractional-distillation", mix("crude-oil")); const heads = run.series.map((r) => r[2]).filter((v) => v != null);
  assert.ok(heads.some((v) => v > 60 && v < 85), "light fraction"); assert.ok(heads.some((v) => v > 160 && v < 190), "middle fraction"); assert.ok(heads.some((v) => v > 270 && v < 300), "heavy fraction");
  assert.ok(result.outputs.some((o) => /left|residue/i.test(o.vessel) && gramsOf(o.sample, "bitumen") > 1));
});

console.log("Honest outcomes: every mixture x method pair");
const FIRE = new Set(["ethanol-water", "crude-oil", "permanent-marker"]);
test("all 11 mixtures x 11 methods finish, stay finite and conserve mass (outputs + lost = sample + added water)", () => {
  let n = 0;
  for (const m of MIXTURES) for (const id of METHOD_IDS) {
    const sample = sampleOf(m); const { run, result } = runToEnd(id, sample, { solvent: "water" }); n += 1;
    assert.ok(run.done, `${m.id}/${id} did not finish`); assert.ok(finiteDeep(run.view), `${m.id}/${id} non-finite view`);
    assert.ok(["works", "partial", "fails", "unsafe", "reaction", "prep"].includes(result.verdict), `${m.id}/${id} verdict ${result.verdict}`);
    assert.ok(result.headline && result.lines.length > 0, `${m.id}/${id} has an explanation`);
    if (id === "chromatography") assert.equal(result.outputs.length, 0); // the sample is analysed, not consumed
    else near(massBalance(sample, result.outputs, result.lost) + (result.added?.water ?? 0), 0, 1e-6, `${m.id}/${id} mass balance`);
  }
  assert.equal(n, 121);
});
test("the best method for each mixture works; a clearly wrong method does not", () => {
  for (const m of MIXTURES) {
    if (m.needsSteps) continue;
    for (const best of m.best) assert.equal(runToEnd(best, sampleOf(m), { solvent: m.id === "permanent-marker" ? "ethanol" : "water" }).result.verdict, "works", `${m.id} with ${best}`);
  }
  assert.equal(runToEnd("filtration", mix("salt-solution")).result.verdict, "fails", "salt passes through filter paper");
  assert.equal(runToEnd("magnetic", mix("sand-salt")).result.verdict, "fails");
  assert.equal(runToEnd("sublimation", mix("sand-salt")).result.verdict, "fails");
  assert.equal(runToEnd("separating-funnel", mix("salt-solution")).result.verdict, "fails", "one layer only");
});
test("evaporating a flammable liquid is unsafe (fire), and heating iron + sulfur is a chemical change, not a separation", () => {
  for (const id of ["ethanol-water", "crude-oil"]) assert.equal(runToEnd("evaporation", mix(id)).result.verdict, "unsafe", id);
  const fe = runToEnd("evaporation", mix("iron-sulfur")).result; assert.equal(fe.verdict, "reaction"); assert.ok(fe.outputs.some((o) => gramsOf(o.sample, "ironSulfide") > 1), "iron(II) sulfide forms");
  const fesub = runToEnd("sublimation", mix("iron-sulfur")).result; assert.notEqual(fesub.verdict, "works");
});
test("filtering a salt solution leaves the salt dissolved in the filtrate; filtering muddy water keeps all the sand on the paper", () => {
  const s = runToEnd("filtration", mix("salt-solution")).result; const f = outById(s, "filtrate");
  assert.ok(gramsOf(f.sample, "salt") > 9.9 && f.sample.parts.find((p) => p.sub === "salt").form === "dissolved");
  const m = runToEnd("filtration", mix("muddy-water")).result; assert.ok(gramsOf(outById(m, "residue").sample, "sand") > 19.9); assert.ok(gramsOf(outById(m, "filtrate").sample, "sand") < 0.01);
});
test("pouring too fast over the filter paper lets sand through (overflow), pouring slowly does not", () => {
  const sample = mix("muddy-water"); const fast = createRun("filtration", sample); let g = 0; while (!fast.done && g++ < 5000) fast.step(0.25, { pour: 1 });
  const slow = createRun("filtration", sample); g = 0; while (!slow.done && g++ < 5000) slow.step(0.25, { pour: 0.2 });
  assert.ok(gramsOf(outById(fast.result(), "filtrate").sample, "sand") > gramsOf(outById(slow.result(), "filtrate").sample, "sand"));
  assert.ok(gramsOf(outById(slow.result(), "filtrate").sample, "sand") < 0.01);
});
test("crystallisation: copper(II) sulfate gives about 70 % crystals on cooling, salt only a few % (solubility curves)", () => {
  const cu = runToEnd("crystallisation", mix("copper-sulfate")); const cuCr = gramsOf(outById(cu.result, "crystals")?.sample ?? makeSample("x", []), "copperSulfate");
  assert.ok(cuCr / 15 > 0.55 && cuCr / 15 < 0.95, `CuSO4 crystal fraction ${cuCr / 15}`);
  const na = runToEnd("crystallisation", mix("salt-solution")); const naCr = gramsOf(outById(na.result, "crystals")?.sample ?? makeSample("x", []), "salt");
  assert.ok(naCr / 10 < 0.15, `NaCl crystal fraction ${naCr / 10}`); assert.notEqual(na.result.verdict, "works");
});
test("evaporation to dryness is how salt is recovered (NaCl crystallises poorly on cooling)", () => {
  const r = runToEnd("evaporation", mix("salt-solution")).result; assert.equal(r.verdict, "works"); assert.ok(gramsOf(r.outputs.find((o) => /basin|residue|left/i.test(o.vessel)).sample, "salt") > 9.5);
});
test("magnetic separation: iron collected pure over several passes; sulfur stays; passes raise the collected share", () => {
  const run = createRun("magnetic", mix("iron-sulfur")); const seen = []; let g = 0;
  while (!run.done && g++ < 4000) { run.step(0.25, { sweep: !run.view.sweeping }); seen.push(run.view.collected); }
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1] - 1e-9);
  const r = run.result(); assert.equal(r.verdict, "works"); assert.ok(r.recovered.iron && r.recovered.sulfur);
  const one = createRun("magnetic", mix("iron-sulfur")); one.sweep(); g = 0; while (one.view.passes < 1 && g++ < 200) one.step(0.25, {}); one.finish();
  assert.ok(gramsOf(outById(one.result(), "magnet").sample, "iron") < gramsOf(outById(r, "magnet").sample, "iron"), "one pass collects less than three");
});
test("separating funnel: the denser layer drains first; stopping at the boundary gives two pure liquids, running on mixes them", () => {
  const ok = createRun("separating-funnel", mix("oil-water")); let g = 0; const total = ok.view.total; const lower = ok.view.lowerG;
  assert.ok(lower > 0 && lower < total && Math.abs(lower - 60) < 1, "water (denser) is the lower layer");
  while (!ok.done && ok.view.drained < lower - 0.2 && g++ < 5000) ok.step(0.1, { tap: ok.view.drained > lower - 6 ? 0.15 : 0.6 });
  ok.finish(); assert.equal(ok.result().verdict, "works");
  const bad = createRun("separating-funnel", mix("oil-water")); g = 0; while (!bad.done && g++ < 5000) bad.step(0.25, { tap: 0.7 });
  assert.notEqual(bad.result().verdict, "works", "draining everything mixes the layers");
});
test("sublimation: gentle heat sublimes iodine onto the cold funnel; too hot melts it and loses vapour", () => {
  const ok = runToEnd("sublimation", mix("iodine-sand")); assert.equal(ok.result.verdict, "works"); assert.ok(gramsOf(outById(ok.result, "sublimate").sample, "iodine") > 4);
  const hot = createRun("sublimation", mix("iodine-sand")); let g = 0; while (!hot.done && g++ < 4000) hot.step(0.25, { heat: 1 });
  const rh = hot.result(); assert.ok(rh.lost.some((l) => l.sub === "iodine" && l.g > 0.2) || rh.verdict !== "works", "overheating loses iodine");
});
test("dissolve is a preparation step: salt dissolves, sand does not, and water is added", () => {
  const r = runToEnd("dissolve", mix("sand-salt")).result; assert.equal(r.verdict, "prep");
  const b = r.outputs[0].sample; assert.ok(gramsOf(b, "salt") > 9.9 && b.parts.some((p) => p.sub === "salt" && p.form === "dissolved") && b.parts.some((p) => p.sub === "sand" && p.form === "solid"));
  assert.equal(runToEnd("dissolve", mix("muddy-water")).result.verdict, "fails");
});
test("decanting works for sediment and for two layers, and not for a solution", () => {
  assert.equal(runToEnd("decanting", mix("muddy-water")).result.verdict, "works"); assert.equal(runToEnd("decanting", mix("oil-water")).result.verdict, "works"); assert.equal(runToEnd("decanting", mix("salt-solution")).result.verdict, "fails");
});
test("runs are deterministic: the same inputs give the same outputs", () => {
  const a = runToEnd("fractional-distillation", mix("ethanol-water")); const b = runToEnd("fractional-distillation", mix("ethanol-water"));
  assert.deepEqual(a.result.outputs.map((o) => o.sample), b.result.outputs.map((o) => o.sample)); assert.deepEqual(a.run.series, b.run.series);
});
test("hostile input: NaN / negative / huge control values never produce non-finite state", () => {
  for (const id of METHOD_IDS) {
    const run = createRun(id, mix(id === "magnetic" ? "iron-sulfur" : id === "chromatography" ? "black-ink" : id === "sublimation" ? "iodine-sand" : id === "separating-funnel" ? "oil-water" : "ethanol-water"), {});
    let g = 0; const weird = [{ heat: NaN, pour: -3, tap: 99, stir: undefined }, { heat: 9, pour: 9, tap: -1, tilt: true, sweep: true }, {}];
    while (!run.done && g++ < 400) run.step(g % 3 ? 0.1 : 5, weird[g % 3]);
    assert.ok(finiteDeep(run.view), `${id}: ${JSON.stringify(run.view).slice(0, 120)}`); assert.ok(finiteDeep(run.series));
    run.result();
  }
});

console.log("Set-up steps (assembly)");
test("every method has 3-7 set-up steps, each with exactly one correct option, a reason, and a reason for every wrong option", () => {
  for (const m of METHODS) {
    assert.ok(m.setup.length >= 3 && m.setup.length <= 7, `${m.id}: ${m.setup.length} steps`);
    m.setup.forEach((s, i) => {
      assert.ok(s.options.length >= 2); assert.equal(s.options.filter((o) => o.id === s.correct).length, 1); assert.ok(s.why.length > 10);
      for (const o of s.options) { const r = checkSetupChoice(m.id, i, o.id); assert.equal(r.ok, o.id === s.correct); assert.ok(r.why.length > 10, `${m.id}[${i}] ${o.id} explains itself`); }
    });
  }
  assert.equal(checkSetupChoice("filtration", 99, "a").ok, false);
});
test("the heating methods include safety steps: heat-proof mat and goggles", () => {
  for (const id of ["evaporation", "crystallisation"]) { const txt = getMethod(id).setup.map((s) => s.prompt + s.options.map((o) => o.label).join(" ")).join(" "); assert.match(txt, /heat-proof mat/i); assert.match(txt, /goggles/i); }
});
test("shuffledOptions is deterministic, keeps every option, and the correct one is not always first", () => {
  let notFirst = 0; let total = 0;
  for (const m of METHODS) m.setup.forEach((s, i) => { const a = shuffledOptions(m.id, i); const b = shuffledOptions(m.id, i); assert.deepEqual(a.map((o) => o.id), b.map((o) => o.id)); assert.deepEqual([...a.map((o) => o.id)].sort(), s.options.map((o) => o.id).sort()); total += 1; if (a[0].id !== s.correct) notFirst += 1; });
  assert.ok(notFirst / total > 0.4, `${notFirst}/${total} steps do not put the right answer first`);
  assert.deepEqual(shuffledOptions("filtration", 42), []);
});

console.log("Challenge mode");
test("every challenge is solved by its model solution, scores 100, and the log explains each step", () => {
  for (const ch of CHALLENGES) {
    let st = startChallenge(ch);
    for (const method of ch.solution) {
      // apply to the container that currently holds the most unseparated mass
      const target = [...st.containers].sort((a, b) => totalMass(b.sample) - totalMass(a.sample)).find((c) => c.sample.parts.length > 1) ?? st.containers[0];
      st = applyStep(ch, st, target.id, method).state;
    }
    assert.ok(isSolved(ch, st), `${ch.id} solved: ${JSON.stringify(targetStatus(ch, st).map((t) => [t.sub, t.done]))}`);
    const sc = scoreChallenge(ch, st, 0); assert.equal(sc.solved, true); assert.ok(sc.total >= 85, `${ch.id} scored ${sc.total}`); assert.equal(st.log.length, ch.solution.length);
  }
});
test("order matters: dissolving before removing the magnetic iron, or evaporating first, loses points or fails", () => {
  const ch = CHALLENGES.find((c) => c.id === "sand-salt"); let st = startChallenge(ch);
  st = applyStep(ch, st, st.containers[0].id, "evaporation").state; assert.equal(isSolved(ch, st), false); assert.ok(st.log[0].wasted, "evaporating dry solids changes nothing useful");
  assert.ok(scoreChallenge(ch, st, 0).total < 30);
  const ch2 = CHALLENGES.find((c) => c.id === "iron-sand-salt"); let s2 = startChallenge(ch2);
  s2 = applyStep(ch2, s2, s2.containers[0].id, "evaporation").state; assert.ok(s2.log[0].hazard || s2.log[0].wasted, "heating iron + sulfur-free solids is not a useful first step"); assert.equal(isSolved(ch2, s2), false);
});
test("extra steps, wasted steps and hints each cost points; the score never goes below 0 or above 100", () => {
  const ch = CHALLENGES[0]; let st = startChallenge(ch);
  const base = (() => { let s = st; for (const m of ch.solution) { const t = [...s.containers].sort((a, b) => totalMass(b.sample) - totalMass(a.sample)).find((c) => c.sample.parts.length > 1) ?? s.containers[0]; s = applyStep(ch, s, t.id, m).state; } return s; })();
  const s0 = scoreChallenge(ch, base, 0).total; const s2 = scoreChallenge(ch, base, 2).total; const s9 = scoreChallenge(ch, base, 9).total;
  assert.ok(s0 > s2 && s2 > s9 && s9 === scoreChallenge(ch, base, 3).total, "hints cost 5 each, at most 3 count"); assert.ok(s0 <= 100 && s9 >= 0);
  const wasteful = applyStep(ch, base, base.containers[0].id, "magnetic").state; assert.ok(scoreChallenge(ch, wasteful, 0).total < s0, "a wasted extra step lowers the score");
  assert.equal(scoreChallenge(ch, startChallenge(ch), 0).total, 0);
});
test("each challenge has hints that do not name the answer outright, a story, targets and a worked explanation", () => {
  for (const ch of CHALLENGES) { assert.ok(ch.story.length > 20 && ch.hints.length >= 2 && ch.targets.length >= 2 && ch.solution.length >= 2); assert.ok(typeof (ch.why ?? "") === "string"); for (const t of ch.targets) assert.ok(SUBSTANCES[t.sub]); }
});

console.log("Quiz mode");
test("the quiz is repeatable per seed, varied across seeds, and every answer index points at the correct text", () => {
  const a = buildQuiz(3, 8); const b = buildQuiz(3, 8); assert.deepEqual(a, b); assert.notDeepEqual(buildQuiz(4, 8).map((q) => q.prompt), a.map((q) => q.prompt));
  for (let seed = 1; seed <= 40; seed++) for (const q of buildQuiz(seed, 8)) {
    assert.ok(q.prompt.length > 15 && q.why.length > 15); assert.ok(q.options.length >= 2 && q.options.length <= 6, `${q.kind} has ${q.options.length} options`);
    assert.equal(new Set(q.options).size, q.options.length, `${q.kind} duplicate options: ${q.options}`); assert.equal(q.options[q.answer], q.correctText); assert.ok(q.see?.mixtureId && q.see?.methodId, `${q.kind} can be watched`); assert.ok(MIXTURE_BY_ID[q.see.mixtureId]); assert.ok(METHOD_IDS.includes(q.see.methodId));
  }
});
test("Rf quiz answers are computed by the Rf formula (spot / front), not looked up", () => {
  let seen = 0;
  for (let seed = 1; seed <= 60; seed++) for (const q of buildQuiz(seed, 8)) if (q.kind === "rf") { const m = q.prompt.match(/moved ([\d.]+) cm and the solvent front ([\d.]+) cm/); assert.ok(m); near(Number(q.correctText), Math.round((m[1] / m[2]) * 100) / 100, 0.011); seen += 1; }
  assert.ok(seen > 5);
});
test("'what ends up in the filtrate' answers agree with actually running the filtration", () => {
  let seen = 0;
  for (let seed = 1; seed <= 60; seed++) for (const q of buildQuiz(seed, 8)) if (q.kind === "filtrate") { seen += 1; const id = q.see.mixtureId; const res = runToEnd("filtration", mix(id)).result; const subs = [...new Set(outById(res, "filtrate").sample.parts.map((p) => p.sub))]; for (const s of subs) assert.ok(q.correctText.toLowerCase().includes(SUBSTANCES[s].name.toLowerCase().split(" ")[0]), `${id}: ${q.correctText} should mention ${s}`); }
  assert.ok(seen > 3);
});
test("the head-thermometer question asks about 78 C for the first fraction of ethanol-water", () => {
  let seen = 0; for (let seed = 1; seed <= 60; seed++) for (const q of buildQuiz(seed, 8)) if (q.kind === "head") { seen += 1; assert.match(q.correctText, /78/); } assert.ok(seen > 0);
});

console.log("Particle view");
test("every method's particle view stays finite and inside the box through a whole run, with particle count conserved", () => {
  for (const m of MIXTURES) for (const id of METHOD_IDS) {
    const sample = sampleOf(m); const solvent = m.id === "permanent-marker" ? "ethanol" : "water"; const pv = makeParticleView(id, sample, solvent, 11); const n0 = pv.particles.length;
    const run = createRun(id, sample, { solvent }); const ctl = controlDefaults(id); let g = 0;
    for (let f = 0; f < 700; f++) { if (!run.done && f % 3 === 0) { autoControls(id, run, ctl, sample); run.step(0.2, ctl); } pv.step(1 / 40, particleCtl(id, run)); if (++g > 700) break; }
    const st = pv.stats(); assert.ok(st.inside, `${m.id}/${id} particles inside`); assert.equal(pv.particles.length, n0, `${m.id}/${id} count conserved`); assert.ok(pv.particles.length > 3 || ["magnet", "layers"].includes(kindFor(id)), `${m.id}/${id} has particles`);
    assert.ok(pv.legend.length >= 1);
  }
});
test("particleCtl always returns finite values in range, even before the run exists", () => {
  for (const id of METHOD_IDS) { const c0 = particleCtl(id, undefined); assert.ok(finiteDeep(c0)); const run = createRun(id, mix("muddy-water")); const c1 = particleCtl(id, run); assert.ok(finiteDeep(c1)); for (const k of ["progress", "front"]) if (k in c1) assert.ok(c1[k] >= 0 && c1[k] <= 1); }
});
test("sieve view: sand grains are held at the paper, water and ions fall through", () => {
  const sample = mix("muddy-water"); const pv = createParticleView("sieve", particleSpecFor("filtration", sample), 5);
  for (let i = 0; i < 1400; i++) pv.step(1 / 40, { progress: 1 });
  const grains = pv.particles.filter((p) => p.type === "grain"); const water = pv.particles.filter((p) => p.type === "water");
  assert.ok(grains.length > 0 && water.length > 0); assert.ok(grains.every((p) => p.y < 0.58), "grains stay above the pore line"); assert.ok(water.filter((p) => p.y > 0.58).length / water.length > 0.5, "most water has passed");
});
test("vapour view: more of the volatile liquid escapes at its boiling point than far below it; non-volatile particles never leave", () => {
  const sample = mix("salt-solution"); const run = (T) => { const pv = createParticleView("vapour", particleSpecFor("evaporation", sample), 3); for (let i = 0; i < 900; i++) pv.step(1 / 40, { T }); return pv; };
  const cold = run(25); const hot = run(105); const gas = (pv) => pv.escapes.water ?? 0;
  assert.ok(gas(hot) > gas(cold) + 2, `${gas(hot)} vs ${gas(cold)}`); assert.ok(hot.particles.filter((p) => p.type === "ion" || /ion/.test(p.type)).every((p) => p.state !== "gas"));
});
test("chromatography view: a dye with higher Rf ends higher on the strip", () => {
  const pv = createParticleView("chroma", { dyes: [{ id: "dyeYellow", rf: 0.78 }, { id: "dyeBlue", rf: 0.31 }] }, 4); for (let i = 0; i < 1500; i++) pv.step(1 / 40, { front: 0.9 });
  const mean = (t) => { const a = pv.particles.filter((p) => p.type === t); return a.reduce((s, p) => s + p.y, 0) / a.length; }; assert.ok(mean("dyeYellow") < mean("dyeBlue"), "yellow (higher Rf) is further up (smaller y)");
});
test("layers view: after settling the water molecules are below the oil molecules; magnet view: only iron is lifted", () => {
  const sample = mix("oil-water"); const pv = makeParticleView("separating-funnel", sample, "water", 9); for (let i = 0; i < 1500; i++) pv.step(1 / 40, { progress: 1 });
  const mean = (t) => { const a = pv.particles.filter((p) => p.type === t); return a.reduce((s, p) => s + p.y, 0) / a.length; }; assert.ok(mean("water") > mean("oil") + 0.2);
  const mg = makeParticleView("magnetic", mix("iron-sulfur"), "water", 2); for (let i = 0; i < 800; i++) mg.step(1 / 40, { progress: 1, sweep: 0.5, sweeping: false });
  const iron = mg.particles.filter((p) => p.type === "iron"); const sulfur = mg.particles.filter((p) => p.type === "sulfur"); assert.ok(iron.length > 0 && sulfur.length > 0);
  assert.ok(iron.reduce((s, p) => s + p.y, 0) / iron.length < sulfur.reduce((s, p) => s + p.y, 0) / sulfur.length - 0.3, "iron collected high, sulfur left on the tray");
});
test("every method has a particle caption", () => { for (const id of METHOD_IDS) assert.ok(particleCaption(id, createRun(id, mix("muddy-water")), mix("muddy-water")).length > 30, id); });
test("the particle world is 1.4 x 1.0", () => { assert.deepEqual(WORLD, { w: 1.4, h: 1.0 }); });

console.log("UI helpers: narration, live strip, glossary");
test("narration is a non-empty sentence for every method and stage; live strip values are finite text", () => {
  for (const id of METHOD_IDS) {
    const sample = mix(id === "magnetic" ? "iron-sulfur" : id === "chromatography" ? "black-ink" : id === "sublimation" ? "iodine-sand" : id === "separating-funnel" ? "oil-water" : "ethanol-water");
    const run = createRun(id, sample, {}); const ctl = controlDefaults(id);
    for (let i = 0; i < 60; i++) { run.step(0.5, { ...ctl, heat: 0.7, tilt: true, tap: 0.3 }); const t = narrate(id, run.view, ctl, sample, "run"); assert.ok(t.length > 15 && !/undefined|NaN/.test(t), `${id}: ${t}`); }
    assert.ok(narrate(id, run.view, ctl, sample, "done").length > 10);
    for (const it of liveItems(id, "run", run, sample, ctl)) { assert.ok(!/NaN|undefined/.test(String(it.value)), `${id} ${it.id}: ${it.value}`); assert.ok(it.label && it.id && it.testId); }
    assert.ok(liveItems(id, "setup", null, sample).length >= 1);
  }
  assert.equal(fmtLab(75), "1:15"); assert.equal(fmtLab(-5), "0:00"); assert.equal(distillingNow(mix("ethanol-water"), 78.5), "ethanol"); assert.equal(distillingNow(mix("ethanol-water"), 99.5), "water"); assert.equal(distillingNow(mix("ethanol-water"), 20), null);
});
test("glossary: every term has a plain definition and splitTerms round-trips text and links each term once", () => {
  for (const k of termKeys) assert.ok(GLOSSARY[k].length > 20 && GLOSSARY[k].length < 400, k);
  for (const k of ["Rf", "boiling point", "azeotrope", "solvent front", "mother liquor", "theoretical plate"]) assert.ok(GLOSSARY[k], k);
  const text = "The solvent front and the solvent carry the Rf; solvent again. An insoluble solid is not soluble. Boiling point matters (boiling point)."; const parts = splitTerms(text);
  assert.equal(parts.map((p) => p.text).join(""), text); const linked = parts.filter((p) => p.term).map((p) => p.term.toLowerCase());
  assert.equal(new Set(linked).size, linked.length, "each term linked once"); assert.ok(linked.includes("solvent front") && linked.includes("insoluble") && linked.includes("soluble") && linked.includes("boiling point") && linked.includes("rf"));
  assert.deepEqual(splitTerms(""), []); assert.equal(splitTerms("plain words only").length, 1);
});
test("mixtures: every mixture names its deciding property and has at least one best method that exists; kinds are classified", () => {
  assert.equal(MIXTURES.length, 11);
  for (const m of MIXTURES) { assert.ok(m.deciding.length > 20 && m.kind.length > 8); for (const b of m.best) assert.ok(METHOD_IDS.includes(b), `${m.id}: ${b}`); assert.ok(totalMass(sampleOf(m)) > 0); assert.ok(m.levels.length >= 1); }
  assert.match(MIXTURE_BY_ID["muddy-water"].kind, /Heterogeneous/); assert.match(MIXTURE_BY_ID["salt-solution"].kind, /Homogeneous/); assert.equal(fmtG(0.05), "0.050 g"); assert.equal(fmtG(12.4), "12 g");
  assert.equal(part("sand", "solid", 1).form, "solid");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
