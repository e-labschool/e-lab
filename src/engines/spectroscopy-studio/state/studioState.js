// Shared state of the Spectroscopy Simulation Lab: one small external store (pure JS, no React) so that
//   * the shell, the technique tabs, the stepper and every step read and write the SAME experiment,
//   * moving between steps never resets it (steps unmount, the store does not),
//   * the persisted slice can be mirrored to sessionStorage (see StudioContext.jsx) and unit-tested without a DOM.
// Playback (paused, reset token) and the positions of the step animations (store.timeRefs) are session-live only: they are never
// persisted, so a reload never resumes an animation in the middle of an event.
import { B0_DEFAULT, B0_MAX, B0_MIN, clampB0, b0ForMHz, larmorMHz } from "../nmr/physics/constants.js";
import { CW_DEFAULT_OFFSET_HZ, CW_SPAN_HZ, retuneRf, rfFromOffset } from "../nmr/physics/cwResponse.js";
import { MOLECULE_BY_ID } from "../nmr/molecular/model/molecules.js";
import { STEPS, SUB_IDS, clampOp, clampStep, navigate } from "./stepMachine.js";

export { STEPS, SUBSTAGES, OPS } from "./stepMachine.js";

export const TECHNIQUES = [
  { id: "ms", label: "Mass Spectrometry", developed: false },
  { id: "ir", label: "IR Spectroscopy", developed: false },
  { id: "nmr", label: "¹H NMR", developed: true },
  { id: "structure", label: "Structure Investigation", developed: false },
];
export const SPEEDS = [0.25, 0.5, 1, 2];
/** The molecule offered when step 6 is opened and none has been chosen yet. */
export const FIRST_MOLECULE_ID = "ethanol";

