// THE ONE AUTHORITATIVE SIMULATION STATE for the Equilibrium Lab.  A deterministic, pure reducer: (state, action) -> state.
//
//   state = { version, mode: "everyday" | "chemical" | "compare", ui: {speed, simple, showGraph, showExplanation, showPop},
//             scenes: { everyday, chemical, compare }, last: { ok, code, message, type } }
//   scene = { kind, status: "idle"|"running"|"paused", started, t, seed, resets, setup, ev?: track, ch?: track, script, replay, visited, progress }
//   everyday track = { s: everyday.js state, hist, marks, phase, eqAt, before, info }
//   chemical track = { s: chem.js state, vis: visual.js state, hist, marks, phase, eqAt, before, info }
//
// Everything the screen shows (counters, rates, concentrations, graphs, indicators, particle counts) is derived from this state.
// Animations (buses, molecules) READ it and can never write it.  `checkInvariants(state)` returns [] when everything is consistent.
//
// Compare Both: one scene holding BOTH tracks on one clock.  The everyday passengers (100 people = 1.00 mol dm-3 of A) and the
// chemical A <=> B model use the same k_f and k_r, receive the same disturbances (1 person = 0.01 mol) and advance the same time.
import { REACTIONS, REACTION_IDS } from "./reactions.js";
import {
  createChem, advanceChem, chemSnapshot, addAmount, removeAmount, setTemperature, setCatalyst, setVolume, atomConservationError, solveEquilibrium,
} from "./chem.js";
import { createEveryday, advanceEveryday, changePeople, everydaySnapshot, PRESETS, PRESET_IDS, ADD_STEP, DEFAULT_SEED } from "./everyday.js";
import { createVisual, visualDisturbed, stepVisual, snapVisual } from "./visual.js";
import { catalystFactor } from "./thermo.js";

export const STATE_VERSION = 1;
export const MODES = Object.freeze(["everyday", "chemical", "compare"]);
export const MODE_LABELS = Object.freeze({ everyday: "Everyday Analogy", chemical: "Chemical Model", compare: "Compare Both" });
export const EVERYDAY_PLAYBACK = 0.5;     // time units per real second at 1x
export const PEOPLE_PER_MOL = 100;        // Compare Both: 100 people <-> 1.00 mol dm-3 of A at V = 1 dm3
export const MAX_SAMPLES = 1500;
export const STEP_REAL_SECONDS = 1;       // "Step Forward" advances one real second's worth of simulation time
export const SPEEDS = Object.freeze([0.5, 1, 2]);
export const MAX_PEOPLE = 400;            // soft cap so a student cannot make the passenger model unmanageably large

const clone = (o) => ({ ...o });
const ok = (type, code = type, message = "") => ({ ok: true, code, message, type });
const no = (type, code, message) => ({ ok: false, code, message, type });

// ---------- tracks ----------
const emptyEvHist = () => ({ t: [], A: [], B: [], rfDet: [], rrDet: [], rfMeas: [], rrMeas: [], detA: [], detB: [] });
const emptyChHist = (rx) => ({ t: [], rf: [], rr: [], Q: [], K: [], c: Object.fromEntries(rx.species.map((s) => [s.id, []])) });

function makeEvTrack(setup, seed, ABinit = { A: 100, B: 0 }) {
  const s = createEveryday({ preset: setup.preset, kf: setup.kf, kr: setup.kr, A: ABinit.A, B: ABinit.B, seed });
  const tr = { s, hist: emptyEvHist(), marks: [], phase: "initial", eqAt: null, before: null, info: null, sampleDt: 0.1, nextSample: 0 };
  return sampleEv(tr);
}
function makeChTrack(setup, seed) {
  const rx = REACTIONS[setup.reactionId];
  const s = createChem(setup.reactionId, { kfRef: setup.kfRef, krRef: setup.krRef });
  const tr = { s, vis: createVisual(s, seed ^ 0x9e37), hist: emptyChHist(rx), marks: [], phase: "initial", eqAt: null, before: null, info: null, sampleDt: 0.1 * rx.playback, nextSample: 0, simPerReal: rx.playback };
  return sampleCh(tr, 0);
}

