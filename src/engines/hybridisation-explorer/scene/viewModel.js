// Pure: turns an atom (workspace or molecule) into the list of orbital DRAW specs the 3D scene renders, plus the overlap regions of
// bonds and overlaps. No React / three. Keeping this separate makes "what is drawn" testable without WebGL.
import { reach, nScale, SURFACE_K, DRAW_WIDTH, colourKey, typeOf } from "../model/orbitals.js";
import { termsToKinds, RECIPES } from "../model/hybrids.js";
import { overlapBetween, highlightStrength } from "../model/overlapVolume.js";
import { len, dot } from "../model/vec.js";

const HYBRID_PALETTES = 6;
// stable term-list identities so a re-render does not look like a new shape to the geometry cache
const ATOM_TERMS = Object.fromEntries(["s", "px", "py", "pz", "dxy", "dxz", "dyz", "dx2-y2", "dz2"].map((k) => [k, [[k, 1]]]));
const kindTermsCache = new WeakMap();
const hybridTerms = (h) => { let t = kindTermsCache.get(h.terms); if (!t) { t = termsToKinds(h.terms); kindTermsCache.set(h.terms, t); } return t; };
/** Palette name of an orbital kind: "s", "px", "py", "pz" or "d". Hybrids use "h0".."h5" (one per hybrid, same in both tabs). */
export const paletteOf = colourKey;
export const hybridPalette = (i) => `h${i % HYBRID_PALETTES}`;

/** Base opacity of an atomic orbital: occupied lobes are nearly solid so they read as shapes; s spheres stay faint so they never hide the atom. */
function baseOpacity(o, soleOrbital) {
  if (o.type === "s") return soleOrbital ? (o.electrons ? 0.3 : 0.18) : o.electrons ? 0.3 : 0.14;
  return o.electrons ? 0.9 : 0.34;
}

function atomicSpec(atom, o, selected, hover, soleOrbital) {
  const visible = o.type !== "d" || o.electrons > 0 || selected.has(o.id);
  if (!visible) return null;
  const sel = selected.has(o.id); const base = baseOpacity(o, soleOrbital);
  return {
    key: `${atom.id}|${o.id}`, id: o.id, atomId: atom.id, cls: o.type, role: "atomic", terms: ATOM_TERMS[o.kind], R: reach(o.type, o.n), K: SURFACE_K[o.type], width: DRAW_WIDTH[o.type], palette: paletteOf(o.kind),
    electrons: o.electrons, opacity: sel ? Math.min(0.98, base + 0.25) : hover === o.id ? Math.min(0.98, base + 0.15) : base, selected: sel, hovered: hover === o.id, latex: o.latex, kind: o.kind, n: o.n,
    axis: o.type === "p" ? ({ px: [1, 0, 0], py: [0, 1, 0], pz: [0, 0, 1] })[o.kind] : null,
  };
}

/**
 * options: { mode: "hybrid" | "atomic" (atomic = ignore hybridisation, show the ordinary valence orbitals),
 *            selected: Set<orbId>, hover: orbId|null, morph: boolean (hybrids animate from their source orbitals),
 *            emphasise: Set<orbId|"*">|null (glow; named ids also get a name tag),
 *            fade: Set<orbId>|null (orbitals that are faded: not involved in what is being shown), fadeTo: opacity factor of the faded ones,
 *            labels: boolean (tag every hybrid and every remaining unhybridised orbital with its name) }
 */
