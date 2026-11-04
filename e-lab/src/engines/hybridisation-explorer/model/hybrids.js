// Hybridisation recipes, supported-combination checks and the COMPUTED hybrid direction sets. Pure (no React / three).
// The model is the traditional valence-bond picture: n atomic orbitals in -> n hybrid orbitals out, with textbook
// orthonormal coefficient sets. Directions are generated from geometry (never typed per molecule) and verified in the tests
// against the actual maximum of each hybrid's angular function.
import { angular, combination, P_AXIS, P_KINDS, MINUS } from "./orbitals.js";
import { add, scale, dot, normalize, len, angleDeg, rad } from "./vec.js";

const R2 = Math.SQRT2; const R3 = Math.sqrt(3); const R6 = Math.sqrt(6); const R12 = Math.sqrt(12);

export const RECIPES = {
  sp: { id: "sp", count: 2, s: 1, p: 1, d: 0, latex: "sp", geometry: "Linear", angles: [180], idealText: "180°", example: "BeCl₂, C₂H₂, CO₂" },
  sp2: { id: "sp2", count: 3, s: 1, p: 2, d: 0, latex: "sp^{2}", geometry: "Trigonal planar", angles: [120], idealText: "120°", example: "BF₃, C₂H₄, C₆H₆" },
  sp3: { id: "sp3", count: 4, s: 1, p: 3, d: 0, latex: "sp^{3}", geometry: "Tetrahedral", angles: [Math.acos(-1 / 3) * 180 / Math.PI], idealText: "109.5°", example: "CH₄, NH₃, H₂O, C₂H₆" },
  sp3d: { id: "sp3d", count: 5, s: 1, p: 3, d: 1, latex: "sp^{3}d", geometry: "Trigonal bipyramidal", angles: [90, 120, 180], idealText: "90°, 120°, 180°", traditional: true, example: "PCl₅" },
  sp3d2: { id: "sp3d2", count: 6, s: 1, p: 3, d: 2, latex: "sp^{3}d^{2}", geometry: "Octahedral", angles: [90, 180], idealText: "90°, 180°", traditional: true, example: "SF₆" },
  dsp2: { id: "dsp2", count: 4, s: 1, p: 2, d: 1, latex: "dsp^{2}", geometry: "Square planar", angles: [90, 180], idealText: "90°, 180°", complex: true, example: "[Ni(CN)₄]²⁻, [PtCl₄]²⁻" },
};
export const RECIPE_IDS = Object.keys(RECIPES);
const RECIPE_UNICODE = { sp: "sp", sp2: "sp\u00b2", sp3: "sp\u00b3", sp3d: "sp\u00b3d", sp3d2: "sp\u00b3d\u00b2", dsp2: "dsp\u00b2" };
/** Plain-text name with Unicode superscripts: "sp\u00b2", "sp\u00b3d\u00b2". */
export const recipeUnicode = (id) => RECIPE_UNICODE[id] ?? id;
export const TRADITIONAL_NOTE = "Traditional hybridisation model: modern molecular-orbital descriptions of hypervalent molecules such as PCl₅ and SF₆ do not require significant d-orbital participation.";
export const COMBINATION_NOTE = "The d-orbital combinations shown are conventional basis choices for illustrating the traditional model, not unique physical mixing pathways.";

const order = (id) => { // canonical order of a consumed set: s, px, py, pz, dz2, dx2-y2
  const k = id.replace(/^\d/, ""); return ["s", "px", "py", "pz", "dz2", "dx2-y2"].indexOf(k);
};

/**
 * Is this selection of atomic orbitals a supported hybridisation set?
 * selected: [{id, n, kind}] (unhybridised valence orbitals of ONE atom).
 * returns { ok, recipeId, reason, ids (canonical order), label }
 */