function decimate(h) { const out = {}; for (const k of Object.keys(h)) out[k] = Array.isArray(h[k]) ? h[k].filter((_, i) => i % 2 === 0 || i === h[k].length - 1) : Object.fromEntries(Object.entries(h[k]).map(([id, a]) => [id, a.filter((_, i) => i % 2 === 0 || i === a.length - 1)])); return out; }

function sampleEv(tr, t = tr.s.t) {
  const sn = everydaySnapshot(tr.s); let h = tr.hist; let sampleDt = tr.sampleDt;
  if (h.t.length >= MAX_SAMPLES) { h = decimate(h); sampleDt *= 2; }
  const push = (a, v) => [...a, v];
  h = { t: push(h.t, t), A: push(h.A, sn.A), B: push(h.B, sn.B), rfDet: push(h.rfDet, sn.rfDet), rrDet: push(h.rrDet, sn.rrDet), rfMeas: push(h.rfMeas, sn.rfMeas), rrMeas: push(h.rrMeas, sn.rrMeas), detA: push(h.detA, sn.detA), detB: push(h.detB, sn.detB) };
  return { ...tr, hist: h, sampleDt, nextSample: (Math.floor(t / sampleDt + 1e-9) + 1) * sampleDt };
}
function sampleCh(tr, t) {
  const snap = chemSnapshot(tr.s); let h = tr.hist; let sampleDt = tr.sampleDt;
  if (h.t.length >= MAX_SAMPLES) { h = decimate(h); sampleDt *= 2; }
  const c = {}; for (const id of Object.keys(h.c)) c[id] = [...h.c[id], tr.s.c[id]];
  h = { t: [...h.t, t], rf: [...h.rf, snap.rf], rr: [...h.rr, snap.rr], Q: [...h.Q, Number.isFinite(snap.Q) ? snap.Q : null], K: [...h.K, snap.Kc], c };
  return { ...tr, hist: h, sampleDt, nextSample: (Math.floor(t / sampleDt + 1e-9) + 1) * sampleDt };
}

// ---------- scenes ----------
export const defaultSetup = (kind) => ({ preset: "towardsA", kf: PRESETS.towardsA.kf, kr: PRESETS.towardsA.kr, reactionId: "ab", kfRef: REACTIONS.ab.kinetics.kfRef, krRef: REACTIONS.ab.kinetics.krRef, kind });

export function createScene(kind, setup = defaultSetup(kind), baseSeed = DEFAULT_SEED, resets = 0) {
  const seed = baseSeed + resets * 7919;
  const sc = { kind, status: "idle", started: false, t: 0, seed, baseSeed, resets, setup, script: [], replay: null, visited: [visitKey(kind, setup)], progress: 1, ev: null, ch: null, disturbances: 0, usedConditions: false };
  if (kind === "everyday") sc.ev = makeEvTrack(setup, seed);
  else if (kind === "chemical") sc.ch = makeChTrack(setup, seed);
  else {
    const cs = { ...setup, reactionId: "ab", kfRef: setup.kf, krRef: setup.kr };
    sc.setup = cs; sc.ev = makeEvTrack(cs, seed); sc.ch = makeChTrack(cs, seed);
  }
  return sc;
}
const visitKey = (kind, setup) => (kind === "chemical" ? setup.reactionId + (setup.reactionId === "ab" ? `:${setup.kfRef}/${setup.krRef}` : "") : setup.preset ?? `${setup.kf}/${setup.kr}`);

export function createInitialState({ mode = "everyday", seed = DEFAULT_SEED } = {}) {
  return {
    version: STATE_VERSION, mode: MODES.includes(mode) ? mode : "everyday",
    ui: { speed: 1, simple: false, showGraph: true, showExplanation: true, showPop: false, fluct: false },
    scenes: { everyday: createScene("everyday", defaultSetup("everyday"), seed), chemical: createScene("chemical", defaultSetup("chemical"), seed + 1), compare: createScene("compare", defaultSetup("compare"), seed + 2) },
    last: ok("init"),
  };
}

