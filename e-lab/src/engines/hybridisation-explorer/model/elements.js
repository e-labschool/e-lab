// Element valence configurations + validated illustrative promotions for the Hybridisation Explorer.
// Pure (no React / three). GROUND STATES come from the shared, validated electron-configuration engine
// (src/engines/electron-configuration/logic/buildConfiguration.js + src/data/chemistry); nothing is hard-coded per element.
// Only the EXCITED (promoted) valence occupancies are defined here, as an explicit, validated table.
import { buildConfiguration, SUBSHELL_LETTERS } from "../../electron-configuration/logic/buildConfiguration.js";
import { getElementBySymbol } from "../../../data/chemistry/elements.js";
import { makeOrbital, P_KINDS, D_KINDS } from "./orbitals.js";

export const SELECTABLE_SYMBOLS = ["H", "Be", "B", "C", "N", "O", "F", "Si", "P", "S", "Cl", "Xe"];

/** Valence orbitals modelled for a shell: 1s | ns + np (n >= 2) | + nd (n >= 3). */
export function valenceKinds(n) {
  const kinds = ["s"];
  if (n >= 2) kinds.push(...P_KINDS);
  if (n >= 3) kinds.push(...D_KINDS);
  return kinds;
}

/**
 * Excited-state illustrations. Each entry is an explicit valence occupancy ({orbitalId: electrons}); every other valence
 * orbital is empty. They are NOT derived to fit a requested hybridisation. `disabled` elements have no entry on purpose.
 * Rule enforced by validateExcitation: same shell n, electrons only move to a HIGHER subshell (s < p < d), count conserved,
 * Hund's rule respected in every subshell.
 */
export const PROMOTIONS = {
  Be: [{ id: "2s1-2p1", occupancy: { "2s": 1, "2px": 1 }, model: "sp", example: "BeCl₂ (2 bonds)" }],
  B: [{ id: "2s1-2p2", occupancy: { "2s": 1, "2px": 1, "2py": 1 }, model: "sp2", example: "BF₃ (3 bonds)" }],
  C: [{ id: "2s1-2p3", occupancy: { "2s": 1, "2px": 1, "2py": 1, "2pz": 1 }, model: "sp3", example: "CH₄, C₂H₄, C₂H₂ (4 bonds)" }],
  Si: [{ id: "3s1-3p3", occupancy: { "3s": 1, "3px": 1, "3py": 1, "3pz": 1 }, model: "sp3", example: "SiH₄ (4 bonds)" }],
  P: [{ id: "3s1-3p3-3d1", occupancy: { "3s": 1, "3px": 1, "3py": 1, "3pz": 1, "3dz2": 1 }, model: "sp3d", example: "PCl₅ (traditional model)" }],
  S: [
    { id: "3s2-3p3-3d1", occupancy: { "3s": 2, "3px": 1, "3py": 1, "3pz": 1, "3dz2": 1 }, model: "sp3d", example: "SF₄ (traditional model)" },
    { id: "3s1-3p3-3d2", occupancy: { "3s": 1, "3px": 1, "3py": 1, "3pz": 1, "3dz2": 1, "3dx2-y2": 1 }, model: "sp3d2", example: "SF₆ (traditional model)" },
  ],
  Cl: [
    { id: "3s2-3p4-3d1", occupancy: { "3s": 2, "3px": 2, "3py": 1, "3pz": 1, "3dz2": 1 }, model: "sp3d", example: "ClF₃ (traditional model)" },
    { id: "3s2-3p3-3d2", occupancy: { "3s": 2, "3px": 1, "3py": 1, "3pz": 1, "3dz2": 1, "3dx2-y2": 1 }, model: "sp3d2", example: "ClF₅ (traditional model)" },
  ],
  Xe: [
    { id: "5s2-5p5-5d1", occupancy: { "5s": 2, "5px": 2, "5py": 2, "5pz": 1, "5dz2": 1 }, model: "sp3d", example: "XeF₂ (traditional model)" },
    { id: "5s2-5p4-5d2", occupancy: { "5s": 2, "5px": 2, "5py": 1, "5pz": 1, "5dz2": 1, "5dx2-y2": 1 }, model: "sp3d2", example: "XeF₄ (traditional model)" },
  ],
};