export function analyseSelection(selected) {
  const bad = (reason) => ({ ok: false, recipeId: null, reason, ids: [], count: selected.length });
  if (!selected.length) return bad("Click orbital boxes (or orbitals in the 3D view) to choose the orbitals to mix.");
  const s = selected.filter((o) => o.kind === "s"); const p = selected.filter((o) => o.kind[0] === "p"); const d = selected.filter((o) => o.kind[0] === "d");
  if (selected.length === 1) return bad("Select at least two orbitals: one s orbital plus one or more p orbitals.");
  if (s.length !== 1) return bad("Every supported hybridisation set contains exactly one s orbital.");
  const n = s[0].n;
  const sorted = [...selected].sort((a, b) => order(a.id) - order(b.id));
  const ids = sorted.map((o) => o.id);
  const pk = p.map((o) => o.kind).sort(); const dk = d.map((o) => o.kind).sort();
  if (p.some((o) => o.n !== n)) return bad("The s and p orbitals of a hybrid set must come from the same shell.");
  if (!d.length) {
    const recipeId = ({ 1: "sp", 2: "sp2", 3: "sp3" })[p.length];
    if (!recipeId) return bad("Select the s orbital with one, two or three p orbitals (sp, sp², sp³).");
    return { ok: true, recipeId, reason: "", ids, count: selected.length };
  }
  // d-orbital sets
  if (dk.length === 1 && dk[0] === "dx2-y2" && pk.join() === "px,py" && d[0].n === n - 1) return { ok: true, recipeId: "dsp2", reason: "", ids, count: selected.length };
  if (d.some((o) => o.n !== n)) return bad(`sp³d and sp³d² use nd orbitals of the same shell n as the s and p orbitals (dsp² uses (n${MINUS}1)d).`);
  if (pk.join() !== "px,py,pz") return bad("sp³d and sp³d² need all three np orbitals together with the s orbital.");
  if (dk.join() === "dz2") return { ok: true, recipeId: "sp3d", reason: "", ids, count: selected.length };
  if (dk.join() === ["dx2-y2", "dz2"].join()) return { ok: true, recipeId: "sp3d2", reason: "", ids, count: selected.length };
  return bad(`The traditional models use only d(z²) (sp³d) or d(z²) with d(x²${MINUS}y²) (sp³d²); other d orbitals are not offered.`);
}

const sorted2 = (pk) => [...pk].sort(); // "px" < "py" < "pz"

/**
 * The hybrid set for a recipe: coefficients over the consumed orbitals and the COMPUTED direction of each hybrid's large lobe.
 * ids = canonical consumed ids from analyseSelection. Returns [{index, terms:[[orbitalId, c]...], direction, role}]
 */
export function buildHybrids(recipeId, ids) {
  const kindOf = (id) => id.replace(/^\d/, "");
  const nOf = (kind) => ids.find((i) => kindOf(i) === kind);
  const pks = sorted2(ids.map(kindOf).filter((k) => k[0] === "p"));
  const sId = ids.find((i) => kindOf(i) === "s");
  const term = (kind, c) => [nOf(kind), c];
  const out = [];
  const push = (terms, direction, role = "") => out.push({ index: out.length, terms: terms.filter((t) => Math.abs(t[1]) > 1e-12), direction: normalize(direction), role });
  switch (recipeId) {
    case "sp": {
      const a = P_AXIS[pks[0]];
      push([[sId, 1 / R2], term(pks[0], 1 / R2)], a); push([[sId, 1 / R2], term(pks[0], -1 / R2)], scale(a, -1));
      break;
    }
    case "sp2": {
      const a = P_AXIS[pks[0]]; const b = P_AXIS[pks[1]];
      for (let i = 0; i < 3; i += 1) {
        const th = rad(120 * i); const c = Math.cos(th); const s = Math.sin(th);
        push([[sId, 1 / R3], term(pks[0], Math.sqrt(2 / 3) * c), term(pks[1], Math.sqrt(2 / 3) * s)], add(scale(a, c), scale(b, s)));
      }
      break;
    }
    case "sp3": {
      for (const [x, y, z] of [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]) {
        push([[sId, 0.5], term("px", (R3 / 2) * x / R3), term("py", (R3 / 2) * y / R3), term("pz", (R3 / 2) * z / R3)], [x, y, z]);
      }
      break;
    }
    case "sp3d": {
      for (let i = 0; i < 3; i += 1) {
        const th = rad(120 * i); const c = Math.cos(th); const s = Math.sin(th);
        push([[sId, 1 / R3], term("px", Math.sqrt(2 / 3) * c), term("py", Math.sqrt(2 / 3) * s)], [c, s, 0], "equatorial");
      }
      push([term("pz", 1 / R2), term("dz2", 1 / R2)], [0, 0, 1], "axial");
      push([term("pz", -1 / R2), term("dz2", 1 / R2)], [0, 0, -1], "axial");
      break;
    }
    case "sp3d2": {
      const mk = (cp, dir) => push([[sId, 1 / R6], ...cp], dir, "octahedral");
      mk([term("pz", 1 / R2), term("dz2", 1 / R3)], [0, 0, 1]); mk([term("pz", -1 / R2), term("dz2", 1 / R3)], [0, 0, -1]);
      mk([term("px", 1 / R2), term("dz2", -1 / R12), term("dx2-y2", 0.5)], [1, 0, 0]); mk([term("px", -1 / R2), term("dz2", -1 / R12), term("dx2-y2", 0.5)], [-1, 0, 0]);
      mk([term("py", 1 / R2), term("dz2", -1 / R12), term("dx2-y2", -0.5)], [0, 1, 0]); mk([term("py", -1 / R2), term("dz2", -1 / R12), term("dx2-y2", -0.5)], [0, -1, 0]);
      break;
    }
    case "dsp2": {
      const dId = ids.find((i) => kindOf(i) === "dx2-y2");
      push([[sId, 0.5], term("px", 1 / R2), [dId, 0.5]], [1, 0, 0], "square"); push([[sId, 0.5], term("px", -1 / R2), [dId, 0.5]], [-1, 0, 0], "square");
      push([[sId, 0.5], term("py", 1 / R2), [dId, -0.5]], [0, 1, 0], "square"); push([[sId, 0.5], term("py", -1 / R2), [dId, -0.5]], [0, -1, 0], "square");
      break;
    }
    default: throw new Error(`unknown recipe ${recipeId}`);
  }
  return out;
}

