// Shared state of the Spectroscopy Simulation Lab: one small external store (pure JS, no React) so that
//   * the shell, the technique tabs, the stepper and every stage read and write the SAME experiment,
//   * switching stage / technique / view never resets it (stages unmount, the store does not),
//   * the persisted slice can be mirrored to sessionStorage (see StudioContext.jsx) and unit-tested without a DOM.
// Playback (playing, step requests, reset token) and per-activity timeline positions are session-live only: they are
// never persisted, so a reload never resumes an animation in the middle of an event.
import { B0_DEFAULT, B0_MAX, B0_MIN, clampB0, b0ForMHz, larmorMHz } from "../nmr/physics/constants.js";

export const TECHNIQUES = [
  { id: "ms", label: "Mass Spectrometry", developed: false },
  { id: "ir", label: "IR Spectroscopy", developed: false },
  { id: "nmr", label: "¹H NMR", developed: true },
  { id: "splitting", label: "Splitting Patterns", developed: true },
  { id: "structure", label: "Structure Investigation", developed: false },
];
export const STAGES = [
  { id: "principle", n: 1, label: "Principle", sub: "Nucleus, field, RF" },
  { id: "instrument", n: 2, label: "The Instrument", sub: "Spectrometer, FID, FT" },
  { id: "molecular", n: 3, label: "Molecular Process", sub: "Environments, shift" },
  { id: "spectrum", n: 4, label: "The Spectrum", sub: "Build and read it" },
  { id: "interpretation", n: 5, label: "Interpretation", sub: "Predict and identify" },
];
export const PRINCIPLE_ACTIVITIES = [
  { id: "proton", label: "The proton" },
  { id: "field", label: "Apply the field" },
  { id: "rf", label: "RF pulse" },
  { id: "resonance", label: "Resonance" },
];
export const INSTRUMENT_ACTIVITIES = [
  { id: "spectrometer", label: "Spectrometer" },
  { id: "signal", label: "FID and Fourier transform" },
];
export const SPEEDS = [0.25, 0.5, 1, 2];
export const DEFAULT_MOLECULE_ID = "ethanol";
export const CARRIER_PPM = 5; // centre of the 20 ppm acquisition window used by the FID explorer

/** The default RF frequency sits 8 kHz above resonance at the default field: the student has to find the resonance. */
export const DEFAULT_RF_OFFSET_MHZ = 0.008;
export const DEFAULT_RF_MHZ = Math.round((larmorMHz(B0_DEFAULT) + DEFAULT_RF_OFFSET_MHZ) * 1e6) / 1e6;

export const FID_PRESETS = {
  single: { label: "One resonance", comps: [{ ppm: 3, amp: 1 }] },
  two: { label: "Two resonances", comps: [{ ppm: 1.5, amp: 1 }, { ppm: 4.5, amp: 1 }] },
  three: { label: "Three resonances (3:2:1)", comps: [{ ppm: 1.2, amp: 3 }, { ppm: 3.6, amp: 2 }, { ppm: 5.3, amp: 1 }] },
};

