// Builder state, undo/redo history and classification: PURE (no React / three).
//
// Model = ONE central atom + its surrounding atoms / lone pairs ("domains"). A bond of order 1, 2 or 3 is ONE domain.
// A domain is { id, kind: "bond" | "lp", order (bond only), symbol (bond only; null = bond with a free end) }.
//
// History semantics (documented in docs/VSEPR_EXPLORER.md):
//   * every EDIT (add / remove / change order / change element / load / clear) is one undo step;
//   * dragging a domain is a transient perturbation, not an edit: it is not recorded, the model relaxes back;
//   * Clear empties the workspace but stays undoable; Reset returns to the initial empty state AND forgets the history.
import { MAX_DOMAINS, MAX_LONE_PAIRS, axeNotation, axePlain, electronDomainName, formatIdeal, isSupportedCombination, molecularGeometryName, nearestIdealAngle, referenceAngleClasses } from "./geometry.js";
import { matchPreset } from "./presets.js";

export const EMPTY_MODEL = Object.freeze({ central: null, domains: Object.freeze([]), nextId: 1, epoch: 0, hints: Object.freeze({}) });
export const createHistory = () => ({ present: EMPTY_MODEL, past: [], future: [], note: "" });
const HISTORY_LIMIT = 80;

const withEdit = (h, next, note = "") => ({ present: next, past: [...h.past, h.present].slice(-HISTORY_LIMIT), future: [], note });
const bump = (m) => ({ ...m, epoch: m.epoch + 1 });

export const countBonds = (m) => m.domains.filter((d) => d.kind === "bond").length;
export const countLonePairs = (m) => m.domains.filter((d) => d.kind === "lp").length;

/** Pure reducer. Returns a NEW history; `note` carries a short message for refused actions. */
export function historyReducer(h, action) {
  const m = h.present;
  switch (action.type) {
    case "setCentral": {
      if (!action.symbol || m.central === action.symbol) return { ...h, note: "" };
      return withEdit(h, { ...m, central: action.symbol });
    }
    case "add": {
      if (!m.central) return { ...h, note: "Drag an atom into the workspace first: it becomes the central atom." };
      if (m.domains.length >= MAX_DOMAINS) return { ...h, note: `This model supports up to ${MAX_DOMAINS} electron domains.` };
      const id = `d${m.nextId}`;
      const dom = action.kind === "lp" ? { id, kind: "lp" } : { id, kind: "bond", order: [1, 2, 3].includes(action.order) ? action.order : 1, symbol: action.symbol ?? null };
      const hints = action.hint ? { ...m.hints, [id]: action.hint } : m.hints;
      return withEdit(h, { ...m, domains: [...m.domains, dom], nextId: m.nextId + 1, hints });
    }
    case "remove": {
      if (!m.domains.some((d) => d.id === action.id)) return { ...h, note: "" };
      return withEdit(h, { ...m, domains: m.domains.filter((d) => d.id !== action.id) });
    }
    case "setOrder": {
      const d = m.domains.find((x) => x.id === action.id);
      if (!d || d.kind !== "bond" || d.order === action.order || ![1, 2, 3].includes(action.order)) return { ...h, note: "" };
      return withEdit(h, { ...m, domains: m.domains.map((x) => (x.id === action.id ? { ...x, order: action.order } : x)) });
    }
    case "setSymbol": {
      const d = m.domains.find((x) => x.id === action.id);
      if (!d || d.kind !== "bond" || d.symbol === action.symbol) return { ...h, note: "" };
      return withEdit(h, { ...m, domains: m.domains.map((x) => (x.id === action.id ? { ...x, symbol: action.symbol } : x)) });
    }
    case "clear": {
      if (!m.central && !m.domains.length) return { ...h, note: "" };
      return withEdit(h, bump({ ...EMPTY_MODEL, nextId: m.nextId, epoch: m.epoch }));
    }
    case "load": { // a whole molecule (preset); one undo step
      let nextId = m.nextId; const domains = [];
      for (const lig of action.ligands) domains.push({ id: `d${nextId++}`, kind: "bond", order: lig.order, symbol: lig.symbol });
      for (let i = 0; i < action.lonePairs; i += 1) domains.push({ id: `d${nextId++}`, kind: "lp" });
      return withEdit(h, bump({ central: action.central, domains, nextId, epoch: m.epoch, hints: {} }));
    }
    case "undo": {
      if (!h.past.length) return { ...h, note: "" };
      const past = h.past.slice(); const prev = past.pop();
      return { present: prev, past, future: [m, ...h.future], note: "" };
    }
    case "redo": {
      if (!h.future.length) return { ...h, note: "" };
      const [next, ...future] = h.future;
      return { present: next, past: [...h.past, m], future, note: "" };
    }
    case "reset": return { ...createHistory(), present: bump({ ...EMPTY_MODEL, epoch: m.epoch }) };
    default: return h;
  }
}
export const canUndo = (h) => h.past.length > 0;
export const canRedo = (h) => h.future.length > 0;