// ---------- equilibrium bookkeeping ----------
function watchEquilibrium(tr, kind, t) {
  const snap = kind === "ev" ? everydaySnapshot(tr.s) : chemSnapshot(tr.s);
  const rf = kind === "ev" ? snap.rfDet : snap.rf; const rr = kind === "ev" ? snap.rrDet : snap.rr;
  let { phase, eqAt, marks } = tr;
  if (snap.status === "attained" && t > 0 && phase !== "attained") { phase = "attained"; eqAt = t; marks = [...marks, { t, kind: "eq", label: "Equilibrium" }]; }
  else if (snap.status !== "attained" && phase === "attained") { phase = tr.info ? "readjusting" : "initial"; eqAt = null; }
  else if (phase === "disturbed" && snap.status !== "attained" && t - (tr.info?.t ?? 0) > 0.6 * (tr.sampleDt / 0.1)) phase = "readjusting";
  void rf; void rr;
  return phase === tr.phase && eqAt === tr.eqAt && marks === tr.marks ? tr : { ...tr, phase, eqAt, marks };
}

// ---------- advancing ----------
function advanceTrack(sc, kind, dt) {
  const tr = sc[kind];
  if (kind === "ev") { const s = advanceEveryday(tr.s, dt); return { ...tr, s }; }
  const s = advanceChem(tr.s, dt);
  return { ...tr, s };
}
const nextSampleTime = (sc) => Math.min(...["ev", "ch"].filter((k) => sc[k]).map((k) => sc[k].nextSample));

function advanceScene(sc, dT) {
  if (!(dT > 0)) return sc;
  let cur = sc; const target = sc.t + dT; let guard = 0;
  while (cur.t < target - 1e-12 && guard < 20000) {
    guard += 1;
    const nextScript = cur.replay && cur.replay.i < cur.replay.script.length ? cur.replay.script[cur.replay.i].t : Infinity;
    const stop = Math.min(target, nextSampleTime(cur), nextScript);
    const dt = Math.max(0, stop - cur.t);
    let next = { ...cur, t: stop };
    for (const k of ["ev", "ch"]) if (next[k] && dt > 0) next[k] = advanceTrack(cur, k, dt);
    if (next.ev) next.ev = watchEquilibrium(next.ev, "ev", stop);
    if (next.ch) next.ch = watchEquilibrium(next.ch, "ch", stop);
    if (nextScript <= stop + 1e-12 && next.replay) {
      const entry = next.replay.script[next.replay.i];
      next = { ...next, replay: { ...next.replay, i: next.replay.i + 1 } };
      next = applyDisturbance(next, entry.action, { fromReplay: true }).scene;
    }
    for (const k of ["ev", "ch"]) if (next[k] && stop >= next[k].nextSample - 1e-12) next[k] = k === "ev" ? sampleEv(next[k], stop) : sampleCh(next[k], stop);
    cur = next;
  }
  return updateProgress(cur);
}

// ---------- disturbances ----------
const toMol = (people) => people / PEOPLE_PER_MOL;

/** Describes the state of a track right after a change (used by the explanation text). */
function disturbInfo(tr, kind, extra, t) {
  if (kind === "ev") { const sn = everydaySnapshot(tr.s); return { t, ...extra, rf: sn.rfDet, rr: sn.rrDet, direction: sn.rfDet > sn.rrDet ? "forward" : sn.rfDet < sn.rrDet ? "reverse" : "equilibrium", A: sn.A, B: sn.B, K: sn.K }; }
  const sn = chemSnapshot(tr.s); return { t, ...extra, rf: sn.rf, rr: sn.rr, Q: sn.Q, K: sn.Kc, direction: sn.direction, kf: sn.kf, kr: sn.kr };
}
function beforeSnapshot(tr, kind) {
  if (kind === "ev") { const sn = everydaySnapshot(tr.s); return { rf: sn.rfDet, rr: sn.rrDet, A: sn.detA, B: sn.detB, c: { A: sn.detA, B: sn.detB }, Aeq: sn.Aeq, Beq: sn.Beq }; }
  const sn = chemSnapshot(tr.s); return { rf: sn.rf, rr: sn.rr, Q: sn.Q, K: sn.Kc, c: { ...tr.s.c }, V: tr.s.V, T: tr.s.T, cat: tr.s.cat };
}
const markDisturb = (tr, kind, t, label) => {
  const n = tr.marks.filter((m) => m.kind === "disturb").length + 1;
  const pre = kind === "ev" ? sampleEv(tr, t) : sampleCh(tr, t);
  return { ...pre, marks: [...pre.marks, { t, kind: "disturb", label, n }] };
};
const afterDisturb = (tr, kind, t, extra, before) => {
  const info = disturbInfo(tr, kind, extra, t);
  const sampled = kind === "ev" ? sampleEv(tr, t) : sampleCh(tr, t);
  return { ...sampled, info, before, phase: "disturbed", eqAt: null };
};

