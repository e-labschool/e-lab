// THE ONE AUTHORITATIVE EXPERIMENT STATE (spec E).  A deterministic, pure reducer:  (state, action) -> state.
//
//   state = {
//     version, stage (1..6), mode ("guided" | "free"), policy ("teaching" | "precise"),
//     scenes: { [stage]: scene },     // EACH stage owns its own scene: switching stages never carries material across
//     last: { ok, code, message, type } // outcome of the most recent action (for the UI status line)
//   }
//   scene = { stage, packets: [{ id, substanceId, q, open, role }], vessels: [...], nextId, data: {...stage data} }
//
// Rules:
//  * all amounts are INTEGER QUANTA (1e-9 mol, see numeric.js); display strings are produced by selectors.js only;
//  * a rejected action returns the same scene (plus `last.ok === false`), so repeated / rapid / invalid actions can never
//    duplicate or destroy material;
//  * animations and the 3D view READ this state and can never write it: an interrupted animation cannot corrupt chemistry;
//  * `checkInvariants(state)` returns [] when everything is consistent; the tests call it after every action.
//
// Phase-2 stages register themselves with registerStage({ stage, create, reduce, invariants }) -- see docs/MOLE_LAB.md.
import { PACKET_CAPACITY_Q } from "./packets.js";
import { DEFAULT_POLICY, MASS_POLICIES } from "./elements.js";
import { getSubstance } from "./substances.js";
import * as ops from "./packetOps.js";
import { createStage1Scene, reduceStage1, invariantsStage1 } from "./stage1.js";
import { createStage2Scene, reduceStage2, invariantsStage2 } from "./stage2.js";
import { createStage3Scene, reduceStage3, invariantsStage3 } from "./stage3.js";
import { createStage4Scene, reduceStage4, invariantsStage4 } from "./stage4.js";
import { createStage5Scene, reduceStage5, invariantsStage5, createStage6Scene, reduceStage6, invariantsStage6 } from "./reactionBench.js";

export const STATE_VERSION = 1;
export const STAGE_IDS = Object.freeze([1, 2, 3, 4, 5, 6]);

/** Stage registry: { create(ctx) -> scene, reduce(scene, action, ctx) -> {scene, notice} | null, invariants(scene, ctx) -> string[] }. */
const REGISTRY = new Map();
export function registerStage(def) { REGISTRY.set(def.stage, def); }
export const isStageBuilt = (stage) => REGISTRY.has(stage);
registerStage({ stage: 1, create: () => createStage1Scene(), reduce: reduceStage1, invariants: invariantsStage1 });
registerStage({ stage: 2, create: (ctx) => createStage2Scene(ctx.policy), reduce: reduceStage2, invariants: invariantsStage2 });
registerStage({ stage: 3, create: (ctx) => createStage3Scene(ctx.policy), reduce: reduceStage3, invariants: invariantsStage3 });
registerStage({ stage: 4, create: () => createStage4Scene(), reduce: reduceStage4, invariants: invariantsStage4 });
registerStage({ stage: 5, create: () => createStage5Scene(), reduce: reduceStage5, invariants: invariantsStage5 });
registerStage({ stage: 6, create: () => createStage6Scene(), reduce: reduceStage6, invariants: invariantsStage6 });

/** Placeholder scene for a stage that has no engine registered yet (phase 2 replaces it by registering the stage). */
const emptyScene = (stage) => ({ stage, packets: [], vessels: [], nextId: 1, data: { pending: true } });
const createScene = (stage, ctx) => (REGISTRY.get(stage)?.create(ctx) ?? emptyScene(stage));

export function createInitialState({ stage = 1, mode = "guided", policy = DEFAULT_POLICY } = {}) {
  const ctx = { policy };
  const scenes = {}; for (const s of STAGE_IDS) scenes[s] = createScene(s, ctx);
  return { version: STATE_VERSION, stage, mode, policy, scenes, last: { ok: true, code: "init", message: "", type: "init" } };
}

const withLast = (state, type, notice) => ({ ...state, last: { ok: notice.ok, code: notice.code, message: notice.message, type } });

const GENERIC = {
  "packet/open": (sc, a) => ops.openPacket(sc, a.id),
  "packet/close": (sc, a) => ops.closePacket(sc, a.id),
  "packet/split": (sc, a) => ops.splitPacket(sc, a.id, a.q ?? null),
  "packet/combine": (sc, a) => ops.combinePackets(sc, a.aId, a.bId),
  "packet/compact": (sc, a) => ops.compactPackets(sc, a.substanceId),
  "packet/pour": (sc, a) => ops.pourPacket(sc, a.sourceId, a.destId, a.q ?? null),
  "vessel/react": (sc, a) => ops.reactVessel(sc, a.vesselId, a.reactionId, a.extentQ ?? null),
};

