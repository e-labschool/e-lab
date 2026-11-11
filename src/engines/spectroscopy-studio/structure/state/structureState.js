// State of the Structure Investigation tab: one small external store (pure JS, no React), like ms/state/msState.js.
//   * Every unknown (level + compound) has its OWN work record (notebook, tables, answer attempts), so moving between the five stages, or between
//     unknowns, never loses what the student wrote. Stages unmount; the store does not.
//   * Persisted in sessionStorage under the key "studio-structure-v1" (a separate key: the existing "studio-v2", "studio-ir-*" and "studio-ms-v1" payloads
//     are not touched, so saved sessions of the other tabs still load). The payload carries v = STATE_VERSION; a payload with another or no version is
//     migrated by sanitize() (nothing to migrate yet: unknown fields are dropped, bad values replaced by defaults).
//   * Nothing in the persisted slice is random. View state (zoom, hover, selection) is not persisted.
import { COMPOUNDS } from "../data/compounds.js";
import { LEVELS, LEVEL_IDS, compoundsOfLevel } from "../model/levels.js";

export const STATE_VERSION = 1;
export const SESSION_KEY = "studio-structure-v1";
export const STAGES = [
  { id: "sample", n: 1, label: "Sample", title: "Unknown sample" },
  { id: "ms", n: 2, label: "Mass Spectrum", title: "Mass spectrum" },
  { id: "ir", n: 3, label: "IR Spectrum", title: "Infrared spectrum" },
  { id: "nmr", n: 4, label: "¹H NMR", title: "¹H NMR spectrum" },
  { id: "identify", n: 5, label: "Identify Structure", title: "Identify the structure" },
];
export const NOTEBOOK_SECTIONS = [
  { id: "mass", label: "Molecular mass and fragmentation" },
  { id: "groups", label: "Functional groups" },
  { id: "protons", label: "Proton environments" },
  { id: "integ", label: "Integration and splitting" },
  { id: "structs", label: "Possible molecular structures" },
];
export const IR_FIELDS = ["nu", "group", "evidence"];
export const NMR_FIELDS = ["shift", "integ", "split", "assign"];
export const MAX_ROWS = 10; export const MAX_TEXT = 2000; export const MAX_CELL = 90; export const MAX_WORK = 24;

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const str = (x, max) => (typeof x === "string" ? x.slice(0, max) : "");
const bool = (x, d) => (typeof x === "boolean" ? x : d);
const int = (x, lo, hi, d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d);
const oneOf = (x, list, d) => (list.includes(x) ? x : d);

export const emptyRows = (fields, n = 3) => Array.from({ length: n }, () => Object.fromEntries(fields.map((f) => [f, ""])));
export const defaultWork = () => ({
  started: false, visited: { ms: false, ir: false, nmr: false },
  notebook: Object.fromEntries(NOTEBOOK_SECTIONS.map((s) => [s.id, ""])),
  ms: { mEst: "", markers: null, shown: [] },
  ir: { rows: emptyRows(IR_FIELDS), refOpen: false, shown: [] },
  nmr: { rows: emptyRows(NMR_FIELDS), integ: null, d2o: false, shown: [] },
  id: { choice: null, attempts: 0, hints: 0, wrong: [], solved: false, shown: false, justification: "" },
});
export const DEFAULTS = Object.freeze({ v: STATE_VERSION, stage: 1, level: "foundation", idx: { foundation: 0, intermediate: 0, advanced: 0 }, notebookOpen: true, work: {} });