export const DEFAULTS = Object.freeze({
  technique: "nmr",
  stage: "principle",
  mode: "student", // "teacher" | "student"
  splitView: false,
  speed: 1,
  // chemistry selection shared with the molecular stages (contract with the molecular components)
  moleculeId: DEFAULT_MOLECULE_ID,
  selectedEnvId: null,
  selectedMultipletId: null,
  // physics
  b0Tesla: B0_DEFAULT,
  activity: { principle: "proton", instrument: "spectrometer" },
  field: { applied: false, popMode: "real", view: "simplified", arrows: true, labels: true, analogy: false, mu: true, inField: false, spin: "alpha" },
  rf: { rfMHz: DEFAULT_RF_MHZ, b1uT: 587.2, tpUs: 10, shortenRelax: false, frame: "rotating", t1: 1, t2: 0.5, challenge: "idle" },
  instrument: { selected: null, guided: false },
  fid: { preset: "three", comps: FID_PRESETS.three.comps, t2starMs: 120, noisePct: 3, lbHz: 0, windowMs: 40, view: "time", compare: false, zoom: true },
});

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const num = (x, lo, hi, d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const oneOf = (x, list, d) => (list.includes(x) ? x : d);
const bool = (x, d) => (typeof x === "boolean" ? x : d);
const strOrNull = (x) => (typeof x === "string" && x.length < 80 ? x : null);

/** Validate / repair a persisted or externally supplied state: unknown keys dropped, bad values replaced by defaults. */
export function sanitize(raw) {
  const r = isObj(raw) ? raw : {};
  const D = DEFAULTS;
  const f = isObj(r.field) ? r.field : {};
  const rf = isObj(r.rf) ? r.rf : {};
  const ins = isObj(r.instrument) ? r.instrument : {};
  const fid = isObj(r.fid) ? r.fid : {};
  const act = isObj(r.activity) ? r.activity : {};
  const comps = Array.isArray(fid.comps) && fid.comps.length >= 1 && fid.comps.length <= 4
    ? fid.comps.map((c) => ({ ppm: num(c?.ppm, 0, 10, 3), amp: num(c?.amp, 0.1, 10, 1) }))
    : D.fid.comps;
  return {
    technique: oneOf(r.technique, TECHNIQUES.map((t) => t.id), D.technique),
    stage: oneOf(r.stage, STAGES.map((s) => s.id), D.stage),
    mode: oneOf(r.mode, ["teacher", "student"], D.mode),
    splitView: bool(r.splitView, D.splitView),
    speed: oneOf(r.speed, SPEEDS, D.speed),
    moleculeId: typeof r.moleculeId === "string" && r.moleculeId.length < 80 ? r.moleculeId : D.moleculeId,
    selectedEnvId: strOrNull(r.selectedEnvId),
    selectedMultipletId: strOrNull(r.selectedMultipletId),
    b0Tesla: Math.round(num(r.b0Tesla, B0_MIN, B0_MAX, D.b0Tesla) * 10) / 10,
    activity: {
      principle: oneOf(act.principle, PRINCIPLE_ACTIVITIES.map((a) => a.id), D.activity.principle),
      instrument: oneOf(act.instrument, INSTRUMENT_ACTIVITIES.map((a) => a.id), D.activity.instrument),
    },
    field: {
      applied: bool(f.applied, D.field.applied), popMode: oneOf(f.popMode, ["real", "teaching"], D.field.popMode),
      view: oneOf(f.view, ["simplified", "scientific"], D.field.view), arrows: bool(f.arrows, D.field.arrows),
      labels: bool(f.labels, D.field.labels), analogy: bool(f.analogy, D.field.analogy), mu: bool(f.mu, true), inField: bool(f.inField, false), spin: oneOf(f.spin, ["alpha", "beta"], "alpha"),
    },
    rf: {
      rfMHz: num(rf.rfMHz, 1, 2000, D.rf.rfMHz), b1uT: num(rf.b1uT, 50, 1000, D.rf.b1uT), tpUs: num(rf.tpUs, 1, 100, D.rf.tpUs),
      shortenRelax: bool(rf.shortenRelax, false), frame: oneOf(rf.frame, ["rotating", "lab"], "rotating"),
      t1: num(rf.t1, 0.001, 20, D.rf.t1), t2: num(rf.t2, 0.001, 20, D.rf.t2), challenge: oneOf(rf.challenge, ["idle", "active", "found"], "idle"),
    },
    instrument: { selected: strOrNull(ins.selected), guided: bool(ins.guided, false) },
    fid: {
      preset: oneOf(fid.preset, [...Object.keys(FID_PRESETS), "custom"], D.fid.preset), comps,
      t2starMs: num(fid.t2starMs, 10, 1000, D.fid.t2starMs), noisePct: num(fid.noisePct, 0, 50, D.fid.noisePct), lbHz: num(fid.lbHz, 0, 10, 0),
      windowMs: oneOf(fid.windowMs, [10, 40, 200, 1000, 0], D.fid.windowMs), view: oneOf(fid.view, ["time", "freq", "both"], D.fid.view),
      compare: bool(fid.compare, false), zoom: bool(fid.zoom, true),
    },
  };
}

/** The part of the state that is mirrored to sessionStorage. */
export function pickPersisted(s) {
  const { technique, stage, mode, splitView, speed, moleculeId, selectedEnvId, selectedMultipletId, b0Tesla, activity, field, rf, instrument, fid } = s;
  return { technique, stage, mode, splitView, speed, moleculeId, selectedEnvId, selectedMultipletId, b0Tesla, activity, field, rf, instrument, fid };
}
export const isValidPersisted = (x) => isObj(x) && typeof x.stage === "string";

export function createStudioStore(initial) {
  let state = { ...sanitize(initial), playing: false, stepRequest: { n: 0, dir: 1 }, resetToken: 0 };
  const listeners = new Set();
  const timeRefs = new Map(); // activity id -> display seconds (not reactive, not persisted)
  const emit = () => { for (const l of [...listeners]) l(); };
  const store = {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Shallow-merge a patch (or the result of fn(state)); no-op if nothing changed so subscribers do not wake up. */
    set(patchOrFn) {
      const patch = typeof patchOrFn === "function" ? patchOrFn(state) : patchOrFn;
      let changed = false;
      for (const k of Object.keys(patch)) if (!Object.is(state[k], patch[k])) { changed = true; break; }
      if (!changed) return;
      state = { ...state, ...patch };
      emit();
    },
    /** Update one nested slice: store.patch("rf", { tpUs: 20 }). */
    patch(key, p) { store.set((s) => ({ [key]: { ...s[key], ...p } })); },
    setTechnique: (technique) => store.set({ technique, playing: false }),
    setStage: (stage) => store.set({ stage, playing: false }),
    setActivity: (group, id) => store.set((s) => ({ activity: { ...s.activity, [group]: id }, playing: false })),
    setMode: (mode) => store.set({ mode }),
    setSplitView: (splitView) => store.set({ splitView }),
    setSpeed: (speed) => store.set({ speed: SPEEDS.includes(speed) ? speed : 1 }),
    setPlaying: (playing) => store.set({ playing: Boolean(playing) }),
    togglePlaying: () => store.set((s) => ({ playing: !s.playing })),
    stepForward: () => store.set((s) => ({ playing: false, stepRequest: { n: s.stepRequest.n + 1, dir: 1 } })),
    stepBack: () => store.set((s) => ({ playing: false, stepRequest: { n: s.stepRequest.n + 1, dir: -1 } })),
    /** Reset the playback of every activity (does not touch the chemistry or the instrument settings). */
    resetPlayback: () => { timeRefs.clear(); store.set((s) => ({ playing: false, resetToken: s.resetToken + 1 })); },
    /** B0 is the single source of truth; the operating frequency is derived from it. */
    setB0: (b0) => store.set({ b0Tesla: Math.round(clampB0(b0) * 10) / 10 }),
    setOperatingFrequencyMHz: (mhz) => store.set({ b0Tesla: Math.round(clampB0(b0ForMHz(mhz)) * 100) / 100 }),
    setMolecule: (moleculeId) => store.set({ moleculeId, selectedEnvId: null, selectedMultipletId: null }),
    setSelectedEnv: (selectedEnvId) => store.set({ selectedEnvId }),
    setSelectedMultiplet: (selectedMultipletId) => store.set({ selectedMultipletId }),
    getTime: (id, fallback = 0) => timeRefs.get(id) ?? fallback,
    setTime: (id, t) => { timeRefs.set(id, t); },
    /** Full reset of the experiment to the defaults (keeps technique, stage, mode, split view and speed). */
    resetExperiment: () => {
      timeRefs.clear();
      store.set((s) => ({ ...sanitize({ technique: s.technique, stage: s.stage, mode: s.mode, splitView: s.splitView, speed: s.speed }), playing: false, resetToken: s.resetToken + 1, stepRequest: s.stepRequest }));
    },
  };
  return store;
}

export const operatingFrequencyMHz = (state) => larmorMHz(state.b0Tesla);
export { B0_MIN, B0_MAX };
