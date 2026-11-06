// Shared state of the Mass Spectrometry workspace: one small external store (pure JS, no React), like state/studioState.js (NMR) and ir/state/irState.js.
//   * the six stages all read and write the SAME experiment, so moving between stages never resets it (stages unmount, the store does not);
//   * the experiment itself (population, outcomes, detector counts) is NOT stored: it is a pure function of (molId, seed, n) in model/experiment.js, so the
//     persisted slice stays tiny and a reload reproduces exactly the same experiment;
//   * persisted state is versioned (STATE_VERSION). A payload without the version (the old 13-stage layout) or with another version is migrated
//     (stage mapping, the isotope / pattern / unknown-compound activities) or ignored safely by sanitize();
//   * Play / Pause, speed and the replay token are NOT here: they are shared with the NMR workspace (the studio store). The animation clock is session-live only.
import { SECTOR, tunedField } from "../physics/sector.js";
import { CANDIDATES, EMPTY_PICKS, ROUNDS } from "../physics/challenge.js";
import { SIM_IDS, DEFAULT_MOLECULE, getSim } from "../data/molecules.js";
import { POP_DEFAULT, clampN } from "../model/experiment.js";
import { SPECTRUM_IDS } from "../data/spectra.js";

export const STATE_VERSION = 2;
export const MS_STAGES = [
  { id: "sample", n: 1, label: "Instrument & Sample", title: "Instrument and Sample" },
  { id: "ionise", n: 2, label: "Ionization", title: "Ionization: Forming Positive Ions" },
  { id: "fragment", n: 3, label: "Fragmentation", title: "Fragmentation of Molecular Ions" },
  { id: "separate", n: 4, label: "Acceleration & Separation", title: "Acceleration and Separation by m/z" },
  { id: "detect", n: 5, label: "Detection & Spectrum", title: "Detection and Spectrum Formation" },
  { id: "interpret", n: 6, label: "Interpretation", title: "Interpreting a Mass Spectrum" },
];
export const MS_STAGE_COUNT = MS_STAGES.length;
export const ACTIVITIES = [
  { id: null, label: "My spectrum" },
  { id: "unknown", label: "Unknown challenge" },
  { id: "patterns", label: "Halogen isotope patterns" },
  { id: "isotopes", label: "Isotopes and Aᵣ (revision)" },
];
export const PATTERN_COMPOUNDS = ["cl2", "ch3cl", "ch2cl2", "chcl3", "ch3br", "br2"];
export const V_MIN = SECTOR.V_MIN; export const V_MAX = SECTOR.V_MAX; export const V_DEFAULT = 2000;
export const ANALYSERS = ["sector", "tof"];
export const FOLLOW = ["parent", "charged", "neutral"];
export const MAX_NOTES = 8;
export const defaultB = (molId, V = V_DEFAULT) => Math.round(tunedField(getSim(molId).spec.baseMz, V) * 1000) / 1000;

export const DEFAULTS = Object.freeze({
  v: STATE_VERSION,
  stage: 1,
  molId: DEFAULT_MOLECULE, seed: 1, n: POP_DEFAULT,
  started: false, fired: false,
  analyser: "sector", V: V_DEFAULT, B: defaultB(DEFAULT_MOLECULE),
  track: { id: null, follow: "parent" },
  selPath: null, selPeak: null,
  cmp: { on: false, mz: null },
  showCharges: true, showLabels: true,
  activity: null, notes: [],
  s10: { p35: 75 },
  s11: { compound: "cl2", model: "teaching", sel: null },
  s12: { seed: 1, round: 0, task: 1, sel: null, picks: EMPTY_PICKS, submitted: false },
});

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const oneOf = (x, list, d) => (list.includes(x) ? x : d);
const int = (x, lo, hi, d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d);
const num = (x, lo, hi, d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const bool = (x, d) => (typeof x === "boolean" ? x : d);
const intOrNull = (x) => (Number.isInteger(x) ? x : null);
export const clampStage = (n) => int(n, 1, MS_STAGE_COUNT, 1);
/** old 13-stage numbers -> the six new stages */
export const OLD_STAGE_MAP = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6, 12: 6, 13: 6 };
const OLD_ACTIVITY = { 10: "isotopes", 11: "patterns", 12: "unknown" };