export function reduce(state, action) {
  const type = action?.type;
  switch (type) {
    case "stage/set": {
      if (!STAGE_IDS.includes(action.stage)) return withLast(state, type, { ok: false, code: "bad-stage", message: "Unknown stage." });
      return { ...state, stage: action.stage, last: { ok: true, code: "stage", message: "", type } };
    }
    case "mode/set": {
      if (action.mode !== "guided" && action.mode !== "free") return withLast(state, type, { ok: false, code: "bad-mode", message: "Unknown mode." });
      return { ...state, mode: action.mode, last: { ok: true, code: "mode", message: "", type } };
    }
    case "policy/set": {
      if (!MASS_POLICIES[action.policy]) return withLast(state, type, { ok: false, code: "bad-policy", message: "Unknown molar-mass policy." });
      if (action.policy === state.policy) return state;
      let next = { ...state, policy: action.policy };
      // explicit, visible re-application of each stage's last input -- never a silent mix of values
      const r = REGISTRY.get(2)?.reduce(next.scenes[2], { type: "s2/policyChanged" }, { policy: action.policy });
      if (r?.scene) next = { ...next, scenes: { ...next.scenes, 2: r.scene } };
      const r6 = REGISTRY.get(6)?.reduce(next.scenes[6], { type: "s6/policyChanged" }, { policy: action.policy }); // stage 6: typed reactant masses (Stage 4-6 build)
      if (r6?.scene) next = { ...next, scenes: { ...next.scenes, 6: r6.scene } };
      return { ...next, last: { ok: true, code: "policy", message: `Molar masses now use ${MASS_POLICIES[action.policy].short}.`, type } };
    }
    case "reset": {
      const which = action.stage ?? state.stage; const ctx = { policy: state.policy };
      if (which === "all") { const s = createInitialState({ stage: state.stage, mode: state.mode, policy: state.policy }); return { ...s, last: { ok: true, code: "reset", message: "Everything was reset.", type } }; }
      return { ...state, scenes: { ...state.scenes, [which]: createScene(which, ctx) }, last: { ok: true, code: "reset", message: "Reset to the starting state.", type } };
    }
    default: break;
  }
  const stage = action?.stage ?? state.stage;
  const scene = state.scenes[stage];
  if (!scene) return withLast(state, String(type), { ok: false, code: "bad-stage", message: "Unknown stage." });
  const ctx = { policy: state.policy, mode: state.mode };
  let res = null;
  if (GENERIC[type]) res = GENERIC[type](scene, action);
  else { const def = REGISTRY.get(stage); res = def ? def.reduce(scene, action, ctx) : null; }
  if (!res) return withLast(state, String(type), { ok: false, code: "unknown-action", message: `Unknown action ${type}.` });
  if (res.scene === scene) return withLast(state, type, res.notice);
  return { ...state, scenes: { ...state.scenes, [stage]: res.scene }, last: { ok: res.notice.ok, code: res.notice.code, message: res.notice.message, type, ...(res.notice.newId ? { newId: res.notice.newId } : {}), ...(res.notice.movedQ != null ? { movedQ: res.notice.movedQ } : {}) } };
}

/** Per-substance totals (integer quanta) over packets and vessels of ONE scene: the conservation ledger. */
export function sceneLedger(scene) {
  const out = {};
  for (const p of scene.packets) out[p.substanceId] = (out[p.substanceId] || 0) + p.q;
  for (const v of scene.vessels ?? []) for (const [id, q] of Object.entries(v.contents)) out[id] = (out[id] || 0) + q;
  return out;
}

/** [] when the state is internally consistent; otherwise human-readable violations. */
export function checkInvariants(state) {
  const out = [];
  for (const [stage, scene] of Object.entries(state.scenes)) {
    const ids = new Set();
    for (const p of scene.packets) {
      if (ids.has(p.id)) out.push(`stage ${stage}: duplicate packet id ${p.id}`); ids.add(p.id);
      if (!Number.isInteger(p.q)) out.push(`stage ${stage}: ${p.id} amount is not an integer`);
      else if (p.q < 0 || p.q > PACKET_CAPACITY_Q) out.push(`stage ${stage}: ${p.id} holds ${p.q} quanta (limit ${PACKET_CAPACITY_Q})`);
      try { getSubstance(p.substanceId); } catch { out.push(`stage ${stage}: ${p.id} unknown substance`); }
    }
    for (const v of scene.vessels ?? []) for (const [id, q] of Object.entries(v.contents)) if (!Number.isInteger(q) || q < 0) out.push(`stage ${stage}: vessel ${v.id} ${id} invalid ${q}`);
    const def = REGISTRY.get(Number(stage)); if (def) out.push(...def.invariants(scene, { policy: state.policy }));
  }
  return out;
}

export const currentScene = (state) => state.scenes[state.stage];
