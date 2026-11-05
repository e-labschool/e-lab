// Shared state of the Mass Spectrometry workspace: one small external store (pure JS, no React), exactly like state/studioState.js (NMR) and ir/state/irState.js.
//   * every stage reads and writes the SAME experiment, so moving between stages never resets it (stages unmount, the store does not);
//   * the persisted slice is mirrored to sessionStorage by MsContext.jsx and can be unit-tested without a DOM;
//   * Play / Pause, speed, replay tokens and Teacher / Student mode are NOT here: they are shared with the NMR workspace (the studio store).
import { SECTOR, tunedField } from "../physics/sector.js";
import { TOF } from "../physics/tof.js";
import { SPECTRUM_IDS } from "../data/spectra.js";
import { PATHWAYS } from "../data/fragmentation.js";
import { EXAMPLES, TECHNIQUES_ORDER } from "../data/evidence.js";
import { CANDIDATES, EMPTY_PICKS, ROUNDS } from "../physics/challenge.js";

export const MS_STAGES = [
  { id: "intro", n: 1, label: "Introduction", title: "What Does Mass Spectrometry Measure?" },
  { id: "sample", n: 2, label: "Sample", title: "Sample Introduction" },
  { id: "ionise", n: 3, label: "Ionisation", title: "Ionisation: Formation of Positive Ions" },
  { id: "fragment", n: 4, label: "Fragments", title: "Fragmentation of Molecular Ions" },
  { id: "accelerate", n: 5, label: "Acceleration", title: "Acceleration of Positive Ions" },
  { id: "sector", n: 6, label: "Separation", title: "Separation by Mass-to-Charge Ratio" },
  { id: "tof", n: 7, label: "Time of flight", title: "Time-of-Flight Mass Spectrometry" },
  { id: "detect", n: 8, label: "Detection", title: "Detection: How Does a Peak Form?" },
  { id: "spectrum", n: 9, label: "Spectrum", title: "Constructing a Mass Spectrum" },
  { id: "isotopes", n: 10, label: "Isotopes", title: "Isotopes and Relative Atomic Mass" },
  { id: "patterns", n: 11, label: "Patterns", title: "Molecular Isotope Patterns" },
  { id: "unknown", n: 12, label: "Unknown", title: "Identify Unknown Compounds" },
  { id: "compare", n: 13, label: "Compare", title: "Compare Mass Spectrometry with IR and NMR" },
];
export const MS_STAGE_COUNT = MS_STAGES.length;
export const TRANSPORT_MS = { play: true, reset: true, speed: true };
export const SECTOR_MZ_CHOICES = [12, 15, 16, 31, 43, 58];
export const PATTERN_COMPOUNDS = ["cl2", "ch3cl", "ch2cl2", "chcl3", "ch3br", "br2"];
export const V_MIN = SECTOR.V_MIN; export const V_MAX = SECTOR.V_MAX; export const V_DEFAULT = 2000;