/** n orbitals in -> n out; electrons are re-distributed (Hund's rule: singly first, then pairs from index 0) and conserved. */
export function distributeHybridElectrons(total, count) {
  const occ = Array(count).fill(0);
  for (let i = 0; i < Math.min(total, count); i += 1) occ[i] = 1;
  for (let i = 0; i < Math.max(0, total - count); i += 1) occ[i] = 2;
  return occ;
}

/**
 * Complete mixing result for one atom: given the atom's valence orbitals [{id,n,kind,electrons}] and a selection of ids.
 * { ok, recipe, hybrids:[{id,index,terms,direction,electrons,sources}], consumed, remaining, totalElectrons, reason }
 */
export function mixOrbitals(orbitals, selectedIds) {
  const byId = new Map(orbitals.map((o) => [o.id, o]));
  const selected = [...new Set(selectedIds)].map((id) => byId.get(id)).filter(Boolean);
  const a = analyseSelection(selected);
  if (!a.ok) return { ok: false, reason: a.reason, recipeId: null };
  const hybrids = buildHybrids(a.recipeId, a.ids);
  const total = a.ids.reduce((s, id) => s + byId.get(id).electrons, 0);
  const occ = distributeHybridElectrons(total, hybrids.length);
  const consumed = a.ids;
  const out = hybrids.map((h, i) => ({ ...h, id: `${a.recipeId}#${i}`, electrons: occ[i], source: consumed[i] }));
  if (out.length !== selected.length) throw new Error("orbital number not conserved");
  return {
    ok: true, recipeId: a.recipeId, recipe: RECIPES[a.recipeId], hybrids: out, consumed,
    remaining: orbitals.filter((o) => !consumed.includes(o.id)).map((o) => o.id), totalElectrons: total, reason: "",
  };
}

// ---- numerical verification helpers (used by tests and by the lobe-size normalisation) -------------------------------
const FIB = (() => { const n = 1800; const pts = []; const ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i += 1) { const y = 1 - (2 * (i + 0.5)) / n; const r = Math.sqrt(1 - y * y); const th = ga * i; pts.push([Math.cos(th) * r, y, Math.sin(th) * r]); } return pts; })();
/** Direction of the maximum of a combination of angular functions (large positive lobe), refined to < 0.01 deg. */
export function peakDirection(terms) {
  let best = FIB[0]; let bv = -Infinity;
  for (const p of FIB) { const v = combination(terms, p[0], p[1], p[2]); if (v > bv) { bv = v; best = p; } }
  let cur = best; let step = 0.12;
  for (let it = 0; it < 80; it += 1) {
    let moved = false;
    for (const t of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const c = normalize(add(cur, scale(t, step))); const v = combination(terms, c[0], c[1], c[2]);
      if (v > bv + 1e-15) { bv = v; cur = c; moved = true; }
    }
    if (!moved) step *= 0.5;
    if (step < 1e-7) break;
  }
  return cur;
}
/** Local angular terms of a hybrid with the orbital ids reduced to kinds: [[kind, c], ...]. */
export const termsToKinds = (terms) => terms.map(([id, c]) => [id.replace(/^\d/, ""), c]);
export function hybridValue(h, x, y, z) { return combination(termsToKinds(h.terms), x, y, z); }
export function pairAngles(hybrids) {
  const a = [];
  for (let i = 0; i < hybrids.length; i += 1) for (let j = i + 1; j < hybrids.length; j += 1) a.push(angleDeg(hybrids[i].direction, hybrids[j].direction));
  return a;
}
export const hybridNorm = (h) => Math.sqrt(h.terms.reduce((s, t) => s + t[1] * t[1], 0));
export const hybridDot = (a, b) => { let s = 0; for (const [id, c] of a.terms) for (const [id2, c2] of b.terms) if (id === id2) s += c * c2; return s; };
export { P_KINDS, angular, dot, len };
