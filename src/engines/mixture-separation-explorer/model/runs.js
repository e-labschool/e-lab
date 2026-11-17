// The run models: one per separation method. Pure JS (no React / DOM), unit-tested in scripts/test-mixture-separation.mjs.
//
//   const run = createRun("simple-distillation", sample, { heatScale, plates, solvent })
//   run.step(dtAnimationSeconds, controls)    advance; `controls` are the student's live settings (heat, pour, tap ...)
//   run.view                                  everything a scene needs to draw the current moment
//   run.series                                data for the graph (distillation / evaporation / crystallisation)
//   run.done                                  true when the run has finished (or the student stopped it)
//   run.result()                              what is in each container, verdict, plain-English explanation
//
// Every run decides the outcome from the PROPERTIES of the components (particle size, solubility, boiling point, density,
// magnetism, miscibility, sublimation, Rf), never from a lookup of "mixture x method", so a wrong choice produces an honest
// result. Times given to step() are animation seconds; each run maps them to "lab time" with its own `pace`.
import { SUBSTANCES, crystalsAt, gToMl, solubilityAt, subName, waterForSaturation, wtFractionEthanol } from "./chem.js";
import { createPot } from "./pot.js";
import { cloneSample, dominant, fmtG, gramsOf, hasForm, isEmpty, makeSample, normalise, totalMass } from "./mixtures.js";
import { gradeOutcome } from "./grade.js";
import { chromatogram, CHROMA } from "./chromatography.js";

export const PORE_MM = 0.01; // filter paper pores, mm (about 10 micrometres)
export const ION_MM = 2e-7; // size of a dissolved ion, mm (about 0.2 nm)
export const RECEIVER_MAX = 4;

const MM = (id) => SUBSTANCES[id].molarMass;
const liquidsOf = (s) => s.parts.filter((p) => p.form === "liquid");
const solidsOf = (s) => s.parts.filter((p) => p.form === "solid");
const dissolvedOf = (s) => s.parts.filter((p) => p.form === "dissolved");
const lc = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const names = (list) => list.map((id) => lc(subName(id))).join(" and ");
const uniq = (a) => [...new Set(a)];
const out = (id, vessel, parts, note = "") => ({ id, vessel, sample: normalise(makeSample(vessel, parts)), note });
// NaN (a hostile or broken control value) falls back to the lower bound, so no state can ever become non-finite
const clamp = (v, a, b) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a);

function baseRun(method, sample, pace) {
  return { method, sample: cloneSample(sample), t: 0, pace, done: false, stopped: false, series: [], view: {}, hazard: null, caveats: [] };
}
const labTime = (run) => run.t * run.pace;

// ---------------------------------------------------------------------------------------------------------- dissolve
function dissolveRun(sample, o) {
  const run = baseRun("dissolve", sample, 6);
  const addWater = solidsOf(sample).length && !liquidsOf(sample).some((p) => p.sub === "water") ? (o.waterG ?? 100) : 0;
  const water = gramsOf(sample, "water") + addWater;
  const solids = solidsOf(sample).filter((p) => SUBSTANCES[p.sub].solubility);
  const cap = (sub) => (solubilityAt(sub, 20) * water) / 100;
  const target = Object.fromEntries(solids.map((p) => [p.sub, Math.min(p.g, cap(p.sub))]));
  run.controls = { stir: true };
  run.progress = 0; run.view = { stirring: true, progress: 0, addedWater: addWater };
  run.step = (dt, ctl = {}) => {
    if (run.done) return;
    run.t += dt;
    const rate = (ctl.stir === false ? 0.04 : 0.17) * dt;
    run.progress = clamp(run.progress + rate, 0, 1);
    run.view = { stirring: ctl.stir !== false, progress: run.progress, addedWater: addWater };
    if (run.progress >= 1) run.done = true;
  };
  run.result = () => {
    const f = run.progress;
    const parts = []; const left = [];
    for (const p of sample.parts) {
      if (p.form === "solid" && target[p.sub] != null) {
        const d = target[p.sub] * f; parts.push({ sub: p.sub, form: "dissolved", g: d }); parts.push({ sub: p.sub, form: "solid", g: p.g - d });
        if (p.g - target[p.sub] > 0.01) left.push(lc(subName(p.sub)));
      } else parts.push({ ...p });
    }
    if (addWater) parts.push({ sub: "water", form: "liquid", g: addWater });
    const o1 = out("beaker", "Beaker", parts);
    const dissolved = solids.map((p) => lc(subName(p.sub)));
    const undissolved = solidsOf(sample).filter((p) => !SUBSTANCES[p.sub].solubility).map((p) => p.sub);
    const lines = [];
    if (!solids.length) lines.push(solidsOf(sample).length ? `Nothing here dissolves in water: ${names(uniq(solidsOf(sample).map((p) => p.sub)))} stay as solid grains.` : "There is no solid to dissolve: the sample is already liquid.");
    else lines.push(`${dissolved.join(" and ")} dissolve${dissolved.length === 1 ? "s" : ""} in the water (solubility of salt at 20 °C is about ${solubilityAt("salt", 20).toFixed(0)} g per 100 g water); the solid breaks up into ions that spread between the water molecules.`);
    if (undissolved.length) lines.push(`${names(undissolved)} stay${undissolved.length === 1 ? "s" : ""} as solid grains: they are insoluble in water.`);
    if (left.length) lines.push(`More ${left.join(" and ")} was added than 100 g of water can hold at 20 °C, so some stays solid (a saturated solution).`);
    return { verdict: solids.length ? "prep" : "fails", headline: solids.length ? "Dissolving is a preparation step, not a separation on its own: the soluble solid is now spread through the water." : "Nothing changed: there is no soluble solid to dissolve.", outputs: [o1], lost: [], lines, idea: "Dissolving turns a soluble solid into a solution so that an insoluble solid can then be filtered off.", added: { water: addWater } };
  };
  return run;
}

