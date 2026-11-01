// Orbital Lab workspace state: atoms (each with its own configuration, selection, hybridisation, position and rotation),
// the reducer with undo history, and the derived bond analysis. Pure (no React / three).
import { atomicState, canExcite, promotionsFor, NO_PROMOTION_REASON, SELECTABLE_SYMBOLS } from "./elements.js";
import { mixOrbitals, analyseSelection, RECIPES } from "./hybrids.js";
import { atomOrbitalInstances, analyseBonds } from "./overlap.js";
import { planSnap } from "./snap.js";
import { QI } from "./vec.js";

export const SPACING = 3.6;

export function createAtom(id, symbol, pos = [0, 0, 0], kind = "ground", promotionId = null) {
  const state = atomicState(symbol, kind, promotionId);
  return { id, symbol, kind: state.kind, promotionId: state.promotionId, state, orbitals: state.orbitals, selected: [], hybrid: null, pos, quat: QI };
}
const cloneAtom = (a) => ({ ...a, selected: [...a.selected], hybrid: a.hybrid ? { ...a.hybrid } : null });

export function initialPresent() {
  return { atoms: [createAtom("a1", "C")], activeId: "a1", nextId: 2, note: "" };
}
export function createHistory() { return { past: [], present: initialPresent(), gesture: null }; }

const slotPos = (k) => [(k % 4) * SPACING, -Math.floor(k / 4) * SPACING, 0];

