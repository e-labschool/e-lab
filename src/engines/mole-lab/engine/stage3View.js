// Derived, read-only VIEW of the Stage 3 scene: every number the UI shows, as { exact, text } pairs.  All chemistry comes from
// solutions.js / dilution.js (c = n / V, C1V1 = C2V2); the particle viewer's ion counts are a DISPLAY mapping of c (concLab.js),
// never an input to any calculation.
import { fromQuanta, fmtSig, fmtFixed, clean } from "./numeric.js";
import { molarMass } from "./substances.js";
import { concentration, amountFromConcentration, mlToDm3 } from "./solutions.js";
import { dilute, solutionConc } from "./dilution.js";
import { findPacket, findVessel } from "./packetOps.js";
import { getSolute, aqKeyOf, GLASS, fmtMl, formulaUnitsInWindow, drawnPairs, WINDOW_NM, suggestedWaterMl, volumeUpperBoundMl } from "./concLab.js";
import { experimentDef, STAGE3_EXPERIMENTS, beakerId, flaskId } from "./stage3.js";
import { MASS_POLICIES } from "./elements.js";

const f3 = (x) => fmtSig(x, 3);
const vq = (scene, vid, key) => findVessel(scene, vid)?.contents[key] ?? 0;
const stationIds = (kind) => (kind === "compare" ? ["A", "B"] : ["A"]);

export const PHASES3 = Object.freeze(["weigh", "water", "pourWater", "open", "pour", "stir", "transfer", "mark", "done"]);

/** What the student should do next at one beaker, and why. */
function phaseOf(scene, x) {
  const d = scene.data; const s = scene.data.stations[x]; const p = findPacket(scene, s.packetId); const aq = aqKeyOf(d.soluteId);
  const solid = vq(scene, beakerId(x), d.soluteId); const dissolved = vq(scene, beakerId(x), aq); const inFlask = vq(scene, flaskId(x), aq);
  if (s.atMark) return "done";
  if (inFlask > 0) return "mark";
  if (dissolved > 0 && solid === 0) return "transfer";
  if (solid > 0) return "stir";
  if (!p || s.weighedQ <= 0) return "weigh";
  if (p.q > 0 && s.waterMl > 0) return p.open ? "pour" : "open";
  if (s.cylMl > 0) return "pourWater";
  return "water";
}
const NEXT = {
  weigh: "Weigh some solute: enter a mass above 0 g.",
  water: "Measure some water in the cylinder (about 60 % of the flask volume), then pour it into the beaker.",
  pourWater: "Pour the measured water from the cylinder into the beaker.",
  open: "Open the zipper of the packet.",
  pour: "Drag the open packet to the beaker (or press Pour) so the solid falls into the water.",
  stir: "Stir until the solid has dissolved.",
  transfer: "Transfer the dissolved solution into the volumetric flask.",
  mark: "Make the solution up to the calibration mark with water.",
  done: "Made up to the mark: the volume is now exactly the calibrated volume, so the concentration is defined.",
};

function stationView(scene, x, policy) {
  const d = scene.data; const s = d.stations[x]; const sol = getSolute(d.soluteId); const aq = aqKeyOf(d.soluteId);
  const M = molarMass(d.soluteId, d.policy);
  const p = findPacket(scene, s.packetId);
  const solidQ = vq(scene, beakerId(x), d.soluteId); const dissolvedQ = vq(scene, beakerId(x), aq); const flaskQ = vq(scene, flaskId(x), aq);
  const phase = phaseOf(scene, x); const n = fromQuanta(s.weighedQ);
  const cRes = s.atMark ? concentration(fromQuanta(flaskQ), s.flaskMl) : null;
  const c = cRes?.ok ? cRes.c : null;
  const nFlask = fromQuanta(flaskQ);
  const working = c == null ? [] : [
    `n = m ÷ M = ${f3(s.massG)} g ÷ ${fmtSig(M, 4)} g mol⁻¹ = ${f3(n)} mol`,
    `V = ${fmtMl(s.flaskMl)} mL = ${f3(mlToDm3(s.flaskMl))} dm³ (the flask's calibrated volume)`,
    `c = n ÷ V = ${f3(nFlask)} mol ÷ ${f3(mlToDm3(s.flaskMl))} dm³ = ${f3(c)} mol dm⁻³`,
  ];
  const panMassG = clean(((p?.q ?? 0) / 1e9) * M);
  const water = s.waterMl; const massSolidG = (solidQ + dissolvedQ) / 1e9 * M;
  const ub = (solidQ + dissolvedQ) > 0 ? volumeUpperBoundMl(d.soluteId, water, massSolidG) : water;
  return {
    id: x, phase, next: NEXT[phase], soluteId: d.soluteId,
    exact: { massG: s.massG, weighedQ: s.weighedQ, n, packetQ: p?.q ?? 0, solidQ, dissolvedQ, flaskQ, waterMl: water, cylMl: s.cylMl, liquidMl: s.liquidMl, flaskMl: s.flaskMl, atMark: s.atMark, c, topUpMl: s.topUpMl, M, stirs: s.stirs },
    text: {
      mass: s.massG == null ? "–" : `${f3(s.massG)} g`, amount: `${f3(n)} mol`, packetAmount: `${f3((p?.q ?? 0) / 1e9)} mol`, molarMass: `${fmtSig(M, 4)} g mol⁻¹`,
      flask: `${fmtMl(s.flaskMl)} mL`, water: `${fmtMl(water)} mL`, liquid: `${fmtMl(s.liquidMl)} mL`, conc: c == null ? "–" : `${f3(c)} mol dm⁻³`,
      beakerVolume: `${fmtMl(water)} mL (beaker graduations are only about ±${GLASS.beaker.graduationErrorPct} %)`,
      upperBound: `${fmtMl(ub)} mL`, balance: `${fmtFixed(panMassG, 2)} g`, balanceNote: s.massG == null ? "" : `weighed ${f3(s.massG)} g`, massPan: `${f3(panMassG)} g`,
    },
    working, packet: p, suggestedWater: s.massG > 0 ? suggestedWaterMl(d.soluteId, s.massG, s.flaskMl) : null,
    flags: { canPour: Boolean(p?.open) && (p?.q ?? 0) > 0 && water > 0 && !s.atMark, hasSolidOrSolution: solidQ + dissolvedQ + flaskQ > 0, untouched: (p?.q ?? 0) === s.weighedQ && solidQ + dissolvedQ + flaskQ === 0 },
    sol,
  };
}