// -------------------------------------------------------------------------------------------------------- filtration
function filtrationRun(sample, o) {
  const run = baseRun("filtration", sample, 6);
  const liquids = [...liquidsOf(sample), ...dissolvedOf(sample)];
  const liquidMl = liquidsOf(sample).reduce((a, p) => a + gToMl(p.sub, p.g), 0);
  const solids = solidsOf(sample);
  const solidG = solids.reduce((a, p) => a + p.g, 0);
  const hasLiquid = liquidMl > 0.5;
  const V = hasLiquid ? liquidMl : 0;
  const solidPerMl = V > 0 ? solidG / V : 0;
  const LMAX = 60; // mL the cone holds below the paper rim
  const D0 = 4.5; // mL per second through a clean filter
  let poured = 0; let level = 0; let drained = 0; let bypass = 0; let cake = 0;
  run.controls = { pour: 0.5 };
  run.view = { level: 0, poured: 0, drained: 0, cake: 0, overflow: false, V, solidFrac: 0, dry: !hasLiquid };
  run.step = (dt, ctl = {}) => {
    if (run.done) return;
    run.t += dt;
    const pour = clamp(ctl.pour ?? 0.5, 0, 1);
    if (hasLiquid) {
      const want = Math.min(V - poured, pour * 14 * dt); poured += want; level += want;
      const drain = Math.min(level, (D0 / (1 + 3 * cake)) * dt); level -= drain; drained += drain;
      cake = solidPerMl > 0 ? clamp((poured - level) * solidPerMl / Math.max(1, solidG), 0, 1) : 0;
      let over = false;
      if (level > LMAX) { const ex = level - LMAX; level = LMAX; bypass += ex; over = true; }
      run.view = { level, poured, drained, cake, overflow: over || run.view.overflow, V, solidFrac: solidPerMl > 0 ? poured / V : 0, dry: false };
      if (poured >= V - 1e-6 && level < 0.2) run.done = true;
    } else {
      // dry powder: nothing carries it, it just sits on the paper
      poured = Math.min(1, poured + pour * 0.5 * dt); run.view = { level: 0, poured, drained: 0, cake: poured, overflow: false, V: 0, solidFrac: poured, dry: true };
      if (poured >= 1) run.done = true;
    }
  };
  run.result = () => {
    const frac = hasLiquid ? (V > 0 ? poured / V : 1) : run.view.poured;
    const bypassFrac = V > 0 ? bypass / V : 0;
    const residue = []; const filtrate = [];
    const f = clamp(frac, 0, 1);
    for (const p of sample.parts) {
      const g = p.g * f;
      if (p.form === "solid") {
        const keep = hasLiquid ? g * (1 - bypassFrac) : g;
        residue.push({ sub: p.sub, form: "solid", g: keep }); if (hasLiquid && g - keep > 0) filtrate.push({ sub: p.sub, form: "solid", g: g - keep });
      } else filtrate.push({ sub: p.sub, form: p.form, g });
    }
    const unpoured = sample.parts.map((p) => ({ sub: p.sub, form: p.form, g: p.g * (1 - f) }));
    const outs = [out("residue", "Filter paper (residue)", residue), out("filtrate", "Beaker (filtrate)", [...filtrate]) ];
    if (f < 0.995) outs.push(out("unpoured", "Still in the original beaker", unpoured));
    const lines = [];
    const nonEmpty = (o2) => !isEmpty(o2.sample);
    if (!hasLiquid) lines.push("There is no liquid, so there is nothing to carry anything through the paper: the dry powders just sit on it, still mixed.");
    else {
      const sol = solids.map((p) => p.sub);
      if (sol.length) lines.push(`${names(uniq(sol))} (grains about ${SUBSTANCES[sol[0]].grainMm} mm) cannot pass the filter paper's pores (about ${PORE_MM} mm): they stay behind as the residue.`);
      const dis = dissolvedOf(sample).map((p) => p.sub);
      if (dis.length) lines.push(`${names(uniq(dis))} ${dis.length > 1 ? "are" : "is"} dissolved: the particles are single ions or molecules (about 0.0000002 mm), tens of thousands of times smaller than the pores, so ${dis.length > 1 ? "they" : "it"} pass${dis.length > 1 ? "" : "es"} straight through with the liquid.`);
      const liqs = uniq(liquidsOf(sample).map((p) => p.sub));
      if (liqs.length > 1) lines.push(`${names(liqs)} are liquids: both pass through the paper together, so they are not separated.`);
      if (!sol.length) lines.push("There is no undissolved solid, so the residue is empty: everything went through.");
    }
    if (bypass > 0.5) lines.push(`You poured too fast: the funnel overfilled past the paper rim and ${Math.round(bypass)} mL of unfiltered mixture ran down the side, so some sand is in your filtrate.`);
    const g = gradeOutcome(sample, outs.filter(nonEmpty).filter((x) => x.id !== "unpoured"), []);
    let verdict = g.verdict;
    if (!hasLiquid) verdict = "fails";
    return { verdict, recovered: g.recovered, headline: headlineFor(verdict, "filtration", sample, g), outputs: outs.filter(nonEmpty), lost: [], lines, caveats: bypass > 0.5 ? ["Overflow contaminated the filtrate"] : [], idea: "Filtration separates an insoluble solid from a liquid because the solid particles are larger than the pores in the paper." };
  };
  return run;
}

// ---------------------------------------------------------------------------------------------------------- decanting
function decantRun(sample, o) {
  const run = baseRun("decanting", sample, 8);
  const liquids = liquidsOf(sample);
  const solids = solidsOf(sample);
  const dens = (list) => { const m = list.reduce((a, p) => a + p.g, 0); const v = list.reduce((a, p) => a + gToMl(p.sub, p.g), 0); return m / Math.max(1e-9, v); };
  const polar = liquids.filter((p) => SUBSTANCES[p.sub].polar); const nonpolar = liquids.filter((p) => !SUBSTANCES[p.sub].polar);
  const twoLayers = polar.length > 0 && nonpolar.length > 0;
  const sinks = solids.filter((p) => SUBSTANCES[p.sub].density > 1.1 && !SUBSTANCES[p.sub].solubility && SUBSTANCES[p.sub].grainMm >= 0.05);
  const mode = twoLayers ? "layers" : sinks.length && liquids.length ? "sediment" : "none";
  let settle = 0; let poured = 0; let carry = 0;
  const top = twoLayers ? (dens(polar) < dens(nonpolar) ? polar : nonpolar) : null;
  const topG = top ? top.reduce((a, p) => a + p.g, 0) : 0;
  const liquidG = liquids.reduce((a, p) => a + p.g, 0);
  const keepFrac = mode === "sediment" ? 0.08 : 0; // some liquid always stays with the sediment
  run.controls = { pour: 0.3, tilt: false };
  run.view = { settle: mode === "none" ? 1 : 0, poured: 0, mode, tilt: 0, carry: 0 };
  run.step = (dt, ctl = {}) => {
    if (run.done) return;
    run.t += dt;
    if (mode !== "none") settle = clamp(settle + dt / 7, 0, 1); else settle = 1;
    const pour = clamp(ctl.pour ?? 0.3, 0, 1);
    const tilt = ctl.tilt ? 1 : 0;
    let tiltAmt = run.view.tilt + (tilt - run.view.tilt) * Math.min(1, dt * 3);
    if (tilt) {
      const total = mode === "layers" ? topG : liquidG * (1 - keepFrac);
      const dg = Math.min(total - poured, (0.5 + pour * 5) * dt * (total / 40));
      poured += dg;
      // stirred-up sediment / interface mixing is carried over when the liquid is poured too fast or too early
      const stir = (1 - settle) * 0.9 + Math.max(0, pour - 0.55) * 0.6;
      carry += dg * (0.004 + 0.12 * stir * stir);
      if (poured >= total - 1e-6) { run.done = true; }
    }
    run.view = { settle, poured, mode, tilt: tiltAmt, carry, pouredFrac: poured / Math.max(1, mode === "layers" ? topG : liquidG * (1 - keepFrac)) };
  };
  run.result = () => {
    const parts = []; const rest = [];
    if (mode === "layers") {
      const frac = poured / topG;
      for (const p of liquids) { const isTop = top.includes(p); const toOther = isTop ? p.g * frac : 0; if (toOther > 0) parts.push({ sub: p.sub, form: "liquid", g: toOther }); rest.push({ sub: p.sub, form: "liquid", g: p.g - toOther }); }
      const c = Math.min(carry, (liquidG - topG) * 0.5);
      const lowerSub = liquids.find((p) => !top.includes(p)).sub;
      if (c > 0) { parts.push({ sub: lowerSub, form: "liquid", g: c }); const r = rest.find((q) => q.sub === lowerSub); r.g -= c; }
    } else if (mode === "sediment") {
      const total = liquidG * (1 - keepFrac); const frac = total > 0 ? poured / total : 0;
      for (const p of liquids) { const give = p.g * (1 - keepFrac) * frac; parts.push({ sub: p.sub, form: "liquid", g: give }); rest.push({ sub: p.sub, form: "liquid", g: p.g - give }); }
      for (const p of dissolvedOf(sample)) { const give = p.g * (1 - keepFrac) * frac; parts.push({ sub: p.sub, form: "dissolved", g: give }); rest.push({ sub: p.sub, form: "dissolved", g: p.g - give }); }
      const solidsTot = solids.reduce((a, p) => a + p.g, 0);
      for (const p of solids) { const c = Math.min(p.g * 0.5, carry * (p.g / Math.max(1e-9, solidsTot))); parts.push({ sub: p.sub, form: "solid", g: c }); rest.push({ sub: p.sub, form: "solid", g: p.g - c }); }
    } else {
      const frac = liquidG > 0 ? poured / liquidG : 0;
      for (const p of sample.parts) { const give = p.form === "solid" ? 0 : p.g * frac; if (give > 0) parts.push({ sub: p.sub, form: p.form, g: give }); rest.push({ sub: p.sub, form: p.form, g: p.g - give }); }
    }
    const outs = [out("poured", "Receiving beaker (poured off)", parts), out("left", "Left in the first beaker", rest)].filter((x) => !isEmpty(x.sample));
    const lines = [];
    if (mode === "sediment") {
      lines.push(`${names(uniq(sinks.map((p) => p.sub)))} is denser than water (${SUBSTANCES[sinks[0].sub].density} against 1.00 g/cm³) and its grains are big, so it settles to the bottom in a few seconds; the liquid above can be poured off.`);
      lines.push("Decanting leaves a little liquid behind with the solid, and fine particles that were stirred up can be carried over, so it is cruder than filtration.");
    } else if (mode === "layers") {
      lines.push(`The liquids form two layers (${names(uniq(top.map((p) => p.sub)))} on top, less dense). The top layer can be poured off, but the boundary is hard to judge so a little of each liquid ends up in the wrong beaker.`);
      lines.push("A separating funnel does the same job much more cleanly.");
    } else lines.push(!liquids.length ? "There is no liquid to pour: decanting needs a liquid with something settled or layered in it." : "Nothing settles out: there is no heavy insoluble solid and no second layer, so pouring simply moves the whole mixture to another beaker.");
    if (carry > 0.3 && mode === "sediment") lines.push("You poured while the sediment was still settling or too quickly, so some sand was carried into the receiving beaker (the liquid stays cloudy).");
    const g = gradeOutcome(sample, outs, []);
    return { verdict: mode === "none" ? "fails" : g.verdict, recovered: g.recovered, headline: headlineFor(mode === "none" ? "fails" : g.verdict, "decanting", sample, g), outputs: outs, lost: [], lines, caveats: [], idea: "Decanting works when one component settles out (denser, insoluble) or forms a separate layer." };
  };
  return run;
}