export function sanitize(raw) {
  const r = isObj(raw) ? raw : {}; const D = DEFAULTS; const g = (k) => (isObj(r[k]) ? r[k] : {});
  const old = r.v !== STATE_VERSION; // the 13-stage layout (no version): migrate what can be kept
  const molId = oneOf(r.molId, SIM_IDS, D.molId);
  const V = Math.round(num(r.V, V_MIN, V_MAX, D.V) / 50) * 50;
  const B = Math.round(num(r.B, SECTOR.B_MIN, SECTOR.B_MAX, defaultB(molId, V)) * 1000) / 1000;
  const spec = getSim(molId).spec; const mzs = spec.peaks.map((p) => p.mz);
  const s12 = g("s12"); const round = int(s12.round, 0, ROUNDS.length - 1, 0); const roundId = ROUNDS[round];
  const ids = CANDIDATES[roundId].map((c) => c.id);
  const mzList = (list) => (Array.isArray(list) ? [...new Set(list.filter((x) => Number.isInteger(x) && x > 0 && x < 400))].slice(0, 12) : []);
  const p = isObj(s12.picks) ? s12.picks : {};
  const stage = old ? clampStage(OLD_STAGE_MAP[int(r.stage, 1, 13, 1)] ?? 1) : clampStage(r.stage ?? D.stage);
  const activity = old ? (OLD_ACTIVITY[int(r.stage, 1, 13, 1)] ?? null) : oneOf(r.activity ?? null, [null, "unknown", "patterns", "isotopes"], null);
  const tr = g("track"); const cmp = g("cmp");
  const notes = Array.isArray(r.notes) ? r.notes.filter((x) => isObj(x) && Number.isFinite(x.mz) && typeof x.text === "string").slice(0, MAX_NOTES).map((x) => ({ mz: Math.round(x.mz * 10) / 10, text: x.text.slice(0, 160) })) : [];
  return {
    v: STATE_VERSION,
    stage, molId, seed: int(r.seed, 1, 9999, 1), n: old ? D.n : clampN(r.n),
    started: stage > 1 ? true : bool(r.started, false),
    fired: stage > 2 ? true : bool(r.fired, false),
    analyser: oneOf(r.analyser, ANALYSERS, D.analyser), V, B,
    track: { id: Number.isInteger(tr.id) && tr.id >= 0 && tr.id < clampN(old ? D.n : r.n) ? tr.id : null, follow: oneOf(tr.follow, FOLLOW, "parent") },
    selPath: typeof r.selPath === "string" && getSim(molId).pathById[r.selPath] ? r.selPath : null,
    selPeak: Number.isInteger(r.selPeak) && mzs.includes(r.selPeak) ? r.selPeak : null,
    cmp: { on: bool(cmp.on, false), mz: Number.isInteger(cmp.mz) && mzs.includes(cmp.mz) ? cmp.mz : null },
    showCharges: bool(r.showCharges, true), showLabels: bool(r.showLabels, true),
    activity, notes,
    s10: { p35: Math.round(num(g("s10").p35, 0, 100, D.s10.p35) * 100) / 100 },
    s11: { compound: oneOf(g("s11").compound, PATTERN_COMPOUNDS, D.s11.compound), model: oneOf(g("s11").model, ["teaching", "natural"], D.s11.model), sel: intOrNull(g("s11").sel) },
    s12: {
      seed: int(s12.seed, 1, 9999, 1), round, task: int(s12.task, 1, 5, 1), sel: intOrNull(s12.sel),
      picks: { t1: intOrNull(p.t1), t2: intOrNull(p.t2), t3: mzList(p.t3), t4: oneOf(p.t4, ["none", "cl", "br"], null), t5: oneOf(p.t5, ids, null) },
      submitted: bool(s12.submitted, false),
    },
  };
}
export const pickPersisted = (s) => ({ v: STATE_VERSION, stage: s.stage, molId: s.molId, seed: s.seed, n: s.n, started: s.started, fired: s.fired, analyser: s.analyser, V: s.V, B: s.B, track: s.track, selPath: s.selPath, selPeak: s.selPeak, cmp: s.cmp, showCharges: s.showCharges, showLabels: s.showLabels, activity: s.activity, notes: s.notes, s10: s.s10, s11: s.s11, s12: s.s12 });
export const isValidPersisted = (x) => isObj(x) && typeof x.stage === "number";

