// STAGES 5 and 6 -- the REACTION BENCH: one engine behind "Chemical Equations" (stage 5) and "Limiting Reagents" (stage 6).
//
//   scene.packets  role "stock" (reactants not yet in the zone), "leftover" (excess after a run), "product" (formed)
//   scene.vessels  one vessel "zone": contents { reactantId: quanta }  -- what is IN the reaction zone
//   scene.data     { reactionId, initialQ, baseline {atoms, charge}, lastRun, ... }
//
// Chemistry rules:
//  * every amount is integer quanta; a run changes the zone by integer multiples of the coefficients (reactions.applyExtent), so atoms
//    and charge are conserved EXACTLY; `data.baseline` records the atom / charge ledger of the starting amounts and `invariants`
//    proves every later state still matches it (packets + zone);
//  * the run is ONE atomic reduction: the zone is reacted and emptied into product / leftover packets.  The 3D animation only READS
//    `data.lastRun` (before / extent / after), so an interrupted or skipped animation can never change an amount;
//  * a wrong ratio is not an error: the limiting reagent runs out, the rest is reported as excess (a PARTIAL reaction, honestly explained).
//    A missing reactant is refused with an explanation (extent 0).
import { decompose } from "./packets.js";
import { fromQuanta, toQuanta, parseNumberInput, fmtMol } from "./numeric.js";
import { REACTION_LIST, getReaction, reactants, products, atomLedger, chargeLedger, applyExtent } from "./reactions.js";
import { limitingReagent } from "./limiting.js";
import { molesFromMass, massFromMoles } from "./moles.js";
import { getSubstance, molarMass } from "./substances.js";
import { toUnicodeFormula } from "./formula.js";

export const S5_MAX_MOL = 6;
export const S6_MAX_MOL = 100;
export const STAGE5_SCALES = Object.freeze([0.5, 1, 2]);
export const STAGE5_DEFAULT_REACTION = "water-synthesis";
/** Stage 6 starting examples (spec D Stage 6 and the sodium + water case). */
export const STAGE6_EXAMPLES = Object.freeze({
  "water-synthesis": { H2: 3, O2: 1 }, "ammonia-synthesis": { N2: 2, H2: 3 }, "magnesium-oxide": { Mg: 3, O2: 2 }, "sodium-water": { Na: 3, H2O: 2 },
  "methane-combustion": { CH4: 1, O2: 1 }, "iron-oxidation": { Fe: 4, O2: 2 }, "carbon-combustion": { C: 2, O2: 1 }, "carbon-monoxide-oxidation": { CO: 3, O2: 1 },
  "calcium-oxide": { Ca: 3, O2: 1 }, "aluminium-oxide": { Al: 4, O2: 2 },
});
const ok = (code, message, extra = {}) => ({ ok: true, code, message, ...extra });
const no = (code, message) => ({ ok: false, code, message });
const sumContents = (c) => Object.values(c).reduce((a, b) => a + b, 0);
const nameOf = (id) => toUnicodeFormula(getSubstance(id).formula);

/** Amounts (quanta) of a stoichiometric set: coefficient x factor. */
export const stoichAmountsQ = (reaction, factor = 1) => Object.fromEntries(reactants(reaction).map((s) => [s.id, toQuanta(s.coeff * factor)]));
export const defaultAmountsQ = (stage, reactionId) => {
  const r = getReaction(reactionId);
  if (stage === 6) return Object.fromEntries(Object.entries(STAGE6_EXAMPLES[reactionId]).map(([k, v]) => [k, toQuanta(v)]));
  return stoichAmountsQ(r, 1);
};

function ledgerOf(scene) {
  const t = {};
  for (const p of scene.packets) t[p.substanceId] = (t[p.substanceId] || 0) + p.q;
  for (const v of scene.vessels) for (const [id, q] of Object.entries(v.contents)) t[id] = (t[id] || 0) + q;
  return t;
}
const sameLedger = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) if ((a[k] || 0) !== (b[k] || 0)) return false; return true; };

function packetsOf(scene0, substanceId, q, role) {
  let nextId = scene0; const out = [];
  for (const pq of decompose(q).packetsQ) out.push({ id: `p${nextId++}`, substanceId, q: pq, open: false, role });
  return { nextId, packets: out };
}