// ------------------------------------------------------------------------------------------------ evaporation / crystallisation
function basinRun(method, sample, o) {
  const run = baseRun(method, sample, 30);
  const pot = createPot(sample, { vesselCp: 60, heatScale: o.heatScale ?? 1 });
  const lostVap = {}; const lostSubl = {}; let spatter = {}; let phase = "heat"; let coolFrom = null; let cooled = 0; let extra = 0;
  const dryAt = (fraction) => pot.liquidFraction() < fraction;
  run.controls = { heat: 0.5, stop: false };
  run.pot = pot;
  run.crystalTotal = sample.parts.filter((p) => p.form === "dissolved" && SUBSTANCES[p.sub].solubility).reduce((a, p) => a + p.g, 0);
  run.view = { T: pot.T, liquid: 1, boiling: false, phase, flash: false, crystals: 0, vapour: 0 };
  run.series.push([0, pot.T, null]);
  const solutesList = () => pot.solutes(pot.T);
  run.rodTest = () => solutesList().some((s) => s.g > 0 && s.g >= 0.97 * (solubilityAt(s.sub, pot.T) * pot.waterG()) / 100 && pot.waterG() > 0.05);
  run.crystalMass = () => solutesList().reduce((a, s) => a + s.crystals, 0);
  run.step = (dt, ctl = {}) => {
    if (run.done) return;
    run.t += dt;
    const dtl = dt * run.pace;
    const heat = clamp(ctl.heat ?? 0.5, 0, 1);
    if (phase === "heat") {
      if (method === "crystallisation" && ctl.stop) { phase = "cool"; coolFrom = pot.T; }
      else {
        const r = pot.step(dtl, heat);
        for (const [id, mol] of Object.entries(r.vapour)) lostVap[id] = (lostVap[id] ?? 0) + mol * MM(id);
        for (const [id, g] of Object.entries(r.sublimed)) lostSubl[id] = (lostSubl[id] ?? 0) + g;
        // spitting when the basin is nearly dry and the flame is strong: dissolved solid is thrown out
        if (pot.liquidMoles() > 0 && dryAt(0.14) && heat > 0.6) {
          for (const s of solutesList()) { const loss = Math.min(pot.nv[s.sub], s.g * 0.012 * (heat - 0.55) * dtl); if (loss > 0) { pot.nv[s.sub] -= loss; spatter[s.sub] = (spatter[s.sub] ?? 0) + loss; } }
        }
        for (const id of Object.keys(lostVap)) if (SUBSTANCES[id].flammable && lostVap[id] > 0.2 && heat > 0.02) { run.hazard = "fire"; run.done = true; }
        if (pot.dry && pot.liquidFraction() < 1e-6) {
          extra += dt;
          if (method === "crystallisation" && pot.nStart > 1e-9) { phase = "cool"; coolFrom = pot.T; }
          else if (extra > 14 || pot.reacted > 8) run.done = true;
        }
        if (ctl.stop && method === "evaporation") run.done = true;
      }
    }
    if (phase === "cool") {
      cooled = Math.min(1, cooled + dt / 9);
      pot.T = 20 + (coolFrom - 20) * (1 - cooled) ** 1.6;
      pot.boiling = false;
      if (cooled >= 1) run.done = true;
    }
    run.view = { T: pot.T, liquid: pot.liquidFraction(), boiling: pot.boiling, phase, flash: run.hazard === "fire", crystals: run.crystalMass(), vapour: pot.boiling ? Math.min(1, (pot.vapourRate ?? 0) * 20) : 0, reacted: pot.reacted, rod: method === "crystallisation" ? run.rodTest() : false, sublimed: Object.values(lostSubl).reduce((a, b) => a + b, 0), waterG: pot.waterG() };
    if (run.series.length < 1 || labTime(run) - run.series[run.series.length - 1][0] >= 5) run.series.push([labTime(run), pot.T, null]);
  };
  run.stop = () => { run.stopped = true; if (method === "crystallisation" && phase === "heat") { phase = "cool"; coolFrom = pot.T; } else run.done = true; };
  run.rawResult = () => {
    const lost = [];
    for (const [id, g] of Object.entries(lostVap)) lost.push({ sub: id, g, how: "evaporated into the air" });
    for (const [id, g] of Object.entries(lostSubl)) lost.push({ sub: id, g, how: "sublimed into the air (toxic purple vapour)" });
    for (const [id, g] of Object.entries(spatter)) lost.push({ sub: id, g, how: "spat out of the dish" });
    const contents = pot.contents("Evaporating basin");
    let outs; const lines = [];
    const solutes = pot.solutes(pot.T);
    const hadSolution = sample.parts.some((q) => q.form === "dissolved" && SUBSTANCES[q.sub].solubility) && gramsOf(sample, "water") > 0;
    if (method === "crystallisation" && solutes.length && hadSolution) {
      const crystals = contents.parts.filter((p) => p.form === "solid" && SUBSTANCES[p.sub].solubility);
      const rest = contents.parts.filter((p) => !(p.form === "solid" && SUBSTANCES[p.sub].solubility));
      outs = [out("crystals", "Crystals (filtered off and dried)", crystals), out("liquor", "Solution left (mother liquor)", rest)];
    } else outs = [out("basin", method === "evaporation" ? "Evaporating basin (residue)" : "Dish", contents.parts)];
    outs = outs.filter((x) => !isEmpty(x.sample));
    return { outs, lost, contents, lines };
  };
  run.result = () => finishBasin(run, sample, method);
  return run;
}