const rowsOf = (raw, fields) => (Array.isArray(raw) ? raw.slice(0, MAX_ROWS).filter(isObj).map((r) => Object.fromEntries(fields.map((f) => [f, str(r[f], MAX_CELL)]))) : null);
function sanitizeWork(raw, key) {
  const r = isObj(raw) ? raw : {}; const D = defaultWork(); const g = (k) => (isObj(r[k]) ? r[k] : {});
  const [level, cid] = key.split("/"); const choices = COMPOUNDS[cid].choices;
  const nb = g("notebook"); const ms = g("ms"); const ir = g("ir"); const nmr = g("nmr"); const id = g("id"); const vis = g("visited");
  const shown = (x) => (Array.isArray(x) ? [...new Set(x.filter((v) => typeof v === "string" && v.length < 24))].slice(0, 6) : []);
  return {
    started: bool(r.started, false), visited: { ms: bool(vis.ms, false), ir: bool(vis.ir, false), nmr: bool(vis.nmr, false) },
    notebook: Object.fromEntries(NOTEBOOK_SECTIONS.map((s) => [s.id, str(nb[s.id], MAX_TEXT)])),
    ms: { mEst: str(ms.mEst, 12), markers: typeof ms.markers === "boolean" ? ms.markers : null, shown: shown(ms.shown) },
    ir: { rows: rowsOf(ir.rows, IR_FIELDS) ?? D.ir.rows, refOpen: bool(ir.refOpen, false), shown: shown(ir.shown) },
    nmr: { rows: rowsOf(nmr.rows, NMR_FIELDS) ?? D.nmr.rows, integ: typeof nmr.integ === "boolean" ? nmr.integ : null, d2o: bool(nmr.d2o, false), shown: shown(nmr.shown) },
    id: {
      choice: choices.includes(id.choice) ? id.choice : null, attempts: int(id.attempts, 0, 99, 0), hints: int(id.hints, 0, getHintMax(level), 0),
      wrong: [...new Set((Array.isArray(id.wrong) ? id.wrong : []).filter((c) => choices.includes(c) && c !== cid))],
      solved: bool(id.solved, false), shown: bool(id.shown, false), justification: str(id.justification, MAX_TEXT),
    },
  };
}
const getHintMax = (levelId) => LEVELS.find((l) => l.id === levelId)?.hints ?? 3;
export const workKey = (level, index) => `${level}/${compoundsOfLevel(level)[index]}`;
const validKey = (k) => { const [l, c] = String(k).split("/"); return LEVEL_IDS.includes(l) && Boolean(COMPOUNDS[c]) && COMPOUNDS[c].level === l; };

export function sanitize(raw) {
  const r = isObj(raw) ? raw : {}; const D = DEFAULTS;
  const level = oneOf(r.level, LEVEL_IDS, D.level);
  const ix = isObj(r.idx) ? r.idx : {};
  const idx = Object.fromEntries(LEVEL_IDS.map((l) => [l, int(ix[l], 0, compoundsOfLevel(l).length - 1, 0)]));
  const work = {};
  if (isObj(r.work)) for (const k of Object.keys(r.work).filter(validKey).slice(0, MAX_WORK)) work[k] = sanitizeWork(r.work[k], k);
  return { v: STATE_VERSION, stage: int(r.stage, 1, STAGES.length, 1), level, idx, notebookOpen: bool(r.notebookOpen, true), work };
}
export const pickPersisted = (s) => ({ v: STATE_VERSION, stage: s.stage, level: s.level, idx: s.idx, notebookOpen: s.notebookOpen, work: s.work });
export const isValidPersisted = (x) => isObj(x) && (x.v === undefined || Number.isFinite(x.v));

export const currentKey = (s) => workKey(s.level, s.idx[s.level]);
export const currentCompoundId = (s) => compoundsOfLevel(s.level)[s.idx[s.level]];
const EMPTY_WORK = defaultWork();
/** The work record of the current unknown (a stable object while nothing changed, so it is safe as a store selector). */
export const workOf = (s) => s.work[currentKey(s)] ?? EMPTY_WORK;