/** A fresh experiment: stock packets for the starting amounts, an empty zone, a new baseline.  Used by create, setup, rebuild. */
export function createBenchScene(stage, reactionId, amountsQ, keepData = {}) {
  const r = getReaction(reactionId); let nextId = 1; const packets = [];
  for (const s of reactants(r)) {
    const q = amountsQ[s.id] ?? 0;
    if (q === 0) { packets.push({ id: `p${nextId++}`, substanceId: s.id, q: 0, open: false, role: "stock" }); continue; }
    const res = packetsOf(nextId, s.id, q, "stock"); nextId = res.nextId; packets.push(...res.packets);
  }
  const initialQ = Object.fromEntries(reactants(r).map((s) => [s.id, amountsQ[s.id] ?? 0]));
  return {
    stage, packets, nextId, vessels: [{ id: "zone", kind: "reaction-zone", accepts: reactants(r).map((s) => s.id), capacityQ: null, contents: {} }],
    data: { reactionId, initialQ, baseline: { atoms: atomLedger(initialQ), charge: chargeLedger(initialQ) }, lastRun: null, runCount: 0, error: null, predictions: {}, inputMode: "mol", lastInput: {}, actual: "", ...keepData },
  };
}
export const createStage5Scene = (reactionId = STAGE5_DEFAULT_REACTION) => createBenchScene(5, reactionId, defaultAmountsQ(5, reactionId));
export const createStage6Scene = (reactionId = STAGE5_DEFAULT_REACTION) => createBenchScene(6, reactionId, defaultAmountsQ(6, reactionId));

/** Honest, concise feedback about the ratio the student supplied versus the balanced equation. */
export function ratioFeedback(reaction, beforeQ, lim) {
  const rs = reactants(reaction); const eq = rs.map((s) => s.coeff).join(" : ");
  if (lim.noReaction) { const absent = lim.perReactant.filter((p) => p.availableQ === 0).map((p) => nameOf(p.id)); return { kind: "none", text: `No ${absent.join(" or ")} is present, so nothing can react: the extent of reaction is 0.` }; }
  if (lim.stoichiometric) return { kind: "exact", text: `The amounts are exactly in the ratio ${eq} from the equation, so every reactant is used up.` };
  const lims = lim.perReactant.filter((p) => p.limiting).map((p) => nameOf(p.id)); const ex = lim.perReactant.filter((p) => p.excess);
  const given = rs.map((s) => fmtMol(fromQuanta(beforeQ[s.id] || 0))).join(" : ");
  const tail = ex.map((p) => `${fmtMol(p.remaining)} mol ${nameOf(p.id)} is left over`).join(" and ");
  return { kind: "excess", text: `The equation needs ${eq}, you supplied ${given} (mol). ${lims.join(" and ")} limits the reaction, so only part of the other reactant reacts (a partial reaction): ${tail}.` };
}

function runReaction(scene, { autoLoad }) {
  const d = scene.data; const r = getReaction(d.reactionId);
  const zone = scene.vessels.find((v) => v.id === "zone"); const contents = { ...zone.contents };
  let packets = scene.packets;
  if (autoLoad) {
    for (const p of scene.packets) if (zone.accepts.includes(p.substanceId) && p.q > 0 && p.role !== "product") contents[p.substanceId] = (contents[p.substanceId] || 0) + p.q;
    packets = scene.packets.filter((p) => !(zone.accepts.includes(p.substanceId) && p.role !== "product"));
  }
  if (sumContents(contents) === 0) return { scene, notice: no("zone-empty", autoLoad ? "There is nothing to react: set an amount of each reactant." : "The reaction zone is empty: drag the reactant packets into it first (or use “Add to the zone”).") };
  const lim = limitingReagent(r, Object.fromEntries(reactants(r).map((s) => [s.id, contents[s.id] ?? 0])));
  const fb = ratioFeedback(r, contents, lim);
  if (lim.noReaction) return { scene, notice: no("no-reaction", fb.text) };
  const after = applyExtent(r, contents, lim.extentQ);
  let nextId = scene.nextId; const made = [];
  const add = (id, q, role) => { if (q <= 0) return; const res = packetsOf(nextId, id, q, role); nextId = res.nextId; made.push(...res.packets); };
  for (const s of products(r)) add(s.id, after[s.id] ?? 0, "product");
  for (const s of reactants(r)) add(s.id, after[s.id] ?? 0, "leftover");
  const lastRun = {
    id: d.runCount + 1, reactionId: d.reactionId, beforeQ: contents, extentQ: lim.extentQ, afterQ: after, limiting: lim.limiting, tied: lim.tied, stoichiometric: lim.stoichiometric,
    partial: !lim.stoichiometric, feedback: fb,
  };
  return {
    scene: { ...scene, nextId, packets: [...packets, ...made],
      vessels: scene.vessels.map((v) => (v.id === "zone" ? { ...v, contents: {} } : v)), data: { ...d, lastRun, runCount: d.runCount + 1, error: null } },
    notice: ok("reacted", `${fb.text}`, { extentQ: lim.extentQ }),
  };
}