function finishBasin(run, sample, method) {
  const base = run.rawResult();
  const { outs, lost } = base; const lines = [];
  const g = gradeOutcome(sample, outs, lost);
  let verdict = g.verdict; const caveats = [];
  const flam = lost.filter((l) => SUBSTANCES[l.sub]?.flammable);
  const iod = lost.filter((l) => SUBSTANCES[l.sub]?.sublimes);
  const salt = Object.keys(SUBSTANCES).filter((id) => SUBSTANCES[id].solubility && gramsOf(sample, id) > 0);
  if (run.hazard === "fire") {
    verdict = "unsafe";
    lines.push(`${names(uniq(flam.map((l) => l.sub)))} vapour is flammable. It drifted into the Bunsen flame and caught fire: never heat flammable liquids over a naked flame (use a water bath and a condenser).`);
  } else if (run.pot.reacted > 0.3) {
    verdict = "reaction";
    lines.push("Strong heating made iron and sulfur react: Fe + S → FeS. Iron(II) sulfide is a new compound, black and not magnetic, so the iron cannot be pulled out with a magnet any more. A mixture can be separated by physical means; a compound cannot.");
  } else {
    const lostLiquid = lost.filter((l) => SUBSTANCES[l.sub]?.kind === "liquid");
    if (lostLiquid.length) { const ids = uniq(lostLiquid.map((l) => l.sub)); lines.push(`${names(ids)} (boiling point ${ids.map((id) => SUBSTANCES[id].bp).join(" / ")} \u00b0C) evaporate${ids.length === 1 ? "s" : ""} into the air: the liquid is lost, only what does not evaporate is left in the basin.`); }
    const nonvol = outs.flatMap((x) => x.sample.parts).filter((p) => p.form !== "liquid").map((p) => p.sub);
    if (nonvol.length) lines.push(`${names(uniq(nonvol))} ${uniq(nonvol).length > 1 ? "do" : "does"} not boil off at these temperatures, so ${uniq(nonvol).length > 1 ? "they stay" : "it stays"} in the basin.`);
    if (!lostLiquid.length && !iod.length && !nonvol.length) lines.push("Nothing evaporated.");
    if (iod.length) { lines.push("Iodine sublimes when warmed, so it escaped as purple vapour instead of staying in the dish: toxic, and it is lost."); caveats.push("Iodine vapour lost"); }
    const dyes = outs.flatMap((x) => x.sample.parts).filter((p) => SUBSTANCES[p.sub].dye);
    if (dyes.length > 1) { lines.push("All the dyes were left together in one smear: evaporation removes the solvent but cannot tell the dyes apart."); }
    const spat = lost.filter((l) => l.how.startsWith("spat"));
    if (spat.length) { lines.push("The flame was too strong near the end, so the nearly dry solid spat out of the basin: you lose product."); caveats.push("Product lost by spitting"); }
    if (method === "crystallisation") {
      const sol = salt[0];
      if (!sol) { lines.push("There is no dissolved crystalline solid, so nothing crystallises."); if (verdict === "works") verdict = "partial"; }
      else {
        const cr = outs.find((x) => x.id === "crystals"); const crG = cr ? gramsOf(cr.sample, sol) : 0;
        const orig = gramsOf(sample, sol);
        lines.push(`Crystals of ${lc(subName(sol))} formed on cooling: ${fmtG(crG)} of the ${fmtG(orig)} dissolved (${Math.round((100 * crG) / orig)} % yield).`);
        const s20 = solubilityAt(sol, 20); const s100 = solubilityAt(sol, 100);
        lines.push(s100 / s20 > 2 ? `${subName(sol)} is much more soluble hot than cold (${s20.toFixed(0)} g per 100 g water at 20 °C, ${s100.toFixed(0)} g at 100 °C), so cooling a hot, concentrated solution leaves most of it as crystals.` : `Sodium chloride's solubility hardly changes with temperature (${s20.toFixed(1)} g per 100 g water at 20 °C, ${s100.toFixed(1)} g at 100 °C), so cooling gets almost nothing: nearly all the salt stays dissolved. For salt you must boil off the water (evaporation) instead.`);
        if (crG / orig < 0.4 && s100 / s20 > 2) lines.push("The yield is low because you stopped at the wrong moment: stop heating at the crystallisation point (a glass rod dipped in and cooled shows small crystals), then cool slowly.");
        if (crG / orig > 0.97 && s100 / s20 > 2) lines.push("You heated to dryness: that gives powder (and, for hydrated crystals, loses water of crystallisation) instead of well-formed crystals.");
        if (crG / orig < 0.4) { if (verdict === "works") verdict = "partial"; }
      }
    } else if (salt.length && verdict === "works") lines.push("Evaporating to dryness gives the solid quickly but as a crust or powder, not crystals; and it cannot recover the solvent.");
  }
  const headline = headlineFor(verdict, method, sample, g, run);
  const idea = method === "evaporation" ? "Evaporation removes a volatile liquid and leaves a dissolved solid behind. It only works if the solid is not volatile and you do not need the liquid." : "Crystallisation uses the fall in solubility as a hot, concentrated solution cools: the solid that no longer fits in the solution forms crystals.";
  return { verdict, recovered: g.recovered, headline, outputs: outs, lost, lines, caveats, idea, hazard: run.hazard };
}