/** Atom label for messages: "C", or "C2" when several carbons exist. */
export function atomLabel(atoms, atom) {
  const same = atoms.filter((a) => a.symbol === atom.symbol);
  return same.length > 1 ? `${atom.symbol}${same.indexOf(atom) + 1}` : atom.symbol;
}
const active = (p) => p.atoms.find((a) => a.id === p.activeId);
const setAtom = (p, id, patch) => ({ ...p, atoms: p.atoms.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
const push = (h, present) => ({ ...h, past: [...h.past, h.present], present });

/** What the controls show for the active atom: selection analysis, excitation availability, mix availability. */
export function describeActive(atom) {
  const unhybridised = atom.orbitals.filter((o) => !(atom.hybrid && atom.hybrid.consumed.includes(o.id)));
  const atomicSel = atom.selected.filter((id) => atom.orbitals.some((o) => o.id === id));
  const selOrbs = atomicSel.map((id) => atom.orbitals.find((o) => o.id === id));
  const analysis = analyseSelection(selOrbs);
  let mix = { enabled: false, reason: analysis.reason };
  if (atom.hybrid) mix = { enabled: false, reason: "This atom is already hybridised. Undo, or switch Ground/Excited, to start again." };
  else if (atom.selected.some((id) => !atom.orbitals.some((o) => o.id === id))) mix = { enabled: false, reason: "Hybrid orbitals cannot be mixed again; select atomic orbitals." };
  else if (analysis.ok) mix = { enabled: true, reason: "", recipeId: analysis.recipeId };
  const list = promotionsFor(atom.symbol);
  return {
    selection: selOrbs, analysis, mix, unhybridised,
    canExcite: canExcite(atom.symbol), noPromotionReason: canExcite(atom.symbol) ? "" : NO_PROMOTION_REASON[atom.symbol] ?? "No valence promotion is defined for this element.",
    promotions: list,
  };
}
/** "2s + 2px + 2py → sp²" as {parts:[latex...], result: latex|null, ok}. */
export function selectionSummary(atom) {
  const d = describeActive(atom);
  const sel = [...d.selection].sort((a, b) => ["s", "px", "py", "pz", "dz2", "dx2-y2", "dxy", "dxz", "dyz"].indexOf(a.kind) - ["s", "px", "py", "pz", "dz2", "dx2-y2", "dxy", "dxz", "dyz"].indexOf(b.kind));
  const hybridSel = atom.selected.filter((id) => !atom.orbitals.some((o) => o.id === id));
  return { parts: sel.map((o) => o.latex), hybridCount: hybridSel.length, result: d.analysis.ok ? RECIPES[d.analysis.recipeId].latex : null, ok: d.analysis.ok, reason: d.analysis.reason };
}

export function reduce(h, action) {
  const p = h.present;
  switch (action.type) {
    case "setSymbol": {
      if (!SELECTABLE_SYMBOLS.includes(action.symbol)) return h;
      const a = active(p); if (!a || a.symbol === action.symbol) return h;
      const fresh = createAtom(a.id, action.symbol, a.pos);
      return push(h, { ...setAtom(p, a.id, { ...fresh, quat: a.quat }), note: "" });
    }
    case "setKind": {
      const a = active(p); if (!a) return h;
      if (action.kind === "excited" && !canExcite(a.symbol)) return { ...h, present: { ...p, note: NO_PROMOTION_REASON[a.symbol] ?? "No valence promotion is defined for this element." } };
      const fresh = createAtom(a.id, a.symbol, a.pos, action.kind, action.promotionId ?? null);
      if (fresh.kind === a.kind && fresh.promotionId === a.promotionId) return h;
      return push(h, { ...setAtom(p, a.id, { ...fresh, quat: a.quat }), note: "" });
    }
    case "setActive": return p.activeId === action.id || !p.atoms.some((a) => a.id === action.id) ? h : { ...h, present: { ...p, activeId: action.id } };
    case "toggleOrbital": {
      const a = p.atoms.find((x) => x.id === (action.atomId ?? p.activeId)); if (!a) return h;
      const sel = a.selected.includes(action.orbId) ? a.selected.filter((x) => x !== action.orbId) : [...a.selected, action.orbId];
      return { ...h, present: { ...setAtom(p, a.id, { selected: sel }), activeId: a.id, note: "" } };
    }
    case "setSelection": {
      const a = active(p); if (!a) return h;
      return { ...h, present: { ...setAtom(p, a.id, { selected: [...action.ids] }), note: "" } };
    }
    case "clearSelection": { const a = active(p); return a && a.selected.length ? { ...h, present: setAtom(p, a.id, { selected: [] }) } : h; }
    case "mix": {
      const a = active(p); if (!a) return h;
      const d = describeActive(a);
      if (!d.mix.enabled) return { ...h, present: { ...p, note: d.mix.reason } };
      const r = mixOrbitals(a.orbitals, a.selected.filter((id) => a.orbitals.some((o) => o.id === id)));
      if (!r.ok) return { ...h, present: { ...p, note: r.reason } };
      if (r.hybrids.length !== r.consumed.length) throw new Error("orbital number not conserved");
      const hybrid = { recipeId: r.recipeId, consumed: r.consumed, remaining: r.remaining, hybrids: r.hybrids, totalElectrons: r.totalElectrons };
      return push(h, { ...setAtom(p, a.id, { hybrid, selected: [] }), note: "" });
    }
    case "addAtom": {
      const symbol = action.symbol ?? "H"; const id = `a${p.nextId}`;
      const at = createAtom(id, symbol, action.pos ?? slotPos(p.atoms.length));
      return push(h, { ...p, atoms: [...p.atoms, at], activeId: id, nextId: p.nextId + 1, note: "" });
    }
    case "duplicate": {
      const a = active(p); if (!a) return h; const id = `a${p.nextId}`;
      const at = { ...cloneAtom(a), id, pos: action.pos ?? slotPos(p.atoms.length), selected: [] };
      return push(h, { ...p, atoms: [...p.atoms, at], activeId: id, nextId: p.nextId + 1, note: "" });
    }
    case "remove": {
      if (p.atoms.length <= 1) return h; const atoms = p.atoms.filter((a) => a.id !== (action.id ?? p.activeId));
      return push(h, { ...p, atoms, activeId: atoms.some((a) => a.id === p.activeId) ? p.activeId : atoms[atoms.length - 1].id, note: "" });
    }
    // ---- drag / rotate: transient updates inside one gesture; ONE undo step per gesture
    case "gestureStart": return h.gesture ? h : { ...h, gesture: { atoms: p.atoms, activeId: p.activeId } };
    case "transform": {
      const patch = {}; if (action.pos) patch.pos = action.pos; if (action.quat) patch.quat = action.quat;
      return { ...h, present: { ...setAtom(p, action.id, patch), activeId: action.id } };
    }
    case "gestureEnd": {
      const g = h.gesture; if (!g) return h;
      const moved = p.atoms.some((a) => { const b = g.atoms.find((x) => x.id === a.id); return !b || a.pos.some((v, i) => Math.abs(v - b.pos[i]) > 1e-6) || a.quat.some((v, i) => Math.abs(v - b.quat[i]) > 1e-6); });
      return moved ? { ...h, gesture: null, past: [...h.past, { ...h.present, atoms: g.atoms, activeId: g.activeId }] } : { ...h, gesture: null };
    }
    case "applyTransform": { // snap result: one undo step
      return push(h, { ...setAtom(p, action.id, { pos: action.pos, quat: action.quat }), activeId: action.id, note: action.note ?? "" });
    }
    case "note": return { ...h, present: { ...p, note: action.note } };
    case "undo": {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1]; return { past: h.past.slice(0, -1), present: { ...prev, note: "" }, gesture: null };
    }
    case "reset": return createHistory();
    case "load": return { past: [], present: action.present, gesture: null };
    default: return h;
  }
}

/** Derived: oriented instances and detected bonds of the whole workspace. */
export function analyseWorkspace(atoms) {
  const instances = atoms.flatMap(atomOrbitalInstances);
  return { instances, ...analyseBonds(instances) };
}
export function snapActive(atoms, id) { return planSnap(atoms, id); }
export { SELECTABLE_SYMBOLS };