/** Stage 5 and 6 share this reducer; `p` is the action prefix ("s5" / "s6"). */
export function reduceBench(scene, action, ctx, p) {
  const d = scene.data; const stage = scene.stage; const r = getReaction(d.reactionId); const policy = ctx?.policy ?? "booklet";
  const maxMol = stage === 6 ? S6_MAX_MOL : S5_MAX_MOL; const t = (x) => `${p}/${x}`;
  const rebuild = (reactionId, amountsQ, extra = {}) => createBenchScene(stage, reactionId, amountsQ, { inputMode: d.inputMode, actual: "", ...extra });
  switch (action.type) {
    case t("selectReaction"): {
      if (!REACTION_LIST.some((x) => x.id === action.reactionId)) return { scene, notice: no("unknown-reaction", "That reaction is not available.") };
      if (action.reactionId === d.reactionId) return { scene, notice: ok("same", "Already selected.") };
      return { scene: rebuild(action.reactionId, defaultAmountsQ(stage, action.reactionId), { runCount: d.runCount }), notice: ok("selected", `${getReaction(action.reactionId).name} selected.`) };
    }
    case t("setScale"): {
      if (stage !== 5) return null;
      const f = Number(action.factor);
      if (!STAGE5_SCALES.includes(f)) return { scene, notice: no("bad-scale", "Choose one of the offered scales.") };
      const q = stoichAmountsQ(r, f); if (Object.values(q).some((x) => x > S5_MAX_MOL * 1e9)) return { scene, notice: no("too-big", `That needs more than ${S5_MAX_MOL} mol of a reactant.`) };
      return { scene: rebuild(d.reactionId, q, { runCount: d.runCount, scale: f }), notice: ok("scaled", `Starting amounts scaled by ×${f}: the ratio stays the same.`) };
    }
    case t("setAmount"): {
      const s = reactants(r).find((x) => x.id === action.substanceId); if (!s) return { scene, notice: no("unknown-substance", "That is not a reactant of this reaction.") };
      const pr = parseNumberInput(action.value, { max: maxMol, label: "Amount" });
      if (!pr.ok) return { scene: { ...scene, data: { ...d, error: `${nameOf(s.id)}: ${pr.error}` } }, notice: no("invalid-input", pr.error) };
      const amounts = { ...d.initialQ, [s.id]: toQuanta(pr.value) };
      return { scene: rebuild(d.reactionId, amounts, { runCount: d.runCount, lastInput: { ...d.lastInput, [s.id]: { kind: "moles", value: pr.value } } }), notice: ok("amount", `${nameOf(s.id)} set to ${fmtMol(pr.value)} mol; the experiment was set up again from these amounts.`) };
    }
    case t("setMass"): {
      if (stage !== 6) return null;
      const s = reactants(r).find((x) => x.id === action.substanceId); if (!s) return { scene, notice: no("unknown-substance", "That is not a reactant of this reaction.") };
      const pr = parseNumberInput(action.value, { label: "Mass" });
      if (!pr.ok) return { scene: { ...scene, data: { ...d, error: `${nameOf(s.id)}: ${pr.error}` } }, notice: no("invalid-input", pr.error) };
      const mm = molesFromMass(pr.value, molarMass(s.id, policy));
      if (!mm.ok) return { scene: { ...scene, data: { ...d, error: `${nameOf(s.id)}: ${mm.error}` } }, notice: no("invalid-input", mm.error) };
      if (mm.n > S6_MAX_MOL) { const m = `That is more than ${S6_MAX_MOL} mol of ${nameOf(s.id)}.`; return { scene: { ...scene, data: { ...d, error: m } }, notice: no("too-big", m) }; }
      const amounts = { ...d.initialQ, [s.id]: mm.nQ };
      return { scene: rebuild(d.reactionId, amounts, { runCount: d.runCount, lastInput: { ...d.lastInput, [s.id]: { kind: "mass", value: pr.value } } }), notice: ok("mass", `${nameOf(s.id)}: ${pr.value} g = ${fmtMol(mm.n)} mol.`) };
    }
    case t("policyChanged"): { // the same typed MASSES are re-applied under the new molar masses (visibly, never silently)
      const amounts = { ...d.initialQ }; let changed = false;
      for (const [id, inp] of Object.entries(d.lastInput)) if (inp.kind === "mass" && amounts[id] !== undefined) { const mm = molesFromMass(inp.value, molarMass(id, policy)); if (mm.ok && mm.n <= S6_MAX_MOL) { amounts[id] = mm.nQ; changed = true; } }
      if (!changed) return { scene, notice: ok("nothing", "No typed masses to re-apply.") };
      return { scene: rebuild(d.reactionId, amounts, { runCount: d.runCount, lastInput: d.lastInput }), notice: ok("policy", "Molar-mass values changed; your typed masses were re-applied.") };
    }
    case t("setInputMode"): { if (action.mode !== "mol" && action.mode !== "mass") return { scene, notice: no("bad-mode", "Unknown input mode.") }; return { scene: { ...scene, data: { ...d, inputMode: action.mode, error: null } }, notice: ok("input-mode", action.mode === "mass" ? "Enter reactant masses (g)." : "Enter reactant amounts (mol).") }; }
    case t("again"): return { scene: rebuild(d.reactionId, d.initialQ, { runCount: d.runCount, lastInput: d.lastInput, scale: d.scale }), notice: ok("again", "Set up again with the same starting amounts.") };
    case t("loadAll"): { // accessible alternative to dragging every packet: pour every reactant packet into the zone in one atomic step
      const zone = scene.vessels.find((v) => v.id === "zone"); const contents = { ...zone.contents }; let moved = 0;
      for (const pk of scene.packets) if (zone.accepts.includes(pk.substanceId) && pk.q > 0 && pk.role !== "product") { contents[pk.substanceId] = (contents[pk.substanceId] || 0) + pk.q; moved += pk.q; }
      if (!moved) return { scene, notice: no("nothing-to-load", "There are no reactant packets left to add.") };
      const packets = scene.packets.filter((pk) => !(zone.accepts.includes(pk.substanceId) && pk.role !== "product"));
      return { scene: { ...scene, packets, vessels: scene.vessels.map((v) => (v.id === "zone" ? { ...v, contents } : v)) }, notice: ok("loaded", `${fmtMol(fromQuanta(moved))} mol of reactants added to the zone.`, { movedQ: moved }) };
    }
    case t("unload"): { // take everything back out of the zone into packets (nothing is lost)
      const zone = scene.vessels.find((v) => v.id === "zone"); const total = sumContents(zone.contents);
      if (!total) return { scene, notice: no("zone-empty", "The reaction zone is already empty.") };
      let nextId = scene.nextId; const made = [];
      for (const s of reactants(r)) { const q = zone.contents[s.id] ?? 0; if (q > 0) { const res = packetsOf(nextId, s.id, q, "stock"); nextId = res.nextId; made.push(...res.packets); } }
      return { scene: { ...scene, nextId, packets: [...scene.packets, ...made], vessels: scene.vessels.map((v) => (v.id === "zone" ? { ...v, contents: {} } : v)) }, notice: ok("unloaded", "Reactants taken out of the zone and returned to packets.") };
    }
    case t("run"): return runReaction(scene, { autoLoad: stage === 6 });
    case "s6/setActual": { if (stage !== 6) return null; return { scene: { ...scene, data: { ...d, actual: String(action.value ?? "") } }, notice: ok("actual", "Actual yield noted.") }; }
    case "guide/answer": return { scene: { ...scene, data: { ...d, predictions: { ...d.predictions, [action.key]: { choice: action.choice, correct: Boolean(action.correct) } } } }, notice: ok("answered", action.correct ? "Correct." : "Not quite.") };
    default: return null;
  }
}
export const reduceStage5 = (scene, action, ctx) => reduceBench(scene, action, ctx, "s5");
export const reduceStage6 = (scene, action, ctx) => reduceBench(scene, action, ctx, "s6");