// ----------------------------------------------------------------------------------------------------------- distillation
function distillationRun(method, sample, o) {
  const run = baseRun(method, sample, 30);
  const plates = method === "fractional-distillation" ? (o.plates ?? 6) : 1;
  const pot = createPot(sample, { vesselCp: 90, heatScale: o.heatScale ?? 1, plates });
  const receivers = [{}]; let cur = 0; let reading = 20; const deposit = {};
  run.pot = pot; run.plates = plates; run.receivers = receivers;
  run.controls = { heat: 0.7, receiver: 0 };
  run.changeReceiver = () => { if (cur < RECEIVER_MAX - 1) { cur += 1; receivers.push({}); } return cur; };
  run.currentReceiver = () => cur;
  run.view = { Tpot: pot.T, Thead: reading, boiling: false, liquid: 1, flow: 0, receiver: 0, stageT: [] };
  run.series.push([0, pot.T, reading]);
  let dryTime = 0;
  run.step = (dt, ctl = {}) => {
    if (run.done) return;
    run.t += dt;
    const dtl = dt * run.pace; const heat = clamp(ctl.heat ?? 0.7, 0, 1);
    // several small sub-steps keep the composition model accurate at 8x speed
    const sub = Math.max(1, Math.ceil(dtl / 1.0)); const h = dtl / sub; let moved = 0;
    for (let k = 0; k < sub; k++) {
      const r = pot.step(h, heat);
      for (const [id, mol] of Object.entries(r.vapour)) { receivers[cur][id] = (receivers[cur][id] ?? 0) + mol; moved += mol; }
      for (const [id, g] of Object.entries(r.sublimed)) deposit[id] = (deposit[id] ?? 0) + g;
      const target = pot.boiling ? pot.head.T : 20 + (pot.T - 20) * 0.3;
      reading += (target - reading) * (1 - Math.exp(-h / 14));
    }
    const lf = pot.liquidFraction();
    const volMass = () => pot.ids.reduce((a, id) => a + pot.liquidG(id), 0);
    if (run.volMass0 == null) run.volMass0 = volMass();
    const lfMass = run.volMass0 > 0 ? volMass() / run.volMass0 : 0;
    run.view = { Tpot: pot.T, Thead: reading, boiling: pot.boiling, liquid: lfMass, flow: pot.boiling ? clamp(moved / Math.max(1e-9, dtl) * 8, 0, 1) : 0, receiver: cur, stageT: pot.head.stageT ?? [], platesEff: pot.platesEff ?? plates, deposit: Object.values(deposit).reduce((a, b) => a + b, 0), reacted: pot.reacted, receiverMl: receivers.map((rc) => Object.entries(rc).reduce((a, [id, mol]) => a + gToMl(id, mol * MM(id)), 0)) };
    if (labTime(run) - run.series[run.series.length - 1][0] >= 6) run.series.push([labTime(run), pot.T, reading]);
    if (pot.nStart > 0 && lfMass < 0.04) run.done = true;
    if (pot.nStart <= 1e-9) { dryTime += dt; if (dryTime > 18 || pot.reacted > 5) run.done = true; }
  };
  run.stop = () => { run.stopped = true; run.done = true; };
  run.receiverContent = (k) => Object.entries(receivers[k] ?? {}).map(([id, mol]) => ({ sub: id, form: "liquid", g: mol * MM(id) }));
  run.result = () => {
    const outs = [];
    receivers.forEach((rc, k) => { const parts = run.receiverContent(k); if (parts.reduce((a, p) => a + p.g, 0) > 1e-6) outs.push(out(`receiver-${k + 1}`, receivers.length > 1 ? `Receiving flask ${k + 1}` : "Receiving flask (distillate)", parts)); });
    const residue = pot.contents("Distillation flask (residue)");
    if (!isEmpty(residue)) outs.push({ id: "flask", vessel: "Distillation flask (left behind)", sample: normalise(residue), note: "" });
    const dep = Object.entries(deposit).filter(([, g]) => g > 0.01).map(([sub, g]) => ({ sub, form: "solid", g }));
    if (dep.length) outs.push(out("condenser", "Inside the condenser (solid)", dep));
    const g = gradeOutcome(sample, outs, []);
    const lines = []; let verdict = g.verdict; const caveats = [];
    const vol = sample.parts.filter((p) => p.form === "liquid" && !SUBSTANCES[p.sub].nonvolatile).map((p) => p.sub);
    const cols = method === "fractional-distillation" ? "fractionating column" : "flask";
    if (pot.reacted > 0.3) { verdict = "reaction"; lines.push("There is no liquid to distil. Heating the dry powders strongly made iron and sulfur react to form iron(II) sulfide (FeS), a new compound: that is a chemical change, not a separation."); }
    else if (!vol.length) { lines.push(`There is no volatile liquid in this sample, so nothing distils. ${deposit.iodine ? "" : "The mixture is simply heated in a closed apparatus, which wastes time and energy."}`); if (!deposit.iodine) verdict = "fails"; }
    else {
      const solid = uniq(sample.parts.filter((p) => p.form !== "liquid" && !SUBSTANCES[p.sub].nonvolatile || SUBSTANCES[p.sub].nonvolatile).map((p) => p.sub));
      if (vol.length === 1) lines.push(`${subName(vol[0])} boils at ${SUBSTANCES[vol[0]].bp} °C and condenses in the condenser as pure liquid; ${names(solid)} ${solid.length > 1 ? "do" : "does"} not boil, so ${solid.length > 1 ? "they stay" : "it stays"} behind in the ${cols}.`);
      else if (method === "simple-distillation" && vol.length === 2) lines.push("Both liquids evaporate, but the more volatile one (lower boiling point) is richer in the vapour, so the first distillate is enriched, not pure. Simple distillation can only part-separate liquids whose boiling points are close.");
      if (vol.length > 1 && method === "fractional-distillation") lines.push("Each plate of the column re-condenses and re-boils the vapour, enriching it in the more volatile liquid: the thermometer holds near that liquid's boiling point while it comes over, then rises.");
      if (vol.length === 2 && vol.includes("ethanol")) {
        const k = receivers.findIndex((rc) => (rc.ethanol ?? 0) > 0);
        if (k >= 0) { const rc = receivers[k]; const e = (rc.ethanol ?? 0) * MM("ethanol"); const w = (rc.water ?? 0) * MM("water"); const wf = e / Math.max(1e-9, e + w); lines.push(`First receiver: ${(100 * wf).toFixed(0)} % ethanol by mass${method === "fractional-distillation" ? "" : " (simple distillation)"}. The limit with ethanol and water is the azeotrope: about 95.6 % ethanol, 78.2 °C: no amount of distilling gives purer ethanol.`); }
      }
      if (vol.length > 2 && receivers.length === 1) { lines.push("You collected everything in one flask, so the fractions are mixed again. Change the receiving flask as the temperature rises to keep the fractions apart."); caveats.push("Fractions mixed"); }
      if (vol.length > 2 && method === "simple-distillation") lines.push("Simple distillation has no column, so each fraction carries a lot of the next one: the thermometer rises smoothly with no clear plateaus.");
      if (pot.platesEff && plates > 1 && pot.platesEff < plates * 0.85) { lines.push("The flame was too strong, so the column flooded and lost separating power: heat gently."); caveats.push("Heated too strongly"); }
      if (deposit.iodine) lines.push("Iodine sublimed in the flask and re-solidified inside the cold condenser, which can block it: use a sublimation set-up instead.");
      const salt = Object.keys(SUBSTANCES).find((id) => SUBSTANCES[id].solubility && gramsOf(sample, id) > 0);
      if (salt && pot.contents().parts.some((p) => p.sub === salt && p.form === "solid")) lines.push(`${subName(salt)} crystals appeared in the flask as the water left: the solution became saturated.`);
    }
    // Distillation fractions are never perfectly pure, so judge them by their MAJOR component (a clean cut), not by the 98.5 % rule:
    //   volatile liquids: some receiver (or the flask) holds >= 60 % of that liquid and it makes up >= 90 % of that vessel's liquid
    //   (ethanol with water only needs 85 %: the azeotrope stops ethanol reaching 100 %)
    //   non-volatile things left in the flask: >= 95 % of the non-liquid contents
    let recovered = { ...g.recovered };
    if (vol.length && pot.reacted <= 0.3) {
      const vessels = outs.filter((x) => x.id.startsWith("receiver") || x.id === "flask");
      for (const id of vol) {
        const thr = vol.length === 2 && vol.includes("ethanol") && id === "ethanol" ? 0.85 : 0.9; const orig = gramsOf(sample, id); let best = null;
        for (const v of vessels) { const liq = v.sample.parts.filter((p) => p.form === "liquid"); const tot = liq.reduce((a, p) => a + p.g, 0); const mine = liq.filter((p) => p.sub === id).reduce((a, p) => a + p.g, 0); if (tot > 0 && mine / tot >= thr && mine / orig >= 0.6) best = { output: v.id, form: "liquid", purity: mine / tot, yield: mine / orig }; }
        recovered[id] = best;
      }
      const flask = outs.find((x) => x.id === "flask");
      if (flask) for (const p of flask.sample.parts) { if (vol.includes(p.sub)) continue; const dry = flask.sample.parts.filter((q) => q.form !== "liquid" || SUBSTANCES[q.sub].nonvolatile); const tot = dry.reduce((a, q) => a + q.g, 0); const mine = dry.filter((q) => q.sub === p.sub).reduce((a, q) => a + q.g, 0); if (mine / tot >= 0.95 && mine / Math.max(1e-9, gramsOf(sample, p.sub)) >= 0.6) recovered[p.sub] = { output: "flask", form: "left behind", purity: mine / tot, yield: mine / gramsOf(sample, p.sub) }; }
      const subs = Object.keys(recovered); const nDone = subs.filter((k) => recovered[k]).length;
      verdict = nDone === subs.length ? "works" : nDone === 0 ? "fails" : "partial";
      if (verdict === "fails" && vol.length > 1) {
        // enrichment still counts as a partial separation: some receiver is clearly richer in one liquid than the original sample
        const liqTot = vol.reduce((a, id) => a + gramsOf(sample, id), 0);
        const enriched = vessels.some((v) => { const liq = v.sample.parts.filter((p) => p.form === "liquid"); const tot = liq.reduce((a, p) => a + p.g, 0); return tot > 0.2 * liqTot * 0.1 && vol.some((id) => liq.filter((p) => p.sub === id).reduce((a, p) => a + p.g, 0) / tot >= gramsOf(sample, id) / liqTot + 0.15); });
        if (enriched) verdict = "partial";
      }
    }
    g.recovered = recovered;
    return { verdict, recovered: g.recovered, headline: headlineFor(verdict, method, sample, g, run), outputs: outs, lost: [], lines, caveats, idea: method === "fractional-distillation" ? "Fractional distillation separates miscible liquids with different boiling points: a column repeats evaporation and condensation so the more volatile liquid comes off first." : "Simple distillation separates a liquid from a dissolved solid (or from a liquid with a much higher boiling point) because only the liquid evaporates and then condenses." };
  };
  return run;
}