function dilutionView(scene) {
  const d = scene.data; const dil = d.dil; const aq = aqKeyOf(d.soluteId); const sol = getSolute(d.soluteId);
  const s = d.stations.A;
  const stockQ = vq(scene, "stock", aq); const cylQ = vq(scene, "aliquot", aq); const flaskQ = vq(scene, "flaskA", aq);
  const c1 = solutionConc({ nQ: dil.stockQ0, volumeMl: dil.stockVolMl0 });
  const plan = dilute({ nQ: dil.stockQ0, volumeMl: dil.stockVolMl0 }, dil.aliquotMl, dil.finalMl);
  const atMark = s.atMark; const c2 = atMark ? solutionConc({ nQ: flaskQ, volumeMl: s.flaskMl }) : null;
  let phase = "choose"; if (atMark) phase = "done"; else if (flaskQ > 0) phase = "mark"; else if (dil.taken) phase = "transfer"; else phase = "take";
  const NEXT4 = { take: "Choose the aliquot volume, then take it from the stock with the measuring cylinder.", transfer: "Pour the aliquot into the volumetric flask.", mark: "Make the diluted solution up to the calibration mark with water.", done: "Diluted to the mark: the amount of solute in the flask is the amount that travelled with the aliquot." };
  const n1 = plan.ok ? plan.nAliquotMol : null;
  const working = [];
  if (plan.ok) {
    working.push(`c₁ = n ÷ V = ${f3(fromQuanta(dil.stockQ0))} mol ÷ ${f3(mlToDm3(dil.stockVolMl0))} dm³ = ${f3(c1)} mol dm⁻³ (the stock)`);
    working.push(`n(aliquot) = c₁ × V₁ = ${f3(c1)} mol dm⁻³ × ${f3(mlToDm3(dil.aliquotMl))} dm³ = ${f3(n1)} mol  (only this much goes into the flask)`);
    working.push(`The stock keeps ${f3(fromQuanta(dil.stockQ0 - plan.nAliquotQ))} mol in ${fmtMl(plan.stockAfter.volumeMl)} mL: its concentration is still ${f3(c1)} mol dm⁻³`);
    working.push(`c₂ = n ÷ V₂ = ${f3(n1)} mol ÷ ${f3(mlToDm3(dil.finalMl))} dm³ = ${f3(plan.c2)} mol dm⁻³`);
    working.push(`Check: c₁V₁ = ${f3(c1)} × ${fmtMl(dil.aliquotMl)} = ${f3(c1 * dil.aliquotMl)} mmol and c₂V₂ = ${f3(plan.c2)} × ${fmtMl(dil.finalMl)} = ${f3(plan.c2 * dil.finalMl)} mmol (dilution factor ${f3(plan.dilutionFactor)})`);
  }
  void amountFromConcentration;
  return {
    phase, next: NEXT4[phase], plan: plan.ok ? plan : null, planError: plan.ok ? null : plan.error, working, sol,
    exact: { c1, c2, cylMl: dil.cylMl, stockQ, cylQ, flaskQ, stockQ0: dil.stockQ0, stockVolMl: dil.stockVolMl, aliquotMl: dil.aliquotMl, finalMl: dil.finalMl, taken: dil.taken, aliquotQ: dil.aliquotQ, atMark, nAliquotMol: n1, dilutionFactor: plan.ok ? plan.dilutionFactor : null, c2Planned: plan.ok ? plan.c2 : null },
    text: { c1: `${f3(c1)} mol dm⁻³`, c2: c2 == null ? "–" : `${f3(c2)} mol dm⁻³`, c2Planned: plan.ok ? `${f3(plan.c2)} mol dm⁻³` : "–", aliquot: `${fmtMl(dil.aliquotMl)} mL`, final: `${fmtMl(dil.finalMl)} mL`, stockVol: `${fmtMl(dil.stockVolMl)} mL`, stockAmount: `${f3(fromQuanta(stockQ))} mol`, aliquotAmount: `${f3(fromQuanta(dil.taken ? dil.aliquotQ : (plan.ok ? plan.nAliquotQ : 0)))} mol`, source: dil.source },
  };
}