export const DEFAULTS = Object.freeze({
  technique: "nmr",
  step: 1,
  sub: "environments", // step 6 inline progression
  mode: "student", // "teacher" | "student"
  speed: 1,
  // chemistry shared by steps 4-6 (null = no molecule chosen yet: step 5 then shows its stated default signal)
  moleculeId: null,
  selectedEnvId: null,
  selectedMultipletId: null,
  // physics
  b0Tesla: B0_DEFAULT,
  nucleus: { sample: false }, // step 1: the proton sample has been shown
  field: { applied: false, popMode: "real" }, // step 2
  rf: { rfMHz: rfFromOffset(CW_DEFAULT_OFFSET_HZ, B0_DEFAULT) }, // step 3
  instrument: { op: 0 }, // step 4
  spectrum: { view: "time" }, // step 5: "time" (FID) | "freq" (spectrum)
  mol: { identified: {}, coupled: false, spinStates: false, integrated: false }, // step 6
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
  const f = isObj(r.field) ? r.field : {}; const rf = isObj(r.rf) ? r.rf : {}; const ins = isObj(r.instrument) ? r.instrument : {};
  const sp = isObj(r.spectrum) ? r.spectrum : {}; const m = isObj(r.mol) ? r.mol : {}; const nu = isObj(r.nucleus) ? r.nucleus : {};
  const b0Tesla = Math.round(num(r.b0Tesla, B0_MIN, B0_MAX, D.b0Tesla) * 10) / 10;
  const moleculeId = typeof r.moleculeId === "string" && MOLECULE_BY_ID[r.moleculeId] ? r.moleculeId : null;
  const identified = {};
  if (isObj(m.identified)) for (const [id, list] of Object.entries(m.identified)) {
    const mol = MOLECULE_BY_ID[id]; if (!mol || !Array.isArray(list)) continue;
    identified[id] = list.filter((e) => mol.environments.some((x) => x.id === e));
  }
  return {
    technique: oneOf(r.technique, TECHNIQUES.map((t) => t.id), D.technique),
    step: clampStep(r.step ?? D.step),
    sub: oneOf(r.sub, SUB_IDS, D.sub),
    mode: oneOf(r.mode, ["teacher", "student"], D.mode),
    speed: oneOf(r.speed, SPEEDS, D.speed),
    moleculeId,
    selectedEnvId: moleculeId ? strOrNull(r.selectedEnvId) : null,
    selectedMultipletId: moleculeId ? strOrNull(r.selectedMultipletId) : null,
    b0Tesla,
    nucleus: { sample: bool(nu.sample, D.nucleus.sample) },
    field: { applied: bool(f.applied, D.field.applied), popMode: oneOf(f.popMode, ["real", "teaching"], D.field.popMode) },
    rf: { rfMHz: Number.isFinite(rf.rfMHz) && Math.abs(rf.rfMHz * 1e6 - larmorMHz(b0Tesla) * 1e6) <= CW_SPAN_HZ + 1 ? rf.rfMHz : rfFromOffset(CW_DEFAULT_OFFSET_HZ, b0Tesla) },
    instrument: { op: clampOp(ins.op ?? 0) },
    spectrum: { view: oneOf(sp.view, ["time", "freq"], D.spectrum.view) },
    mol: { identified, coupled: bool(m.coupled, false), spinStates: bool(m.spinStates, false), integrated: bool(m.integrated, false) },
  };
}

/** The part of the state that is mirrored to sessionStorage. */
export function pickPersisted(s) {
  const { technique, step, sub, mode, speed, moleculeId, selectedEnvId, selectedMultipletId, b0Tesla, nucleus, field, rf, instrument, spectrum, mol } = s;
  return { technique, step, sub, mode, speed, moleculeId, selectedEnvId, selectedMultipletId, b0Tesla, nucleus, field, rf, instrument, spectrum, mol };
}
export const isValidPersisted = (x) => isObj(x) && typeof x.step === "number";

export function createStudioStore(initial) {
  let state = { ...sanitize(initial), paused: false, resetToken: 0 };
  const listeners = new Set();
  const timeRefs = new Map(); // animation id -> progress (not reactive, not persisted)
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
    /** Update one nested slice: store.patch("field", { applied: true }). */
    patch(key, p) { store.set((s) => ({ [key]: { ...s[key], ...p } })); },
    setTechnique: (technique) => store.set({ technique }),
    // ---- navigation (rules in stepMachine.js) ----
    nav(action) {
      store.set((s) => { const n = navigate({ step: s.step, sub: s.sub, op: s.instrument.op }, action); return n.step === s.step && n.sub === s.sub && n.op === s.instrument.op ? {} : { step: n.step, sub: n.sub, instrument: n.op === s.instrument.op ? s.instrument : { ...s.instrument, op: n.op } }; });
    },
    setStep: (step) => store.nav({ type: "goto", step }),
    nextStep: () => store.nav({ type: "next" }),
    prevStep: () => store.nav({ type: "prev" }),
    setSub: (sub) => store.nav({ type: "subGoto", sub }),
    setOp: (op) => store.nav({ type: "opGoto", op }),
    setMode: (mode) => store.set({ mode: mode === "teacher" ? "teacher" : "student" }),
    setSpeed: (speed) => store.set({ speed: SPEEDS.includes(speed) ? speed : 1 }),
    // ---- playback ----
    setPaused: (paused) => store.set({ paused: Boolean(paused) }),
    togglePaused: () => store.set((s) => ({ paused: !s.paused })),
    /** Restart the animation of the active step from its beginning (does not touch the molecule or the chosen B0). */
    resetPlayback: () => { timeRefs.clear(); store.set((s) => ({ paused: false, resetToken: s.resetToken + 1 })); },
    // ---- experiment ----
    /** B0 is the single source of truth; the operating frequency is derived from it, and the RF slider follows the resonance. */
    setB0: (b0) => store.set((s) => {
      const next = Math.round(clampB0(b0) * 10) / 10;
      return next === s.b0Tesla ? {} : { b0Tesla: next, rf: { rfMHz: retuneRf(s.rf.rfMHz, s.b0Tesla, next) } };
    }),
    setOperatingFrequencyMHz: (mhz) => store.setB0(b0ForMHz(mhz)),
    setMolecule: (moleculeId) => store.set((s) => (moleculeId && MOLECULE_BY_ID[moleculeId] ? { moleculeId, selectedEnvId: null, selectedMultipletId: null, mol: { ...s.mol, coupled: false, integrated: false, spinStates: false } } : {})),
    setSelectedEnv: (selectedEnvId) => store.set({ selectedEnvId }),
    setSelectedMultiplet: (selectedMultipletId) => store.set({ selectedMultipletId }),
    getTime: (id, fallback = 0) => timeRefs.get(id) ?? fallback,
    setTime: (id, t) => { timeRefs.set(id, t); },
    /** Full reset of the experiment to the defaults (keeps technique, step, mode and speed). */
    resetExperiment: () => {
      timeRefs.clear();
      store.set((s) => ({ ...sanitize({ technique: s.technique, step: s.step, mode: s.mode, speed: s.speed }), paused: false, resetToken: s.resetToken + 1 }));
    },
  };
  return store;
}

export const operatingFrequencyMHz = (state) => larmorMHz(state.b0Tesla);
export { B0_MIN, B0_MAX, STEPS as STEP_LIST };