// --------------------------------------------------------------------------------------------------------- chromatography
function chromatographyRun(sample, o) {
  const run = baseRun("chromatography", sample, 40);
  const solvent = o.solvent === "ethanol" ? "ethanol" : "water";
  const gram = chromatogram(sample, solvent);
  run.solvent = solvent; run.gram = gram;
  const T = 22;
  run.view = { front: CHROMA.solventLine, frontDist: 0, spots: gram.spots.map((s) => ({ sub: s.sub, dist: 0, rf: s.rf })), t: 0, solvent };
  run.step = (dt) => {
    if (run.done) return;
    run.t += dt;
    const u = clamp(run.t / T, 0, 1);
    const frontH = CHROMA.solventLine + (CHROMA.top - CHROMA.solventLine) * Math.sqrt(u);
    const frontDist = Math.max(0, frontH - CHROMA.baseline);
    run.view = { front: frontH, frontDist, spots: gram.spots.map((s) => ({ sub: s.sub, dist: s.rf * frontDist, rf: s.rf })), t: u, solvent };
    if (u >= 1) run.done = true;
  };
  run.result = () => {
    const lines = []; let verdict;
    const dyes = gram.spots; const moving = dyes.filter((s) => s.rf > 0.02);
    if (!dyes.length) { verdict = "fails"; lines.push("There are no coloured dissolved substances to see. Colourless solutes (like salt) would need a locating agent to be seen, and solids like sand stay at the baseline."); }
    else if (!moving.length) { verdict = "fails"; lines.push(`The marker pigments do not dissolve in ${solvent}, so the solvent cannot carry them: every spot stays on the baseline (Rf = 0). Choose a solvent that dissolves them (here, ethanol).`); }
    else if (moving.length < dyes.length) { verdict = "partial"; lines.push("Only some of the substances moved in this solvent."); }
    else verdict = moving.length >= 2 ? "works" : "partial";
    if (moving.length >= 2) lines.push(`${moving.length} separate spots: the ink is a mixture of ${moving.length} dyes. Each dye has its own balance between sticking to the paper (stationary phase) and dissolving in the ${solvent} (mobile phase), so each travels a different fraction of the solvent's distance.`);
    if (moving.length === 1) lines.push("One spot only: this suggests a single pure substance (or a mixture whose parts travel together in this solvent).");
    if (moving.length) lines.push("Rf = distance moved by the spot ÷ distance moved by the solvent front, both measured from the baseline. It is always between 0 and 1 and is constant for a substance under the same conditions, so it can identify it.");
    const ordered = [...moving].sort((a, b) => b.rf - a.rf);
    if (ordered.length > 1) lines.push(`${subName(ordered[0].sub)} travels furthest (Rf ${ordered[0].rf.toFixed(2)}): it is the most soluble in the solvent and sticks least to the paper.`);
    return { verdict, recovered: {}, headline: headlineFor(verdict, "chromatography", sample, { recovered: {} }, run), outputs: [], lost: [], lines, caveats: [], chromatogram: { ...gram, solvent }, idea: "Chromatography separates dissolved substances that differ in how strongly they stick to the paper and how well they dissolve in the solvent." };
  };
  return run;
}