export function orbitalSpecs(atom, options = {}) {
  const { mode = "hybrid", selected = new Set(), hover = null, morph = false, emphasise = null, fade = null, fadeTo = 0.14, labels = false } = options;
  const out = [];
  const hyb = mode === "hybrid" && atom.hybrid;
  const consumed = hyb ? atom.hybrid.consumed : [];
  const visibleOrbs = atom.orbitals.filter((o) => !consumed.includes(o.id) && (o.type !== "d" || o.electrons > 0 || selected.has(o.id)));
  const sole = visibleOrbs.length === 1 && !hyb;
  for (const o of atom.orbitals) {
    if (consumed.includes(o.id)) continue; // the (morph) meshes of the hybrids replace their source orbitals
    const s = atomicSpec(atom, o, selected, hover, sole); if (s) out.push(s);
  }
  if (hyb) {
    const sOrb = atom.orbitals.find((o) => o.id === atom.hybrid.consumed[0]); const nS = sOrb.n;
    atom.hybrid.hybrids.forEach((h, i) => {
      const sel = selected.has(h.id); const base = h.electrons ? 0.9 : 0.5;
      const spec = {
        key: `${atom.id}|${h.id}`, id: h.id, atomId: atom.id, cls: "hybrid", role: "hybrid", terms: hybridTerms(h), R: reach("hybrid", nS), K: SURFACE_K.hybrid, width: DRAW_WIDTH.hybrid, palette: hybridPalette(i),
        electrons: h.electrons, opacity: sel ? 0.98 : hover === h.id ? Math.min(0.98, base + 0.1) : base, selected: sel, hovered: hover === h.id, latex: RECIPES[atom.hybrid.recipeId].latex,
        axis: h.direction, lonePair: h.electrons === 2, index: i, n: nS,
      };
      if (morph) {
        const src = atom.orbitals.find((o) => o.id === atom.hybrid.consumed[i]);
        spec.morphFrom = { terms: ATOM_TERMS[src.kind], R: reach(src.type, src.n), K: SURFACE_K[src.type], cls: src.type, palette: paletteOf(src.kind), opacity: baseOpacity(src, false), latex: src.latex };
      }
      out.push(spec);
    });
    // a morph needs the whole source set on screen: s + p orbitals that become hybrids are drawn as the morph meshes themselves
  }
  if (labels) for (const s of out) if (s.role === "hybrid" || (s.cls === "p" && s.electrons > 0 && hyb)) s.tag = true;
  if (emphasise) {
    for (const s of out) {
      if (emphasise.has("*")) s.glow = true; // glow only
      else if (emphasise.has(s.id)) { s.glow = true; s.tag = true; s.opacity = Math.min(0.98, s.opacity + 0.08); }
    }
  }
  if (fade) for (const s of out) if (fade.has(s.id) && !s.selected) { s.opacity *= fadeTo; s.faded = true; s.tag = false; }
  return out;
}

/** The ids of the orbitals of an atom that take part in the given overlaps / bonds (both partners) -- everything else may be faded. */
export function involvedIds(atomId, pairs) {
  const ids = new Set();
  for (const p of pairs) { if (p.a.atomId === atomId) ids.add(p.a.orbId); if (p.b.atomId === atomId) ids.add(p.b.orbId); }
  return ids;
}

/**
 * Overlap highlight descriptions for one pair of orbital instances: ellipsoid regions fitted to the intersection of the two drawn
 * surfaces (see model/overlapVolume.js). type = "sigma" | "pi"; strength is 0..1 and follows the overlap measure continuously.
 */
export function highlightFor(a, b, type, { formed = false, alpha = 1 } = {}) {
  const o = overlapBetween(a, b); const strength = highlightStrength(o.measure);
  return {
    measure: o.measure, strength,
    regions: o.regions.map((r, i) => ({ id: `${a.key}~${b.key}#${i}`, type, center: r.center, quat: r.quat, radii: r.radii, phase: r.phase, strength, alpha, formed })),
  };
}
/** Unique geometry requests {terms, R, K, palette} of a spec list (what the warm-up builds ahead of time). */
export function requestsFromSpecs(specs) {
  const seen = new Map();
  for (const s of specs) { const key = `${s.R.toFixed(3)}|${s.K}|${s.palette}|${(s.axis ?? []).join(",")}|${s.width ?? 1}|${s.terms.map(([k, c]) => `${k}:${c.toFixed(5)}`).join("+")}`; if (!seen.has(key)) seen.set(key, { terms: s.terms, R: s.R, K: s.K, palette: s.palette, axis: s.axis ?? null, width: s.width ?? 1 }); }
  return [...seen.values()];
}
export const regionExtent = (r) => Math.max(...r.radii);
export { len, dot, nScale, typeOf };