/** Model -> molecule description. */
export function ligandsOf(m) { return m.domains.filter((d) => d.kind === "bond").map((d) => ({ symbol: d.symbol, order: d.order })); }

/** Everything the info panel needs. */
export function classify(m) {
  if (!m.central) return { hasCentral: false, b: 0, l: 0, n: 0, empty: true };
  const b = countBonds(m); const l = countLonePairs(m); const n = b + l;
  const complete = m.domains.every((d) => d.kind === "lp" || d.symbol);
  const supported = isSupportedCombination(b, l);
  const preset = complete ? matchPreset(m.central, ligandsOf(m), l) : null;
  const ed = electronDomainName(n); const mg = supported || (b === 1 && l === 0) ? molecularGeometryName(b, l) : null;
  const out = {
    hasCentral: true, empty: false, central: m.central, b, l, n, supported, preset, complete,
    axe: n ? axeNotation(b, l) : "A", axePlain: n ? axePlain(b, l) : "A", ed, mg,
    idealisedModel: !preset, warnings: [],
  };
  if (n === 0) out.warnings.push("Add a bond or a lone pair to see electron domains.");
  if (b === 0 && l > 0) out.warnings.push("Lone pairs only: add at least one bonded atom to define a molecular shape.");
  if (b >= 1 && !supported && n >= 2) {
    out.warnings.push(n > MAX_DOMAINS ? `More than ${MAX_DOMAINS} domains are not supported.` : `${axePlain(b, l)} with ${l} lone pairs on ${n} domains is not a recognised VSEPR case (this model allows up to ${MAX_LONE_PAIRS[n] ?? 0}).`);
  }
  out.angles = angleInfo(b, l, preset);
  return out;
}

/** Angle text for the info panel. Presets: validated values (ideal vs approximate); free builds: the idealised model only. */
export function angleInfo(b, l, preset) {
  if (preset) return { source: "preset", entries: preset.angles.map((a) => ({ value: a.value, label: a.label, text: `${a.kind === "approx" ? "≈ " : ""}${a.value}°`, kind: a.kind, note: a.note })), summary: preset.angles.map((a) => `${a.kind === "approx" ? "≈" : ""}${a.value}°`).join(", ") };
  if (b < 2 || b + l < 2 || !isSupportedCombination(b, l)) return { source: "none", entries: [], summary: b === 1 ? "none (only one bonded atom)" : "–" };
  const entries = referenceAngleClasses(b, l).map((c) => {
    const ideal = nearestIdealAngle(c.deg);
    return l === 0 ? { value: c.deg, label: "ideal", text: `${formatIdeal(ideal)}°`, kind: "ideal" } : { value: c.deg, label: "idealised", text: `< ${formatIdeal(ideal)}°`, kind: "lessthan", note: "lone pairs squeeze bond angles; the exact value depends on the atoms" };
  });
  return { source: "ideal", entries, summary: entries.map((e) => e.text).join(", ") };
}

export function modelFromPreset(p) {
  return { central: p.central, ligands: p.ligands, lonePairs: p.lonePairs };
}

/** "Why this shape?" text. Preset explanation when available, otherwise generated from the domain counts. */
export function explainShape(c) {
  if (!c.hasCentral || c.n < 2) return "Build a central atom with at least two electron domains (bonds or lone pairs) to see why the shape forms.";
  if (c.preset) return c.preset.explain;
  const base = `${c.n} electron domains repel each other and spread as far apart as possible: ${c.ed?.toLowerCase()} arrangement. A single, double or triple bond is one domain.`;
  if (!c.mg) return base;
  if (c.l === 0) return `${base} All domains are bonding pairs, so the molecular geometry is the same: ${c.mg.toLowerCase()}.`;
  return `${base} ${c.l} of the ${c.n} domains ${c.l === 1 ? "is a lone pair" : "are lone pairs"}. Lone pairs are not atoms, so the molecular geometry is ${c.mg.toLowerCase()}. Repulsion ranks lone pair–lone pair > lone pair–bonding pair > bonding pair–bonding pair, so bond angles close slightly.`;
}