export const NO_PROMOTION_REASON = {
  H: "Hydrogen has only the 1s orbital: there is nothing to promote into, and it already has one unpaired electron.",
  N: "Nitrogen (2s² 2p³) already has three unpaired 2p electrons for three bonds; the n = 2 shell has no empty orbital left to promote into (there is no 2d).",
  O: "Oxygen (2s² 2p⁴) already has two unpaired electrons for two bonds; promotion within n = 2 is impossible (no 2d), so no valence promotion is relevant.",
  F: "Fluorine (2s² 2p⁵) already has one unpaired electron for one bond; promotion within n = 2 is impossible (no 2d), so no valence promotion is relevant.",
};

/** Build the valence orbital list of an element for the given occupancy map (default: ground state from the shared engine). */
export function groundState(symbol) {
  const el = getElementBySymbol(symbol);
  if (!el) throw new Error(`unknown element ${symbol}`);
  const cfg = buildConfiguration(el.atomicNumber);
  const n = Math.max(...cfg.subshellsDisplayOrder.map((s) => s.n));
  const kinds = valenceKinds(n);
  const sub = (l) => cfg.orbitals.find((s) => s.n === n && s.l === l);
  // s and p occupancies (with Hund's-rule spin distribution) come straight from the shared engine; no valence d electrons
  // exist for any selectable element (the 3d / 5d boxes are empty and only filled by a defined promotion).
  const orbitals = kinds.map((kind) => {
    const l = kind === "s" ? 0 : kind[0] === "p" ? 1 : 2;
    const s = l <= 1 ? sub(l) : null;
    const electrons = s ? (s.orbitals[l === 0 ? 0 : P_KINDS.indexOf(kind)]?.electrons ?? 0) : 0;
    return makeOrbital(n, kind, electrons);
  });
  const valenceElectrons = orbitals.reduce((a, o) => a + o.electrons, 0);
  return { symbol, Z: el.atomicNumber, name: el.name, n, kind: "ground", promotionId: null, orbitals, valenceElectrons, core: Z_CORE(cfg, n), fullConfiguration: cfg.configurationString, label: "Ground state" };
}

// Everything that is not the valence ns / np subshell of the outermost shell is reported as "core" (1s2 2s2 2p6 ... 4d10 ...).
function Z_CORE(cfg, n) {
  let core = 0; const parts = [];
  for (const s of cfg.subshellsDisplayOrder) {
    if (!(s.n === n && s.l <= 1)) { core += s.electrons; parts.push(`${s.n}${SUBSHELL_LETTERS[s.l]}${s.electrons}`); }
  }
  return { electrons: core, parts };
}

export function promotionsFor(symbol) { return PROMOTIONS[symbol] ?? []; }
export function canExcite(symbol) { return promotionsFor(symbol).length > 0; }

/** The excited (illustrative promotion) state for an element, or null if none is defined. */
export function excitedState(symbol, promotionId) {
  const list = promotionsFor(symbol); if (!list.length) return null;
  const promo = promotionId ? list.find((p) => p.id === promotionId) : list[0]; if (!promo) return null;
  const g = groundState(symbol);
  const orbitals = g.orbitals.map((o) => makeOrbital(o.n, o.kind, promo.occupancy[o.id] ?? 0));
  const valenceElectrons = orbitals.reduce((a, o) => a + o.electrons, 0);
  return { ...g, kind: "excited", promotionId: promo.id, orbitals, valenceElectrons, label: "Excited state (illustrative promotion)", model: promo.model, example: promo.example, fullConfiguration: configurationString(g.core, orbitals) };
}

export function atomicState(symbol, kind = "ground", promotionId = null) {
  return kind === "excited" ? (excitedState(symbol, promotionId) ?? groundState(symbol)) : groundState(symbol);
}