/**
 * Apply one user disturbance to the scene.  Returns { scene, result } with result = { ok, code, message }.
 * Actions:  ev/add {city, n} ev/remove {city, n}   ch/add {id, n} ch/remove {id, n}   ch/temp {dir}   ch/vol {dir}   ch/cat {on}
 */
export function applyDisturbance(sc, action, { fromReplay = false } = {}) {
  if (!sc.started) return { scene: sc, result: no(action.type, "not-started", "Press Start first.") };
  const t = sc.t; const type = action.type; let next = sc;
  const rec = (s) => (fromReplay ? s : { ...s, script: [...s.script, { t, action }], replay: null });
  if (type === "ev/add" || type === "ev/remove") {
    if (!sc.ev) return { scene: sc, result: no(type, "no-everyday", "Not available in this mode.") };
    const city = action.city === "B" ? "B" : "A"; const want = (action.n ?? ADD_STEP) * (type === "ev/add" ? 1 : -1);
    if (want > 0 && sc.ev.s.A + sc.ev.s.B + want > MAX_PEOPLE) return { scene: sc, result: no(type, "too-many", `That would be more than ${MAX_PEOPLE} people in total.`) };
    const have = sc.ev.s[city]; if (want < 0 && have === 0) return { scene: sc, result: no(type, "empty", `City ${city} has nobody to remove.`) };
    const before = beforeSnapshot(sc.ev, "ev"); let evT = markDisturb(sc.ev, "ev", t, want > 0 ? `+${want} in ${city}` : `${want} in ${city}`);
    const r = changePeople(evT.s, city, want); evT = { ...evT, s: r.ev };
    evT = afterDisturb(evT, "ev", t, { type, city, n: r.moved }, before);
    next = { ...sc, ev: evT };
    if (sc.kind === "compare" && sc.ch) {
      const ch0 = sc.ch; const id = city; const dn = Math.abs(r.moved) * 1 / PEOPLE_PER_MOL * ch0.s.V0;
      const chBefore = beforeSnapshot(ch0, "ch"); let chT = markDisturb(ch0, "ch", t, r.moved > 0 ? `+${dn.toFixed(2)} mol ${id}` : `−${dn.toFixed(2)} mol ${id}`);
      const s2 = r.moved > 0 ? addAmount(chT.s, id, dn) : removeAmount(chT.s, id, dn);
      const took = r.moved > 0 ? dn : Math.min(dn, chT.s.c[id] * chT.s.V); chT = { ...chT, s: s2, vis: visualDisturbed(chT.vis, s2, id, r.moved > 0 ? dn : -took) };
      next = { ...next, ch: afterDisturb(chT, "ch", t, { type: r.moved > 0 ? "ch/add" : "ch/remove", id, n: dn }, chBefore) };
    }
    return { scene: rec({ ...next, disturbances: sc.disturbances + 1 }), result: ok(type, "applied", `${want > 0 ? "Added" : "Removed"} ${Math.abs(r.moved)} people ${want > 0 ? "to" : "from"} City ${city}.`) };
  }
  if (!sc.ch || sc.kind === "compare" && !(type === "ch/add" || type === "ch/remove")) return { scene: sc, result: no(type, "no-chem", "Not available in this mode.") };
  const rx = REACTIONS[sc.ch.s.rid]; const ch = sc.ch; const before = beforeSnapshot(ch, "ch");
  if (type === "ch/add" || type === "ch/remove") {
    const id = action.id; const spc = rx.species.find((s) => s.id === id); if (!spc) return { scene: sc, result: no(type, "unknown-species", "Unknown species.") };
    const step = action.n ?? rx.run.steps[id];
    if (type === "ch/remove" && !(ch.s.c[id] > 0)) return { scene: sc, result: no(type, "empty", `There is no ${spc.text} to remove.`) };
    const label = `${type === "ch/add" ? "+" : "−"}${spc.formula}`;
    let chT = markDisturb(ch, "ch", t, label); const have = chT.s.c[id] * chT.s.V; const take = type === "ch/add" ? step : Math.min(step, have);
    const s2 = type === "ch/add" ? addAmount(chT.s, id, step) : removeAmount(chT.s, id, step);
    chT = { ...chT, s: s2, vis: visualDisturbed(chT.vis, s2, id, type === "ch/add" ? take : -take) };
    next = { ...sc, ch: afterDisturb(chT, "ch", t, { type, id, n: take, formula: spc.formula }, before) };
  } else if (type === "ch/temp") {
    if (!rx.controls.temperature) return { scene: sc, result: no(type, "na", "Temperature is not varied for this reaction.") };
    const step = rx.run.Tstep * (action.dir > 0 ? 1 : -1); const T2 = Math.round((ch.s.T + step) * 100) / 100;
    if (T2 > rx.run.Tmax + 1e-9 || T2 < rx.run.Tmin - 1e-9) return { scene: sc, result: no(type, "limit", action.dir > 0 ? "Highest temperature in this model." : "Lowest temperature in this model.") };
    let chT = markDisturb(ch, "ch", t, `${action.dir > 0 ? "T↑" : "T↓"} ${Math.round(T2)} K`);
    chT = { ...chT, s: setTemperature(chT.s, T2) };
    next = { ...sc, ch: afterDisturb(chT, "ch", t, { type, dir: action.dir, T0: ch.s.T, T1: T2 }, before), usedConditions: true };
  } else if (type === "ch/vol") {
    if (!rx.controls.volume) return { scene: sc, result: no(type, "na", "Volume is not varied for this reaction.") };
    const factor = action.dir === "decrease" ? 0.5 : 2; const V2 = ch.s.V * factor;
    if (V2 < ch.s.V0 * 0.25 - 1e-12 || V2 > ch.s.V0 * 4 + 1e-12) return { scene: sc, result: no(type, "limit", action.dir === "decrease" ? "Smallest volume in this model." : "Largest volume in this model.") };
    let chT = markDisturb(ch, "ch", t, action.dir === "decrease" ? "V↓" : "V↑");
    chT = { ...chT, s: setVolume(chT.s, V2) };
    next = { ...sc, ch: afterDisturb(chT, "ch", t, { type, dir: action.dir, V0: ch.s.V, V1: V2 }, before), usedConditions: true };
  } else if (type === "ch/cat") {
    if (!rx.controls.catalyst) return { scene: sc, result: no(type, "na", "No catalyst control for this reaction.") };
    const on = !!action.on; if (on === ch.s.cat) return { scene: sc, result: no(type, "same", on ? "The catalyst is already present." : "There is no catalyst to remove.") };
    let chT = markDisturb(ch, "ch", t, on ? "catalyst on" : "catalyst off");
    chT = { ...chT, s: setCatalyst(chT.s, on) };
    next = { ...sc, ch: afterDisturb(chT, "ch", t, { type, on, factor: catalystFactor(rx, ch.s.T, true) }, before), usedConditions: true };
  } else return { scene: sc, result: no(type, "unknown", "Unknown action.") };
  return { scene: rec({ ...next, disturbances: sc.disturbances + 1 }), result: ok(type, "applied") };
}