/** Particle-viewer panes (the SAME scale in every pane): one per solution on show. */
function panesFor(scene, stations, dv) {
  const d = scene.data; const sol = getSolute(d.soluteId); const panes = [];
  const mk = (key, label, cExact, { approx = false, state = "solution", solidFraction = 0, note = "" } = {}) => ({
    key, label, state, approx, solidFraction, note, c: cExact, units: cExact == null ? 0 : formulaUnitsInWindow(cExact), drawn: cExact == null ? 0 : drawnPairs(cExact),
    unitsText: cExact == null ? "–" : (formulaUnitsInWindow(cExact) < 0.05 ? "< 0.1" : fmtSig(formulaUnitsInWindow(cExact), 3)), cText: cExact == null ? "not defined yet" : `${f3(cExact)} mol dm⁻³`, ions: sol.ions,
  });
  if (d.kind === "dilution") {
    panes.push(mk("stock", "Stock", dv.exact.c1));
    if (dv.exact.atMark) panes.push(mk("diluted", "Diluted", dv.exact.c2));
    else panes.push(mk("diluted", "Diluted", null, { state: "empty", note: "Not made up to the mark yet" }));
    return panes;
  }
  for (const st of stations) {
    const e = st.exact; const label = stations.length > 1 ? `Beaker ${st.id}` : "Your solution";
    if (e.atMark) panes.push(mk(st.id, label, e.c));
    else if (e.flaskQ > 0) panes.push(mk(st.id, label, e.liquidMl > 0 ? fromQuanta(e.flaskQ) / mlToDm3(e.liquidMl) : null, { approx: true, note: "Approximate: not yet made up to the mark" }));
    else if (e.solidQ + e.dissolvedQ > 0 && e.waterMl > 0) {
      const tot = e.solidQ + e.dissolvedQ; panes.push(mk(st.id, label, fromQuanta(tot) / mlToDm3(e.waterMl), { approx: true, state: e.solidQ > 0 ? "dissolving" : "solution", solidFraction: e.solidQ / tot, note: "Approximate: volume in the beaker is not exact" }));
    } else panes.push(mk(st.id, label, null, { state: "empty", note: "No solute dissolved yet" }));
  }
  if (d.exp === 2) { // Experiment 2 is compared with Experiment 1 on the same scale
    const ref = experimentDef(1).A; const M = molarMass(d.soluteId, d.policy); const c = concentration(ref.massG / M, ref.flaskMl);
    if (c.ok) panes.push(mk("ref", "Experiment 1 (reference)", c.c, { note: `${f3(ref.massG)} g in ${ref.flaskMl} mL` }));
  }
  return panes;
}

export function stage3View(state) {
  const scene = state.scenes[3]; const d = scene.data; const def = experimentDef(d.exp);
  const sol = getSolute(d.soluteId); const ids = stationIds(d.kind);
  const stations = d.kind === "dilution" ? [] : ids.map((x) => stationView(scene, x, state.policy));
  const dv = d.kind === "dilution" ? dilutionView(scene) : null;
  const panes = panesFor(scene, stations, dv);
  const M = molarMass(d.soluteId, d.policy);
  const policyMismatch = d.policy !== state.policy;
  const cmp = d.kind === "compare" && stations.every((s) => s.exact.c != null) ? (() => {
    const [a, b] = stations; return { ratio: a.exact.c > 0 ? b.exact.c / a.exact.c : null, sameN: a.exact.weighedQ === b.exact.weighedQ, sameC: Math.abs(a.exact.c - b.exact.c) < 1e-9 * Math.max(a.exact.c, b.exact.c), sameV: a.exact.flaskMl === b.exact.flaskMl };
  })() : null;
  return {
    exp: d.exp, kind: d.kind, def, experiments: STAGE3_EXPERIMENTS, soluteId: d.soluteId, solute: sol, stations, dil: dv, panes, M, cmp,
    scale: { windowNm: WINDOW_NM, text: `${WINDOW_NM} nm × ${WINDOW_NM} nm × ${WINDOW_NM} nm window (volume ${WINDOW_NM ** 3} nm³): the same in every view` },
    flags: { policyMismatch, lockMass: d.lockMass, hasPrepared: Boolean(d.prepared && d.prepared.soluteId === d.soluteId) },
    text: { molarMass: `${fmtSig(M, 4)} g mol⁻¹`, policy: MASS_POLICIES[d.policy].label, equation: sol.equation, thermal: sol.note },
    predictions: d.predictions, applied: d.applied,
  };
}
export { GLASS };