/** "1s² 2s² 2p²"-style string (superscripts as plain digits + LaTeX markers) for a state. */
export function valenceSubshells(state) {
  const out = [];
  for (const o of state.orbitals) {
    const key = `${o.n}${o.type}`; let g = out.find((x) => x.key === key);
    if (!g) { g = { key, n: o.n, type: o.type, electrons: 0 }; out.push(g); }
    g.electrons += o.electrons;
  }
  return out;
}
function configurationString(core, orbitals) {
  const state = { orbitals };
  const parts = [...core.parts, ...valenceSubshells(state).filter((s) => s.electrons > 0).map((s) => `${s.n}${s.type}${s.electrons}`)];
  const order = (p) => { const m = /^(\d)([spdf])/.exec(p); return Number(m[1]) * 10 + "spdf".indexOf(m[2]); };
  return parts.sort((a, b) => order(a) - order(b)).map((p) => p).join(" ");
}
/** LaTeX-ish configuration, e.g. "1s^{2} 2s^{2} 2p^{2}" (for renderCompactLatex). */
export function configurationLatex(state) {
  return String(state.fullConfiguration).split(" ").filter(Boolean).map((p) => { const m = /^(\d[spdf])(\d+)$/.exec(p); return m ? `${m[1]}^{${m[2]}}` : p; }).join(" ");
}
/** Noble-gas shorthand for long configurations ("[Kr] 4d10 5s2 5p6"); the string is unchanged for Z <= 18. */
export function condensedConfiguration(state) {
  const parts = String(state.fullConfiguration).split(" ").filter(Boolean);
  if (state.Z <= 18) return state.fullConfiguration;
  for (const [sym, z] of [["Kr", 36], ["Ar", 18]]) {
    if (z >= state.Z) continue;
    const core = new Set(buildConfiguration(z).configurationString.split(" "));
    if ([...core].every((c) => parts.includes(c))) return `[${sym}] ${parts.filter((p) => !core.has(p)).join(" ")}`;
  }
  return state.fullConfiguration;
}
export function condensedLatex(state) {
  return condensedConfiguration(state).split(" ").map((p) => { const m = /^(\d[spdf])(\d+)$/.exec(p); return m ? `${m[1]}^{${m[2]}}` : p; }).join(" ");
}
export function valenceLatex(state) {
  return valenceSubshells(state).filter((s) => s.electrons > 0).map((s) => `${s.n}${s.type}^{${s.electrons}}`).join(" ");
}

// ---- validation ----------------------------------------------------------------------------------------------------
/** Occupancy (0..2 each), electron count equals Z (core + valence), Hund's rule inside every subshell, valence orbital names. */
export function validateState(state) {
  const problems = [];
  const el = getElementBySymbol(state.symbol); if (!el) return [`unknown element ${state.symbol}`];
  const total = state.core.electrons + state.orbitals.reduce((a, o) => a + o.electrons, 0);
  if (total !== el.atomicNumber) problems.push(`electron count ${total} != Z ${el.atomicNumber}`);
  for (const o of state.orbitals) if (!(o.electrons >= 0 && o.electrons <= 2 && Number.isInteger(o.electrons))) problems.push(`${o.id}: occupancy ${o.electrons}`);
  for (const key of [...new Set(state.orbitals.map((o) => `${o.n}${o.type}`))]) {
    const sub = state.orbitals.filter((o) => `${o.n}${o.type}` === key);
    if (sub.some((o) => o.electrons === 2) && sub.some((o) => o.electrons === 0)) problems.push(`${key}: Hund's rule violated (a pair while an orbital of the subshell is empty)`);
  }
  return problems;
}

/** An excited state is valid iff: same shell (same orbital list), count conserved, electrons only moved to a higher subshell. */
export function validateExcitation(ground, excited) {
  const problems = [...validateState(excited)];
  if (ground.symbol !== excited.symbol) problems.push("different element");
  if (ground.orbitals.length !== excited.orbitals.length || ground.orbitals.some((o, i) => o.id !== excited.orbitals[i].id)) problems.push("different orbital list");
  const tot = (s) => s.orbitals.reduce((a, o) => a + o.electrons, 0);
  if (tot(ground) !== tot(excited)) problems.push("valence electron count not conserved");
  const delta = [0, 0, 0];
  excited.orbitals.forEach((o, i) => { delta[o.l] += o.electrons - ground.orbitals[i].electrons; });
  let run = 0; for (let l = 0; l < 3; l += 1) { run += delta[l]; if (run > 0) problems.push("an electron moved to a LOWER subshell"); }
  if (JSON.stringify(ground.orbitals.map((o) => o.electrons)) === JSON.stringify(excited.orbitals.map((o) => o.electrons))) problems.push("excited state identical to ground state");
  return problems;
}

export function unpairedCount(state) { return state.orbitals.reduce((a, o) => a + (o.electrons === 1 ? 1 : 0), 0); }
