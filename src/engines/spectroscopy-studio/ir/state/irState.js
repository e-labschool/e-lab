// Shared state of the IR workspace: one small external store (pure JS, no React), exactly like state/studioState.js for NMR.
//   * every stage reads and writes the SAME experiment, so moving between stages never resets it (stages unmount, the store does not);
//   * the persisted slice is mirrored to sessionStorage by IrContext.jsx and can be unit-tested without a DOM;
//   * Play / Pause, speed, replay tokens and Teacher / Student mode are NOT here: they are shared with the NMR workspace (the studio store) so the
//     header switch and the bottom transport behave identically in both techniques.
import { EXPLORER_MOLECULES } from "../physics/modeCatalog.js";
import { SPEC_GROUPS, INTERPRET_GROUPS } from "../physics/functionalGroups.js";
import { INTERPRET_SET } from "../data/compounds.js";

export const IR_STAGES = [
  { id: "vibrate", n: 1, label: "Vibrations", title: "How Molecules Vibrate" },
  { id: "types", n: 2, label: "Types", title: "Types of Molecular Vibrations" },
  { id: "absorb", n: 3, label: "Absorption", title: "Interaction with Infrared Radiation" },
  { id: "explorer", n: 4, label: "Explorer", title: "Molecular Vibration Explorer" },
  { id: "ftir", n: 5, label: "FTIR", title: "How an IR Spectrometer Works" },
  { id: "build", n: 6, label: "Spectrum", title: "Building an IR Spectrum" },
  { id: "groups", n: 7, label: "Groups", title: "Functional Group Identification" },
  { id: "interpret", n: 8, label: "Interpret", title: "Interactive Spectrum Interpretation" },
  { id: "unknown", n: 9, label: "Unknown", title: "Unknown Compound Challenge" },
];
export const IR_STAGE_COUNT = IR_STAGES.length;
export const FTIR_OPS = [
  { id: "source", short: "Source", label: "IR source" },
  { id: "interferometer", short: "Interferometer", label: "Interferometer" },
  { id: "sample", short: "Sample", label: "Sample" },
  { id: "detector", short: "Detector", label: "Detector" },
  { id: "computer", short: "Computer", label: "Computer (Fourier transform)" },
  { id: "spectrum", short: "Spectrum", label: "IR spectrum" },
];
export const TRANSPORT_IR = { play: true, reset: true, speed: true };
export const NU_MIN = 400; export const NU_MAX = 4000;

export const DEFAULTS = Object.freeze({
  stage: 1,
  s1: { mol: "hcl" },
  s2: { mol: "h2o", type: "sym" },
  s3: { mol: "hcl", mode: "stretch", nu: 3400 },
  s4: { mol: "h2o", mode: "sym" },
  s5: { op: 0 },
  s6: { mol: "h2o", sel: null },
  s7: { group: "cdo" },
  s8: { compound: "ethanol", band: null, pick: null, fingerprint: false },
  s9: { seed: 1, round: 0, choice: null, reveal: 0, cursor: null },
});

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const oneOf = (x, list, d) => (list.includes(x) ? x : d);
const int = (x, lo, hi, d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d);
export const clampStage = (n) => int(n, 1, IR_STAGE_COUNT, 1);

export function sanitize(raw, modesOf) {
  const r = isObj(raw) ? raw : {}; const D = DEFAULTS;
  const g = (k) => (isObj(r[k]) ? r[k] : {});
  const molOK = (id, list) => oneOf(id, list, null);
  const modeOK = (mol, mode, d) => (modesOf(mol).includes(mode) ? mode : d);
  const s1 = molOK(g("s1").mol, ["hcl", "h2o", "co2"]) ?? D.s1.mol;
  const s2m = molOK(g("s2").mol, ["h2o", "co2"]) ?? D.s2.mol;
  const s3m = molOK(g("s3").mol, ["hcl", "h2o", "co2", "n2"]) ?? D.s3.mol;
  const s4m = molOK(g("s4").mol, EXPLORER_MOLECULES) ?? D.s4.mol;
  const s6m = molOK(g("s6").mol, ["h2o", "co2", "hcl", "ch4"]) ?? D.s6.mol;
  const s8c = oneOf(g("s8").compound, INTERPRET_SET, D.s8.compound);
  return {
    stage: clampStage(r.stage ?? D.stage),
    s1: { mol: s1 },
    s2: { mol: s2m, type: oneOf(g("s2").type, ["sym", "asym", "bend"], D.s2.type) },
    s3: { mol: s3m, mode: modeOK(s3m, g("s3").mode, modesOf(s3m)[0]), nu: int(g("s3").nu, NU_MIN, NU_MAX, D.s3.nu) },
    s4: { mol: s4m, mode: modeOK(s4m, g("s4").mode, modesOf(s4m)[0]) },
    s5: { op: int(g("s5").op, 0, FTIR_OPS.length - 1, 0) },
    s6: { mol: s6m, sel: modeOK(s6m, g("s6").sel, null) },
    s7: { group: oneOf(g("s7").group, SPEC_GROUPS.map((x) => x.id), D.s7.group) },
    s8: { compound: s8c, band: g("s8").band === null ? null : int(g("s8").band, 0, 40, null), pick: oneOf(g("s8").pick, INTERPRET_GROUPS.map((x) => x.id).concat(["none"]), null), fingerprint: typeof g("s8").fingerprint === "boolean" ? g("s8").fingerprint : false },
    s9: { seed: int(g("s9").seed, 1, 9999, D.s9.seed), round: int(g("s9").round, 0, 999, 0), choice: typeof g("s9").choice === "string" && g("s9").choice.length < 40 ? g("s9").choice : null, reveal: int(g("s9").reveal, 0, 3, 0), cursor: Number.isFinite(g("s9").cursor) ? g("s9").cursor : null },
  };
}
export const pickPersisted = (s) => ({ stage: s.stage, s1: s.s1, s2: s.s2, s3: s.s3, s4: s.s4, s5: s.s5, s6: s.s6, s7: s.s7, s8: s.s8, s9: s.s9 });
export const isValidPersisted = (x) => isObj(x) && typeof x.stage === "number";

export function createIrStore(initial, modesOf) {
  let state = sanitize(initial, modesOf);
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
    // molecule changes reset the mode to that molecule's first mode so the pair is always valid
    setS3Mol: (mol) => store.patch("s3", { mol, mode: modesOf(mol)[0] }),
    setS4Mol: (mol) => store.patch("s4", { mol, mode: modesOf(mol)[0] }),
    setS6Mol: (mol) => store.patch("s6", { mol, sel: null }),
    setS8Compound: (compound) => store.patch("s8", { compound, band: null, pick: null }),
    selectBand: (band) => store.patch("s8", { band, pick: null }),
    nextRound: () => store.set((s) => ({ s9: { ...s.s9, round: s.s9.round + 1, choice: null, reveal: 0, cursor: null } })),
    newSeries: () => store.set((s) => ({ s9: { ...s.s9, seed: s.s9.seed + 1, round: 0, choice: null, reveal: 0, cursor: null } })),
    reset: () => store.set({ ...sanitize({ stage: state.stage }, modesOf) }),
  };
  return store;
}