// ---------- molecule picture bookkeeping (display only; never feeds back into the chemistry) ----------
function visualTick(sc, dtRealScaled) {
  if (!sc.ch) return sc;
  const snap = chemSnapshot(sc.ch.s); const o = stepVisual(sc.ch.vis, sc.ch.s, snap, dtRealScaled, sc.ch.simPerReal);
  return o.v === sc.ch.vis ? sc : { ...sc, ch: { ...sc.ch, vis: o.v } };
}
function visualSnap(sc) { return sc.ch ? { ...sc, ch: { ...sc.ch, vis: snapVisual(sc.ch.vis, sc.ch.s) } } : sc; }

// ---------- learning stage guide (never locks anything) ----------
export const STAGE_COUNT = 8;
function updateProgress(sc) {
  let st = sc.progress ?? 1; const main = sc.ch && sc.kind === "chemical" ? "ch" : "ev";
  if (!sc.started) return { ...sc, progress: Math.max(1, st) };
  const tr = sc[main]; const sn = main === "ev" ? everydaySnapshot(tr.s) : chemSnapshot(tr.s); const rf = main === "ev" ? sn.rfDet : sn.rf; const rr = main === "ev" ? sn.rrDet : sn.rr;
  const first = tr.marks.every((m) => m.kind !== "disturb");
  if (first) {
    st = Math.max(st, 1);
    if (rr > 0.05 * rf && rf > 0) st = Math.max(st, 2);
    if (sn.status === "near" || sn.status === "attained") st = Math.max(st, 3);
    if (sn.status === "attained") st = Math.max(st, 4);
  } else { st = Math.max(st, 4); }
  if (sc.visited.length >= 2) st = Math.max(st, 5);
  if (sc.disturbances >= 1) st = Math.max(st, 6);
  if (sc.usedConditions) st = Math.max(st, 7);
  if ((sc.disturbances >= 1 && tr.phase === "attained" && sc.usedConditions) || (sc.kind === "everyday" && sc.disturbances >= 2 && tr.phase === "attained")) st = Math.max(st, 8);
  return st === sc.progress ? sc : { ...sc, progress: st };
}