// -------------------------------------------------------------------------------------------------------------- magnetic
function magneticRun(sample, o) {
  const run = baseRun("magnetic", sample, 5);
  const mag = sample.parts.filter((p) => p.form === "solid" && SUBSTANCES[p.sub].magnetic);
  const magG = mag.reduce((a, p) => a + p.g, 0);
  let passes = 0; let sweep = 0; let sweeping = false; let collectedFrac = 0;
  run.controls = { sweep: false };
  run.view = { sweep: 0, passes: 0, collected: 0, hasMagnetic: magG > 0 };
  run.sweep = () => { if (!sweeping && !run.done) { sweeping = true; sweep = 0; } };
  run.step = (dt, ctl = {}) => {
    if (run.done) return;
    run.t += dt;
    if (ctl.sweep) run.sweep();
    if (sweeping) {
      sweep = Math.min(1, sweep + dt / 3.2);
      if (sweep >= 1) { sweeping = false; passes += 1; collectedFrac += (1 - collectedFrac) * 0.72; sweep = 0; if (passes >= 3) run.done = true; }
    }
    run.view = { sweep: sweeping ? sweep : 0, sweeping, passes, collected: magG > 0 ? collectedFrac : 0, hasMagnetic: magG > 0 };
  };
  run.finish = () => { run.stopped = true; run.done = true; };
  run.result = () => {
    const f = magG > 0 ? collectedFrac : 0;
    const onMagnet = []; const tray = [];
    for (const p of sample.parts) { const take = p.form === "solid" && SUBSTANCES[p.sub].magnetic ? p.g * f : 0; if (take > 0) onMagnet.push({ sub: p.sub, form: "solid", g: take }); tray.push({ sub: p.sub, form: p.form, g: p.g - take }); }
    const outs = [out("magnet", "On the magnet", onMagnet), out("tray", "Left in the tray", tray)].filter((x) => !isEmpty(x.sample));
    const lines = [];
    if (!magG) lines.push(`Nothing here is attracted to a magnet (${names(uniq(sample.parts.map((p) => p.sub)))}): only iron, cobalt and nickel are magnetic. The magnet picks up nothing, so there is no separation.`);
    else { lines.push("Iron is ferromagnetic, so the magnet pulls the filings out; sulfur (like most elements and compounds) is not attracted at all."); lines.push(`${passes} pass${passes === 1 ? "" : "es"} collected ${(100 * f).toFixed(0)} % of the iron. Wrapping the magnet in a bag lets you drop the iron into a dish by removing the bag. The mixture was never chemically combined, so a physical method is enough.`); }
    const g = gradeOutcome(sample, outs.filter((x) => !(x.id === "tray" && !magG)), []);
    const verdict = !magG ? "fails" : f > 0.9 ? g.verdict : "partial";
    return { verdict, recovered: g.recovered, headline: headlineFor(verdict, "magnetic", sample, g), outputs: outs, lost: [], lines, caveats: [], idea: "Magnetic separation works when only one component is magnetic." };
  };
  return run;
}

// ------------------------------------------------------------------------------------------------------ separating funnel
function funnelRun(sample, o) {
  const run = baseRun("separating-funnel", sample, 8);
  const liquids = liquidsOf(sample); const solids = solidsOf(sample); const dis = dissolvedOf(sample);
  const polar = liquids.filter((p) => SUBSTANCES[p.sub].polar); const nonpolar = liquids.filter((p) => !SUBSTANCES[p.sub].polar);
  const two = polar.length > 0 && nonpolar.length > 0;
  const dens = (list) => list.reduce((a, p) => a + p.g, 0) / Math.max(1e-9, list.reduce((a, p) => a + gToMl(p.sub, p.g), 0));
  let lowerSet; let upperSet;
  if (two) { const polarLower = dens(polar) > dens(nonpolar); lowerSet = polarLower ? polar : nonpolar; upperSet = polarLower ? nonpolar : polar; }
  else { lowerSet = liquids; upperSet = []; }
  const withLower = (p) => (lowerSet.includes(p) || (two && lowerSet === polar && p.form === "dissolved") || p.form === "solid" || (!two && p.form === "dissolved"));
  const lowerParts = sample.parts.filter((p) => withLower(p)); const upperParts = sample.parts.filter((p) => !withLower(p));
  const lowerG = lowerParts.reduce((a, p) => a + p.g, 0); const upperG = upperParts.reduce((a, p) => a + p.g, 0);
  const total = lowerG + upperG;
  let drained = 0;
  run.controls = { tap: 0 };
  run.lowerLabel = lowerSet.length ? names(uniq(lowerSet.map((p) => p.sub))) : "mixture";
  run.view = { drained: 0, lowerG, upperG, total, two, tap: 0, interfaceFrac: lowerG / Math.max(1e-9, total) };
  run.step = (dt, ctl = {}) => {
    if (run.done) return;
    run.t += dt;
    const tap = clamp(ctl.tap ?? 0, 0, 1);
    drained = Math.min(total, drained + tap * 9 * dt * (total / 60));
    run.view = { drained, lowerG, upperG, total, two, tap, interfaceFrac: lowerG / Math.max(1e-9, total), inFunnel: total - drained };
    if (drained >= total - 1e-6) run.done = true;
  };
  run.finish = () => { run.stopped = true; run.done = true; };
  run.result = () => {
    const dl = Math.min(drained, lowerG); const du = Math.max(0, drained - lowerG);
    const beaker = []; const funnel = [];
    const share = (list, g, gAll, form) => list.forEach((p) => { const take = g * (p.g / Math.max(1e-9, gAll)); beaker.push({ sub: p.sub, form: p.form, g: take }); funnel.push({ sub: p.sub, form: p.form, g: p.g - take }); });
    share(lowerParts, dl, lowerG); share(upperParts, du, upperG);
    const outs = [out("beaker", "Beaker (drained through the tap)", beaker), out("funnel", "Left in the funnel", funnel)].filter((x) => !isEmpty(x.sample));
    const lines = [];
    if (two) {
      lines.push(`${names(uniq(lowerSet.map((p) => p.sub)))} (denser, ${dens(lowerSet).toFixed(2)} g/cm³) forms the lower layer and ${names(uniq(upperSet.map((p) => p.sub)))} (${dens(upperParts.filter((p) => p.form === "liquid")).toFixed(2)} g/cm³) floats on top, because the liquids are immiscible (water molecules are polar and hydrogen-bonded; oil molecules are non-polar).`);
      if (du > 0.4) lines.push(`You left the tap open too long: ${du.toFixed(1)} g of the upper layer ran into the beaker with the lower layer. Close the tap just as the boundary reaches it.`);
      else if (dl < lowerG - 0.6 && !run.done) lines.push("You closed the tap early, so some of the lower layer is still in the funnel with the upper layer (lower yield).");
      else if (dl >= lowerG - 0.6) lines.push("You closed the tap as the boundary reached it: a clean cut.");
    } else lines.push(!liquids.length ? "There is no liquid at all, so a separating funnel has nothing to separate." : solids.length ? "There is only one liquid layer, with solid grains in it. Nothing separates: the tap drains water and sand together (and sand can block the tap)." : `${dis.length ? "The solute is dissolved in the liquid" : "The liquids are miscible"}: there is only ONE layer, so there is no boundary to find and nothing to separate.`);
    const g = gradeOutcome(sample, outs, []);
    const verdict = !two ? "fails" : g.verdict;
    return { verdict, recovered: g.recovered, headline: headlineFor(verdict, "separating-funnel", sample, g), outputs: outs, lost: [], lines, caveats: [], idea: "A separating funnel separates immiscible liquids: the denser layer is run off through the tap." };
  };
  return run;
}

