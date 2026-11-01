// Pure: turns an atom (workspace or molecule) into the list of orbital DRAW specs the 3D scene renders, plus the overlap
// regions of detected bonds. No React / three. Keeping this separate makes "what is drawn" testable without WebGL.
import { reach, nScale } from "../model/orbitals.js";
import { termsToKinds } from "../model/hybrids.js";
import { len, scale, add, sub, normalize, cross, dot } from "../model/vec.js";

const HYBRID_PALETTES = 6;
export const paletteOf = (kind) => (kind === "s" ? "s" : kind[0] === "p" ? "p" : "d");

function atomicSpec(atom, o, selected, hover) {
  const visible = o.type !== "d" || o.electrons > 0 || selected.has(o.id);
  if (!visible) return null;
  const sel = selected.has(o.id);
  const base = o.type === "s" ? (o.electrons ? 0.26 : 0.12) : o.electrons ? 0.58 : 0.14;
  return {
    key: `${atom.id}|${o.id}`, id: o.id, atomId: atom.id, cls: o.type, role: "atomic", terms: [[o.kind, 1]], R: reach(o.type, o.n), palette: paletteOf(o.kind),
    electrons: o.electrons, opacity: sel ? Math.min(0.92, base + 0.34) : hover === o.id ? base + 0.2 : base, selected: sel, hovered: hover === o.id, latex: o.latex, kind: o.kind,
    axis: o.type === "p" ? ({ px: [1, 0, 0], py: [0, 1, 0], pz: [0, 0, 1] })[o.kind] : null,
  };
}

/**
 * options: { mode: "hybrid" | "atomic" (atomic = ignore hybridisation, show the ordinary valence orbitals),
 *            selected: Set<orbId>, hover: orbId|null, morph: boolean (hybrids animate from their source orbitals),
 *            emphasise: Set<orbId|"*">|null (glow; named ids also get a name tag) }
 */
export function orbitalSpecs(atom, options = {}) {
  const { mode = "hybrid", selected = new Set(), hover = null, morph = false, emphasise = null } = options;
  const out = [];
  const hyb = mode === "hybrid" && atom.hybrid;
  const consumed = hyb ? atom.hybrid.consumed : [];
  for (const o of atom.orbitals) {
    if (consumed.includes(o.id) && !morph) continue;
    if (consumed.includes(o.id) && morph) continue; // the morph meshes of the hybrids replace their source orbitals
    const s = atomicSpec(atom, o, selected, hover); if (s) out.push(s);
  }
  if (hyb) {
    const nS = atom.orbitals.find((o) => o.id === atom.hybrid.consumed[0]).n;
    atom.hybrid.hybrids.forEach((h, i) => {
      const sel = selected.has(h.id); const base = h.electrons ? 0.66 : 0.34;
      const spec = {
        key: `${atom.id}|${h.id}`, id: h.id, atomId: atom.id, cls: "hybrid", role: "hybrid", terms: termsToKinds(h.terms), R: reach("hybrid", nS), palette: `h${i % HYBRID_PALETTES}`,
        electrons: h.electrons, opacity: sel ? 0.95 : hover === h.id ? base + 0.15 : base, selected: sel, hovered: hover === h.id, latex: atom.hybrid.recipeId === "dsp2" ? "dsp^{2}" : null,
        axis: h.direction, lonePair: h.electrons === 2, index: i,
      };
      if (morph) {
        const src = atom.orbitals.find((o) => o.id === atom.hybrid.consumed[i]);
        spec.morphFrom = { terms: [[src.kind, 1]], R: reach(src.type, src.n), palette: paletteOf(src.kind), opacity: src.type === "s" ? 0.26 : 0.58 };
      }
      out.push(spec);
    });
  }
  if (emphasise) {
    for (const s of out) {
      if (emphasise.has("*")) s.hovered = true; // glow only
      else if (emphasise.has(s.id)) { s.hovered = true; s.tag = true; s.opacity = Math.min(0.95, s.opacity + 0.15); }
    }
  }
  return out;
}

/** Overlap region(s) of one detected bond as ellipsoids (centre, orientation basis, radii). Sigma: one lens on the axis. Pi: two lenses above and below the axis. */
export function overlapRegions(b, alpha = 1) {
  const u = b.u; const out = [];
  if (b.type === "sigma") {
    const tipA = add(b.a.pos, scale(u, b.a.reach)); const tipB = sub(b.b.pos, scale(u, b.b.reach));
    const mid = scale(add(tipA, tipB), 0.5); const ov = Math.max(0.3, b.a.reach + b.b.reach - b.d);
    const side = Math.abs(u[2]) < 0.9 ? normalize(cross(u, [0, 0, 1])) : normalize(cross(u, [1, 0, 0]));
    out.push({ id: `${b.id}#0`, type: "sigma", center: mid, u, side, radii: [ov * 0.6, 0.2 * Math.min(b.a.reach, b.b.reach) + 0.06, 0.2 * Math.min(b.a.reach, b.b.reach) + 0.06], alpha });
  } else {
    const mid = scale(add(b.a.pos, b.b.pos), 0.5); const h = 0.52 * Math.min(b.a.reach, b.b.reach); const s = b.side;
    const sideU = normalize(cross(u, s));
    for (const sign of [1, -1]) out.push({ id: `${b.id}#${sign}`, type: "pi", center: add(mid, scale(s, sign * h)), u, side: s, radii: [b.d * 0.5 + 0.3, 0.13 * Math.min(b.a.reach, b.b.reach) + 0.06, 0.28 * h + 0.06], alpha, sideU });
  }
  return out;
}
export const regionExtent = (r) => Math.max(...r.radii);
export { len, dot, nScale };