// ---------- reducer ----------
const scOf = (state) => state.scenes[state.mode];
const setScene = (state, sc, last) => ({ ...state, scenes: { ...state.scenes, [state.mode]: sc }, last: last ?? state.last });
const playbackOf = (sc) => (sc.kind === "chemical" ? REACTIONS[sc.ch.s.rid].playback : EVERYDAY_PLAYBACK);

export function reduce(state, action) {
  const type = action?.type; const sc = scOf(state);
  switch (type) {
    case "mode/set": {
      if (!MODES.includes(action.mode)) return { ...state, last: no(type, "bad-mode", "Unknown mode.") };
      if (action.mode === state.mode) return state;
      const leaving = sc.status === "running" ? { ...sc, status: "paused" } : sc;
      return { ...state, mode: action.mode, scenes: { ...state.scenes, [state.mode]: leaving }, last: ok(type) };
    }
    case "ui/speed": return SPEEDS.includes(action.speed) ? { ...state, ui: { ...state.ui, speed: action.speed }, last: ok(type) } : { ...state, last: no(type, "bad-speed", "Speed must be 0.5, 1 or 2.") };
    case "ui/simple": case "ui/graph": case "ui/explanation": case "ui/pop": case "ui/fluct": {
      const key = { "ui/simple": "simple", "ui/graph": "showGraph", "ui/explanation": "showExplanation", "ui/pop": "showPop", "ui/fluct": "fluct" }[type];
      return { ...state, ui: { ...state.ui, [key]: action.value === undefined ? !state.ui[key] : !!action.value }, last: ok(type) };
    }
    case "run/start": {
      if (sc.status === "running") return state;
      return setScene(state, { ...sc, status: "running", started: true }, ok(type));
    }
    case "run/pause": return sc.status === "running" ? setScene(state, { ...sc, status: "paused" }, ok(type)) : state;
    case "run/resume": return sc.status === "paused" ? setScene(state, { ...sc, status: "running" }, ok(type)) : state;
    case "run/toggle": return reduce(state, { type: sc.status === "running" ? "run/pause" : sc.status === "paused" ? "run/resume" : "run/start" });
    case "run/reset": {
      const fresh = createScene(sc.kind, sc.setup, sc.baseSeed, sc.resets + 1);
      return setScene(state, { ...fresh, visited: sc.visited }, ok(type));
    }
    case "run/replay": {
      const fresh = createScene(sc.kind, sc.setup, sc.baseSeed, sc.resets);
      const script = sc.script.map((e) => ({ t: e.t, action: e.action }));
      return setScene(state, { ...fresh, status: "running", started: true, replay: { script, i: 0 }, script: [], visited: sc.visited }, ok(type));
    }
    case "run/step": {
      const dT = STEP_REAL_SECONDS * playbackOf(sc);
      const started = { ...sc, started: true, status: sc.status === "idle" ? "paused" : sc.status === "running" ? "paused" : sc.status };
      return setScene(state, advanceScene(started, dT), ok(type));
    }
    case "run/tick": {
      if (sc.status !== "running") return state;
      const dtReal = Math.max(0, Math.min(action.dt ?? 0, 0.25));
      return setScene(state, visualTick(advanceScene(sc, dtReal * state.ui.speed * playbackOf(sc)), dtReal * state.ui.speed));
    }
    case "run/advance": { // virtual-time hook for tests / verification: advance by simulation time units, whatever the status
      const started = { ...sc, started: true, status: sc.status === "idle" ? "paused" : sc.status };
      return setScene(state, visualSnap(advanceScene(started, action.dT)), ok(type));
    }
    case "setup/preset": { // everyday & compare: Towards A | Center | Towards B
      if (!PRESETS[action.preset] || sc.kind === "chemical") return { ...state, last: no(type, "bad-preset", "Unknown preset.") };
      const p = PRESETS[action.preset]; const setup = { ...sc.setup, preset: action.preset, kf: p.kf, kr: p.kr, kfRef: p.kf, krRef: p.kr };
      const wasStarted = sc.started; const fresh = createScene(sc.kind, setup, sc.baseSeed, sc.resets);
      const visited = sc.visited.includes(visitKey(sc.kind, setup)) ? sc.visited : [...sc.visited, visitKey(sc.kind, setup)];
      return setScene(state, { ...fresh, visited, status: wasStarted ? "running" : "idle", started: wasStarted }, ok(type));
    }
    case "setup/reaction": {
      if (!REACTIONS[action.id] || sc.kind !== "chemical") return { ...state, last: no(type, "bad-reaction", "Unknown reaction.") };
      const setup = { ...defaultSetup("chemical"), reactionId: action.id, kfRef: REACTIONS[action.id].kinetics.kfRef, krRef: REACTIONS[action.id].kinetics.krRef ?? null };
      const fresh = createScene("chemical", setup, sc.baseSeed, sc.resets);
      const key = visitKey("chemical", setup); const visited = sc.visited.includes(key) ? sc.visited : [...sc.visited, key];
      return setScene(state, { ...fresh, visited }, ok(type));
    }
    case "setup/rates": { // A <=> B adjustable k_f, k_r (restarts the run with the new constants)
      if (sc.kind !== "chemical" || sc.setup.reactionId !== "ab") return { ...state, last: no(type, "na", "Only the A ⇌ B model has adjustable rate constants.") };
      const kf = Math.min(2, Math.max(0.05, action.kf ?? sc.setup.kfRef)); const kr = Math.min(2, Math.max(0.05, action.kr ?? sc.setup.krRef));
      const setup = { ...sc.setup, kfRef: kf, krRef: kr }; const fresh = createScene("chemical", setup, sc.baseSeed, sc.resets);
      const key = visitKey("chemical", setup); const visited = sc.visited.includes(key) ? sc.visited : [...sc.visited, key];
      return setScene(state, { ...fresh, visited, status: sc.started ? "running" : "idle", started: sc.started }, ok(type));
    }
    case "ev/add": case "ev/remove": case "ch/add": case "ch/remove": case "ch/temp": case "ch/vol": case "ch/cat": {
      const r = applyDisturbance(sc, action);
      return setScene(state, updateProgress(r.scene), r.result);
    }
    default: return state;
  }
}