export function invariantsBench(scene) {
  const out = []; const d = scene.data; if (!d || !d.reactionId) return out; // a generic vessel scene (not built by createBenchScene) has no reaction to check
  const r = getReaction(d.reactionId); const ids = new Set(r.species.map((s) => s.id));
  const led = ledgerOf(scene);
  for (const id of Object.keys(led)) if (!ids.has(id)) out.push(`stage${scene.stage}: substance ${id} is not part of ${d.reactionId}`);
  if (!sameLedger(atomLedger(led), d.baseline.atoms)) out.push(`stage${scene.stage}: atoms are not conserved (ledger ${JSON.stringify(atomLedger(led))} vs ${JSON.stringify(d.baseline.atoms)})`);
  if (chargeLedger(led) !== d.baseline.charge) out.push(`stage${scene.stage}: charge is not conserved`);
  const zone = scene.vessels.find((v) => v.id === "zone");
  for (const id of Object.keys(zone.contents)) if (!zone.accepts.includes(id)) out.push(`stage${scene.stage}: zone holds a non-reactant (${id})`);
  for (const pk of scene.packets) { if (pk.role === "product" && !products(r).some((x) => x.id === pk.substanceId)) out.push(`stage${scene.stage}: product packet of a reactant`); }
  return out;
}
export const invariantsStage5 = invariantsBench; export const invariantsStage6 = invariantsBench;
export { massFromMoles };