const RUNTIME = { seek: { token: 0, t: 0 }, replay: { token: 0 }, detail: { token: 0, slow: false } };
export function createMsStore(initial) {
  let state = { ...sanitize(initial), ...RUNTIME };
  const listeners = new Set();
  const emit = () => { for (const l of [...listeners]) l(); };
  const live = { t: 0, duration: 0, stage: state.stage }; // written every frame by the animation clock; deliberately not reactive
  const store = {
    live,
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(patchOrFn) {
      const patch = typeof patchOrFn === "function" ? patchOrFn(state) : patchOrFn;
      let changed = false; for (const k of Object.keys(patch)) if (!Object.is(state[k], patch[k])) { changed = true; break; }
      if (!changed) return; state = { ...state, ...patch }; emit();
    },
    patch(key, p) { store.set((s) => { const next = { ...s[key], ...p }; const same = Object.keys(next).every((k) => Object.is(next[k], s[key][k])); return same ? {} : { [key]: next }; }); },
    // ---- navigation ----
    /** t = 0 starts the stage animation from the beginning; Infinity shows the finished stage */
    seek: (t) => store.set((s) => ({ seek: { token: s.seek.token + 1, t } })),
    setStage(n) {
      const to = clampStage(n);
      store.set((s) => (to === s.stage ? {} : { stage: to, started: to > 1 ? true : s.started, fired: to > 2 ? true : s.fired, seek: { token: s.seek.token + 1, t: to > s.stage ? 0 : Infinity } }));
    },
    nextStage: () => store.setStage(state.stage + 1),
    prevStage: () => store.setStage(state.stage - 1),
    // ---- experiment ----
    setMolecule: (molId) => store.set((s) => (!SIM_IDS.includes(molId) || molId === s.molId ? {} : { molId, started: false, fired: false, stage: 1, track: { id: null, follow: "parent" }, selPath: null, selPeak: null, cmp: { on: false, mz: null }, B: defaultB(molId, s.V), notes: [], seek: { token: s.seek.token + 1, t: 0 } })),
    newSample: () => store.set((s) => ({ seed: (s.seed % 9999) + 1, started: false, fired: false, stage: 1, track: { id: null, follow: "parent" }, selPath: null, selPeak: null, seek: { token: s.seek.token + 1, t: 0 } })),
    setN: (n) => store.set((s) => ({ n: clampN(n), started: false, fired: false, stage: 1, track: { id: null, follow: "parent" }, seek: { token: s.seek.token + 1, t: 0 } })),
    fire: () => store.set((s) => ({ fired: true, seek: { token: s.seek.token + 1, t: 0 } })),
    startSample: () => store.set((s) => ({ started: true, seek: { token: s.seek.token + 1, t: 0 } })),
    setAnalyser: (analyser) => store.set((s) => (ANALYSERS.includes(analyser) && analyser !== s.analyser ? { analyser, seek: s.stage >= 4 ? { token: s.seek.token + 1, t: 0 } : s.seek } : {})),
    setV: (V) => store.set((s) => { const v = Math.round(num(V, V_MIN, V_MAX, DEFAULTS.V) / 50) * 50; return v === s.V ? {} : { V: v, seek: s.stage === 4 ? { token: s.seek.token + 1, t: Infinity } : s.seek }; }),
    setB: (B) => store.set((s) => ({ B: Math.round(num(B, SECTOR.B_MIN, SECTOR.B_MAX, DEFAULTS.B) * 1000) / 1000, seek: s.stage === 4 ? { token: s.seek.token + 1, t: Infinity } : s.seek })),
    /** set B so that this m/z reaches the detector at the present V */
    tuneTo: (mz) => store.set((s) => ({ B: Math.round(num(tunedField(mz, s.V), SECTOR.B_MIN, SECTOR.B_MAX, s.B) * 1000) / 1000, seek: s.stage === 4 ? { token: s.seek.token + 1, t: Infinity } : s.seek })),
    // ---- tracking and selections ----
    trackMolecule: (id) => store.set((s) => (s.track.id === id ? {} : { track: { id, follow: "parent" } })),
    untrack: () => store.set({ track: { id: null, follow: "parent" } }),
    setFollow: (follow) => store.set((s) => (FOLLOW.includes(follow) ? { track: { ...s.track, follow } } : {})),
    selectPath: (selPath) => store.set((s) => ({ selPath, detail: { token: s.detail.token + 1, slow: s.detail.slow } })),
    selectPeak: (selPeak) => store.set((s) => ({ selPeak: s.selPeak === selPeak ? null : selPeak, detail: { token: s.detail.token + 1, slow: s.detail.slow } })),
    replayDetail: (slow = false) => store.set((s) => ({ detail: { token: s.detail.token + 1, slow } })),
    replayFragmentation: () => store.set((s) => ({ replay: { token: s.replay.token + 1 }, seek: s.stage === 3 ? { token: s.seek.token + 1, t: 0 } : s.seek, detail: { token: s.detail.token + 1, slow: s.detail.slow } })),
    setCmp: (p) => store.set((s) => ({ cmp: { ...s.cmp, ...p } })),
    toggleCharges: () => store.set((s) => ({ showCharges: !s.showCharges })),
    toggleLabels: () => store.set((s) => ({ showLabels: !s.showLabels })),
    // ---- interpretation ----
    setActivity: (activity) => store.set({ activity: [null, "unknown", "patterns", "isotopes"].includes(activity) ? activity : null }),
    addNote: (mz, text) => store.set((s) => { const t = String(text ?? "").trim().slice(0, 160); if (!t) return {}; const rest = s.notes.filter((n) => n.mz !== mz); return { notes: [...rest, { mz, text: t }].slice(-MAX_NOTES) }; }),
    removeNote: (mz) => store.set((s) => ({ notes: s.notes.filter((n) => n.mz !== mz) })),
    // stage-12 style challenge
    pickPeak: (mz) => store.patch("s12", { sel: mz }),
    setTask: (task) => store.patch("s12", { task: int(task, 1, 5, 1), sel: null }),
    usePeak: () => store.set((s) => {
      const { task, sel } = s.s12; if (sel === null || s.s12.submitted) return {};
      if (task === 1) return { s12: { ...s.s12, picks: { ...s.s12.picks, t1: sel } } };
      if (task === 2) return { s12: { ...s.s12, picks: { ...s.s12.picks, t2: sel } } };
      if (task === 3) { const t3 = s.s12.picks.t3.includes(sel) ? s.s12.picks.t3.filter((m) => m !== sel) : [...s.s12.picks.t3, sel]; return { s12: { ...s.s12, picks: { ...s.s12.picks, t3 } } }; }
      return {};
    }),
    choose: (key, value) => store.set((s) => (s.s12.submitted ? {} : { s12: { ...s.s12, picks: { ...s.s12.picks, [key]: value } } })),
    submit: () => store.patch("s12", { submitted: true }),
    nextRound: () => store.set((s) => ({ s12: { ...s.s12, round: (s.s12.round + 1) % ROUNDS.length, task: 1, sel: null, picks: EMPTY_PICKS, submitted: false } })),
    restartRound: () => store.set((s) => ({ s12: { ...s.s12, task: 1, sel: null, picks: EMPTY_PICKS, submitted: false } })),
    /** whole experiment back to the start (keeps the molecule, the seed and the analyser) */
    reset: () => store.set((s) => ({ ...sanitize({ molId: s.molId, seed: s.seed, n: s.n, analyser: s.analyser, v: STATE_VERSION }), seek: { token: s.seek.token + 1, t: 0 }, replay: s.replay, detail: { token: s.detail.token + 1, slow: false } })),
  };
  return store;
}
export const roundId = (s) => ROUNDS[s.s12.round];
export { SPECTRUM_IDS };