/** Consistency checks (empty = healthy).  Called by the tests after every action. */
export function checkInvariants(state) {
  const bad = [];
  for (const [name, sc] of Object.entries(state.scenes)) {
    if (sc.ev) {
      const { A, B } = sc.ev.s;
      if (!Number.isInteger(A) || !Number.isInteger(B) || A < 0 || B < 0) bad.push(`${name}: populations must be non-negative integers (A=${A}, B=${B})`);
      if (A + B !== sc.ev.s.N0 + sc.ev.s.added.A + sc.ev.s.added.B) bad.push(`${name}: people not conserved (${A + B} vs ${sc.ev.s.N0 + sc.ev.s.added.A + sc.ev.s.added.B})`);
    }
    if (sc.ch) {
      for (const [id, v] of Object.entries(sc.ch.s.c)) if (!(v >= 0) || !Number.isFinite(v)) bad.push(`${name}: concentration of ${id} is ${v}`);
      const e = atomConservationError(sc.ch.s); if (e > 1e-9) bad.push(`${name}: atoms not conserved (relative error ${e})`);
    }
    for (const k of ["ev", "ch"]) if (sc[k]) { const h = sc[k].hist; if (h.t.length === 0) bad.push(`${name}.${k}: empty history`); for (let i = 1; i < h.t.length; i += 1) if (h.t[i] < h.t[i - 1] - 1e-9) { bad.push(`${name}.${k}: history time goes backwards`); break; } }
  }
  return bad;
}

export { PRESET_IDS, REACTION_IDS, solveEquilibrium };