export function createStructureStore(initial) {
  let state = sanitize(initial);
  const listeners = new Set();
  const emit = () => { for (const l of [...listeners]) l(); };
  const set = (patch) => { let changed = false; for (const k of Object.keys(patch)) if (!Object.is(state[k], patch[k])) { changed = true; break; } if (!changed) return; state = { ...state, ...patch }; emit(); };
  /** Update the work record of the current unknown immutably: edit(work) -> new work (or the same object for no change). */
  const editWork = (edit) => {
    const key = currentKey(state); const cur = state.work[key] ?? defaultWork(); const next = edit(cur);
    if (next === cur && state.work[key]) return;
    set({ work: { ...state.work, [key]: next } });
  };
  const sub = (name, patch) => editWork((w) => ({ ...w, [name]: { ...w[name], ...patch } }));
  const store = {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setStage(n) {
      const stage = int(n, 1, STAGES.length, state.stage); const id = STAGES[stage - 1].id;
      set({ stage });
      if (["ms", "ir", "nmr"].includes(id)) editWork((w) => (w.visited[id] ? w : { ...w, visited: { ...w.visited, [id]: true } }));
    },
    nextStage: () => store.setStage(state.stage + 1), prevStage: () => store.setStage(state.stage - 1),
    start() { editWork((w) => ({ ...w, started: true })); store.setStage(2); },
    setLevel(level) { if (LEVEL_IDS.includes(level)) set({ level, stage: 1 }); },
    /** Another unknown of the same level (wraps around); delta = +1 / -1. */
    moveUnknown(delta) { const n = compoundsOfLevel(state.level).length; set({ idx: { ...state.idx, [state.level]: (state.idx[state.level] + delta + n) % n }, stage: 1 }); },
    toggleNotebook: () => set({ notebookOpen: !state.notebookOpen }),
    setNotebookOpen: (v) => set({ notebookOpen: Boolean(v) }),
    setNotebook(section, text) { if (NOTEBOOK_SECTIONS.some((s) => s.id === section)) editWork((w) => ({ ...w, notebook: { ...w.notebook, [section]: str(text, MAX_TEXT) } })); },
    /** Append an OBSERVATION line (never an answer) to a notebook section. */
    appendNotebook(section, line) { if (NOTEBOOK_SECTIONS.some((s) => s.id === section)) editWork((w) => { const cur = w.notebook[section]; return { ...w, notebook: { ...w.notebook, [section]: str(cur ? `${cur}\n${line}` : line, MAX_TEXT) } }; }); },
    setMEst: (v) => sub("ms", { mEst: str(v, 12) }),
    setMarkers: (v) => sub("ms", { markers: Boolean(v) }),
    setIntegration: (v) => sub("nmr", { integ: Boolean(v) }),
    setD2O: (v) => sub("nmr", { d2o: Boolean(v) }),
    setRefOpen: (v) => sub("ir", { refOpen: Boolean(v) }),
    reveal(tech, key) { editWork((w) => (w[tech].shown.includes(key) ? w : { ...w, [tech]: { ...w[tech], shown: [...w[tech].shown, key] } })); },
    hide(tech, key) { editWork((w) => ({ ...w, [tech]: { ...w[tech], shown: w[tech].shown.filter((k) => k !== key) } })); },
    setCell(table, row, field, value) {
      const fields = table === "ir" ? IR_FIELDS : NMR_FIELDS; if (!fields.includes(field)) return;
      editWork((w) => { const rows = w[table].rows.map((r, i) => (i === row ? { ...r, [field]: str(value, MAX_CELL) } : r)); return { ...w, [table]: { ...w[table], rows } }; });
    },
    addRow(table, values = {}) {
      const fields = table === "ir" ? IR_FIELDS : NMR_FIELDS;
      editWork((w) => { if (w[table].rows.length >= MAX_ROWS) return w; const row = Object.fromEntries(fields.map((f) => [f, str(values[f] ?? "", MAX_CELL)])); return { ...w, [table]: { ...w[table], rows: [...w[table].rows, row] } }; });
    },
    /** Put observed values in the first completely empty row (or add a row). */
    fillRow(table, values) {
      const fields = table === "ir" ? IR_FIELDS : NMR_FIELDS;
      editWork((w) => {
        const rows = w[table].rows; const empty = rows.findIndex((r) => fields.every((f) => !r[f]));
        const row = Object.fromEntries(fields.map((f) => [f, str(values[f] ?? "", MAX_CELL)]));
        if (empty >= 0) return { ...w, [table]: { ...w[table], rows: rows.map((r, i) => (i === empty ? row : r)) } };
        return rows.length >= MAX_ROWS ? w : { ...w, [table]: { ...w[table], rows: [...rows, row] } };
      });
    },
    removeRow(table, row) { editWork((w) => (w[table].rows.length <= 1 ? w : { ...w, [table]: { ...w[table], rows: w[table].rows.filter((_, i) => i !== row) } })); },
    choose: (choice) => sub("id", { choice }),
    setJustification: (text) => sub("id", { justification: str(text, MAX_TEXT) }),
    useHint: (max) => editWork((w) => (w.id.hints >= max ? w : { ...w, id: { ...w.id, hints: w.id.hints + 1 } })),
    /** Record the outcome of a submission (correctness is decided by the caller from the compound record). */
    submit(correct) {
      editWork((w) => {
        const choice = w.id.choice; if (!choice || w.id.solved) return w;
        return { ...w, id: { ...w.id, attempts: w.id.attempts + 1, solved: correct ? true : w.id.solved, wrong: correct || w.id.wrong.includes(choice) ? w.id.wrong : [...w.id.wrong, choice] } };
      });
    },
    showSolution: () => sub("id", { shown: true }),
    clearWrong: () => sub("id", { choice: null }),
    /** Reset the whole tab (every unknown, every level) to its start. */
    reset: () => { state = sanitize({}); emit(); },
  };
  return store;
}