export const DEFAULTS = Object.freeze({
  stage: 1,
  V: V_DEFAULT,
  s2: { released: false },
  s3: { fired: false },
  s4: { path: "ch3" },
  s6: { mz: 16, B: Math.round(tunedField(16, V_DEFAULT) * 1000) / 1000 },
  s7: { massX: 58, started: false },
  s8: { started: false },
  s9: { sel: null },
  s10: { p35: 75 },
  s11: { compound: "cl2", model: "teaching", sel: null },
  s12: { seed: 1, round: 0, task: 1, sel: null, picks: EMPTY_PICKS, submitted: false },
  s13: { example: "ethanol", revealed: [] },
});

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const oneOf = (x, list, d) => (list.includes(x) ? x : d);
const int = (x, lo, hi, d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d);
const num = (x, lo, hi, d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const bool = (x, d) => (typeof x === "boolean" ? x : d);
export const clampStage = (n) => int(n, 1, MS_STAGE_COUNT, 1);

export function sanitize(raw) {
  const r = isObj(raw) ? raw : {}; const D = DEFAULTS; const g = (k) => (isObj(r[k]) ? r[k] : {});
  const V = Math.round(num(r.V, V_MIN, V_MAX, D.V) / 50) * 50;
  const s12 = g("s12"); const round = int(s12.round, 0, ROUNDS.length - 1, 0); const roundId = ROUNDS[round];
  const ids = CANDIDATES[roundId].map((c) => c.id);
  const mzs = (list) => (Array.isArray(list) ? [...new Set(list.filter((x) => Number.isInteger(x) && x > 0 && x < 400))].slice(0, 12) : []);
  const p = isObj(s12.picks) ? s12.picks : {};
  return {
    stage: clampStage(r.stage ?? D.stage),
    V,
    s2: { released: bool(g("s2").released, false) },
    s3: { fired: bool(g("s3").fired, false) },
    s4: { path: oneOf(g("s4").path, PATHWAYS.map((x) => x.id), D.s4.path) },
    s6: { mz: oneOf(g("s6").mz, SECTOR_MZ_CHOICES, D.s6.mz), B: Math.round(num(g("s6").B, SECTOR.B_MIN, SECTOR.B_MAX, D.s6.B) * 1000) / 1000 },
    s7: { massX: int(g("s7").massX, TOF.MASS_MIN, TOF.MASS_MAX, D.s7.massX), started: bool(g("s7").started, false) },
    s8: { started: bool(g("s8").started, false) },
    s9: { sel: Number.isInteger(g("s9").sel) ? g("s9").sel : null },
    s10: { p35: Math.round(num(g("s10").p35, 0, 100, D.s10.p35) * 100) / 100 },
    s11: { compound: oneOf(g("s11").compound, PATTERN_COMPOUNDS, D.s11.compound), model: oneOf(g("s11").model, ["teaching", "natural"], D.s11.model), sel: Number.isInteger(g("s11").sel) ? g("s11").sel : null },
    s12: {
      seed: int(s12.seed, 1, 9999, 1), round, task: int(s12.task, 1, 5, 1), sel: Number.isInteger(s12.sel) ? s12.sel : null,
      picks: { t1: Number.isInteger(p.t1) ? p.t1 : null, t2: Number.isInteger(p.t2) ? p.t2 : null, t3: mzs(p.t3), t4: oneOf(p.t4, ["none", "cl", "br"], null), t5: oneOf(p.t5, ids, null) },
      submitted: bool(s12.submitted, false),
    },
    s13: { example: oneOf(g("s13").example, EXAMPLES, D.s13.example), revealed: Array.isArray(g("s13").revealed) ? TECHNIQUES_ORDER.filter((t) => g("s13").revealed.includes(t)) : [] },
  };
}
export const pickPersisted = (s) => ({ stage: s.stage, V: s.V, s2: s.s2, s3: s.s3, s4: s.s4, s6: s.s6, s7: s.s7, s8: s.s8, s9: s.s9, s10: s.s10, s11: s.s11, s12: s.s12, s13: s.s13 });
export const isValidPersisted = (x) => isObj(x) && typeof x.stage === "number";

export function createMsStore(initial) {
  let state = sanitize(initial);
  const listeners = new Set();
  const emit = () => { for (const l of [...listeners]) l(); };
  const store = {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(patchOrFn) {
      const patch = typeof patchOrFn === "function" ? patchOrFn(state) : patchOrFn;
      let changed = false; for (const k of Object.keys(patch)) if (!Object.is(state[k], patch[k])) { changed = true; break; }
      if (!changed) return; state = { ...state, ...patch }; emit();
    },
    patch(key, p) { store.set((s) => { const next = { ...s[key], ...p }; const same = Object.keys(next).every((k) => Object.is(next[k], s[key][k])); return same ? {} : { [key]: next }; }); },
    setStage: (n) => store.set({ stage: clampStage(n) }),
    nextStage: () => store.set((s) => ({ stage: clampStage(s.stage + 1) })),
    prevStage: () => store.set((s) => ({ stage: clampStage(s.stage - 1) })),
    setV: (V) => store.set({ V: Math.round(num(V, V_MIN, V_MAX, DEFAULTS.V) / 50) * 50 }),
    setB: (B) => store.patch("s6", { B: Math.round(num(B, SECTOR.B_MIN, SECTOR.B_MAX, DEFAULTS.s6.B) * 1000) / 1000 }),
    selectMz: (mz) => store.patch("s6", { mz }),
    /** set B so that the selected m/z reaches the detector (for the present accelerating voltage) */
    tuneB: () => store.set((s) => ({ s6: { ...s.s6, B: Math.round(num(tunedField(s.s6.mz, s.V), SECTOR.B_MIN, SECTOR.B_MAX, s.s6.B) * 1000) / 1000 } })),
    // stage 12
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
    // stage 13
    setExample: (example) => store.patch("s13", { example, revealed: [] }),
    toggleEvidence: (tech) => store.set((s) => {
      const has = s.s13.revealed.includes(tech);
      const revealed = TECHNIQUES_ORDER.filter((t) => (t === tech ? !has : s.s13.revealed.includes(t)));
      return { s13: { ...s.s13, revealed } };
    }),
    reset: () => store.set({ ...sanitize({ stage: state.stage }) }),
  };
  return store;
}
export const roundId = (s) => ROUNDS[s.s12.round];
export { SPECTRUM_IDS };