// -------------------------------------------------------------------------------------------------------------- sublimation
function sublimationRun(sample, o) {
  const run = baseRun("sublimation", sample, 20);
  const pot = createPot(sample, { vesselCp: 60, heatScale: o.heatScale ?? 1 });
  let sublG = 0; let escaped = 0; let hotTime = 0; const lostVap = {};
  const canSublime = sample.parts.some((p) => p.form === "solid" && SUBSTANCES[p.sub].sublimes);
  run.pot = pot;
  run.controls = { heat: 0.1 };
  run.view = { T: pot.T, sublimed: 0, escaped: 0, vapour: 0 };
  run.series.push([0, pot.T, null]);
  run.step = (dt, ctl = {}) => {
    if (run.done) return;
    run.t += dt;
    const dtl = dt * run.pace; const heat = clamp(ctl.heat ?? 0.1, 0, 1);
    const r = pot.step(dtl, heat);
    for (const [id, mol] of Object.entries(r.vapour)) lostVap[id] = (lostVap[id] ?? 0) + mol * MM(id);
    const dg = Object.values(r.sublimed).reduce((a, b) => a + b, 0);
    if (pot.T > 114) hotTime += dtl;
    const esc = Math.min(dg, dg * clamp(hotTime / 160, 0, 0.45));
    escaped += esc; sublG += dg - esc;
    run.view = { T: pot.T, sublimed: sublG, escaped, vapour: dg > 0 ? 1 : 0, melted: pot.T > 114, reacted: pot.reacted };
    if (labTime(run) - run.series[run.series.length - 1][0] >= 5) run.series.push([labTime(run), pot.T, null]);
    const left = Object.entries(pot.nv).filter(([sub]) => SUBSTANCES[sub].sublimes).reduce((a, [, g]) => a + g, 0);
    if (canSublime && left < 0.02) run.done = true;
    if (!canSublime && run.t > 16) run.done = true;
    if (pot.reacted > 5) run.done = true;
  };
  run.stop = () => { run.stopped = true; run.done = true; };
  run.result = () => {
    const contents = pot.contents("Evaporating dish");
    const outs = []; const lost = [];
    if (sublG > 1e-4) outs.push(out("sublimate", "Cold funnel (iodine crystals)", [{ sub: "iodine", form: "solid", g: sublG }]));
    if (!isEmpty(contents)) outs.push({ id: "dish", vessel: "Left in the dish", sample: normalise(contents), note: "" });
    if (escaped > 1e-4) lost.push({ sub: "iodine", g: escaped, how: "escaped as vapour (the dish was too hot: iodine melted)" });
    for (const [id, g] of Object.entries(lostVap)) lost.push({ sub: id, g, how: "evaporated into the air" });
    const g = gradeOutcome(sample, outs, lost);
    const lines = []; let verdict = canSublime ? g.verdict : "fails";
    if (pot.reacted > 0.3) { verdict = "reaction"; lines.push("Strong heating made the iron and sulfur react to iron(II) sulfide: a chemical change, not a separation."); }
    else if (canSublime) {
      lines.push("Iodine changes directly from solid to vapour when warmed (sublimation) because its molecules are held by weak London forces; the vapour touches the cold funnel and turns straight back into dark crystals. Sand, a giant lattice, does nothing.");
      if (escaped > 0.15) lines.push("You heated too strongly: the iodine melted and some vapour escaped past the funnel. Heat gently and keep the funnel cold.");
    } else lines.push(`Nothing in this sample sublimes (${names(uniq(sample.parts.map((p) => p.sub)))}). ${Object.keys(lostVap).length ? "The liquid just evaporates and drips back off the cold funnel." : "Nothing happens."} Sublimation only works if exactly one component changes straight from solid to gas.`);
    return { verdict, recovered: g.recovered, headline: headlineFor(verdict, "sublimation", sample, g), outputs: outs, lost, lines, caveats: [], idea: "Sublimation separates a solid that turns directly into a gas on heating from one that does not." };
  };
  return run;
}

// --------------------------------------------------------------------------------------------------------------- shared text
function headlineFor(verdict, method, sample, g) {
  const base = { works: "It worked: the mixture was separated.", partial: "Partly worked: some components were separated, others are still mixed.", fails: "It did not separate the mixture.", unsafe: "Unsafe: this method should not be used here.", reaction: "A chemical change happened, not a separation.", prep: "Preparation step done." };
  return base[verdict] ?? "";
}

export const METHOD_IDS = ["dissolve", "decanting", "filtration", "evaporation", "crystallisation", "simple-distillation", "fractional-distillation", "chromatography", "magnetic", "separating-funnel", "sublimation"];

/** Create a run for `methodId` on `sample`. opts: { heatScale, plates, solvent, waterG }. */
export function createRun(methodId, sample, opts = {}) {
  let run;
  switch (methodId) {
    case "dissolve": run = dissolveRun(sample, opts); break;
    case "filtration": run = filtrationRun(sample, opts); break;
    case "decanting": run = decantRun(sample, opts); break;
    case "evaporation": case "crystallisation": run = basinRun(methodId, sample, opts); break;
    case "simple-distillation": case "fractional-distillation": run = distillationRun(methodId, sample, opts); break;
    case "chromatography": run = chromatographyRun(sample, opts); break;
    case "magnetic": run = magneticRun(sample, opts); break;
    case "separating-funnel": run = funnelRun(sample, opts); break;
    case "sublimation": run = sublimationRun(sample, opts); break;
    default: throw new Error(`unknown method ${methodId}`);
  }
  // hostile input: a bad time step is ignored (0) and a very long one is capped, so a stalled tab can never jump the model
  const rawStep = run.step;
  run.step = (dt, ctl) => rawStep(Number.isFinite(dt) && dt > 0 ? Math.min(dt, 5) : 0, ctl ?? {});
  return run;
}

/**
 * What a careful student would do with the live controls at this moment (used by "Skip to the end", the Challenge and the tests).
 * Mutates and returns `ctl`.
 */
export function autoControls(methodId, run, ctl, sample) {
  switch (methodId) {
    case "crystallisation": ctl.heat = 0.6; if (run.rodTest?.()) ctl.stop = true; break;
    case "evaporation": ctl.heat = run.view.liquid < 0.2 ? 0.45 : 0.6; break;
    case "simple-distillation": case "fractional-distillation": {
      ctl.heat = 0.65;
      // a careful student changes the receiving flask a little after each boiling point has passed
      const bps = sample.parts.filter((p) => p.form === "liquid" && !SUBSTANCES[p.sub].nonvolatile).map((p) => SUBSTANCES[p.sub].bp); const sorted = [...new Set(bps)].sort((a, b) => a - b);
      const k = run.currentReceiver();
      if (sorted.length > 1 && k < sorted.length - 1 && run.view.Thead > sorted[k] + Math.min(12, 0.4 * (sorted[k + 1] - sorted[k]))) run.changeReceiver();
      break;
    }
    case "decanting": ctl.tilt = run.view.settle >= 0.98; ctl.pour = 0.25; break;
    case "magnetic": ctl.sweep = !run.view.sweeping; break;
    case "separating-funnel": { const v = run.view; ctl.tap = v.drained >= v.lowerG - 0.4 ? 0 : v.drained >= v.lowerG - 6 ? 0.15 : 0.6; if (v.two === false && v.drained > 0) ctl.tap = 0.6; if (ctl.tap === 0) run.finish(); break; }
    case "sublimation": ctl.heat = 0.1; break;
    case "filtration": ctl.pour = 0.3; break;
    default: break;
  }
  return ctl;
}

/** Run a method to the end with sensible default student behaviour (headless). Returns { run, result }. */
export function runToEnd(methodId, sample, opts = {}) {
  const run = createRun(methodId, sample, opts);
  const dt = 0.25; let guard = 0;
  const ctl = { heat: 0.6, pour: 0.35, tap: 0, stir: true, tilt: false, stop: false };
  while (!run.done && guard++ < 6000) { autoControls(methodId, run, ctl, sample); run.step(dt, ctl); }
  return { run, result: run.result() };
}
