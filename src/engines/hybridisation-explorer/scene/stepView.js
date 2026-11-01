// Pure: the scene content (atoms, orbitals, overlap regions, delocalised ring) of a compiled molecule at a given step and
// animation progress. No React / three, so the data-driven step logic is testable without WebGL.
import { orbitalSpecs } from "./viewModel.js";
import { reach } from "../model/orbitals.js";
import { resolveRef } from "../model/moleculeLayout.js";
import { add, scale, sub, len } from "../model/vec.js";

export const ANIM_MS = 1900; // time one step animates (approach, overlap fade-in); the hybridisation morph uses MORPH_MS
export const MORPH_MS = 1500;
export const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Emphasis entries "C1:2pz", "C1:h0", "C1:*", "*:2pz" -> Map(atomId -> Set(orbId | "*")). */
export function emphasisFor(compiled, step) {
  const m = new Map();
  for (const ref of step.emphasise ?? []) {
    const [who, what] = ref.split(":");
    const ids = who === "*" ? compiled.atomList.map((a) => a.id) : [who];
    for (const id of ids) {
      const a = compiled.atoms[id]; if (!a) continue;
      let orb = what;
      if (what !== "*") { try { orb = resolveRef(a, what); } catch { continue; } }
      if (!m.has(id)) m.set(id, new Set()); m.get(id).add(orb);
    }
  }
  return m;
}

export function stepView(compiled, stepIndex, progress, startMs = 0, now = 0) {
  const st = compiled.steps[stepIndex]; const p = clamp01(progress); const e = ease(p);
  const emph = emphasisFor(compiled, st);
  const atoms = compiled.atomList.filter((a) => st.visible.includes(a.id)).map((a) => {
    const anchor = compiled.anchorStep[a.id]; const off = compiled.offsets[a.id];
    const pos = anchor > stepIndex ? add(a.pos, off) : anchor === stepIndex ? add(a.pos, scale(off, 1 - e)) : a.pos;
    const hybridised = st.hybridised.includes(a.id);
    const morphing = st.newHybridise.includes(a.id) && now - startMs < MORPH_MS + 100;
    const orbitals = orbitalSpecs(a, { mode: hybridised ? "hybrid" : "atomic", morph: hybridised && morphing, emphasise: emph.get(a.id) ?? null });
    if (st.ring) for (const s of orbitals) if (s.id === "2pz" && s.cls === "p") s.opacity *= 0.45;
    return { id: a.id, symbol: a.symbol, label: a.id, pos, quat: a.quat, active: false, orbitals, hybridised };
  });
  const newForm = new Set(st.newForm);
  const overlaps = [];
  const bondTags = [];
  for (const id of st.formed) {
    const b = compiled.bondsById[id]; if (!b.detected) continue;
    const alpha = newForm.has(id) ? clamp01((p - 0.45) / 0.45) : 1; if (alpha <= 0) continue;
    overlaps.push({ ...b.detected, id: `${b.id}`, alpha });
    if (newForm.has(id) && p > 0.65) { const d = b.detected; bondTags.push({ id: b.id, type: d.type, latex: d.label, position: d.type === "pi" ? add(d.center, scale(d.side, 0.95)) : add(d.center, [0, 0, -0.55]) }); }
  }
  let ring = null;
  if (st.ring && compiled.delocalised) {
    const cs = compiled.delocalised.ring.map((id) => compiled.atoms[id].pos); const c = scale(cs.reduce((s, q) => add(s, q), [0, 0, 0]), 1 / cs.length);
    const first = compiled.steps.findIndex((x) => x.ring) === stepIndex;
    ring = { center: c, normal: [0, 0, 1], radius: len(sub(cs[0], c)), tube: 0.34, offset: reach("p", 2) * 0.55, alpha: first ? e : 1 };
  }
  return { atoms, overlaps, ring, gizmo: false, bondTags, morph: atoms.some((a) => a.hybridised && st.newHybridise.includes(a.id)) && now - startMs < MORPH_MS + 100 ? { atomIds: st.newHybridise, startMs, durMs: MORPH_MS } : null };
}

/** Atom as the EnergyPanel wants it (config at this step, hybrid section only once hybridised). */
export function energyAtom(compiled, stepIndex) {
  const st = compiled.steps[stepIndex]; const a = compiled.atoms[st.focus] ?? compiled.atomList[0];
  const hybridised = st.hybridised.includes(a.id);
  return { atom: { ...a, hybrid: hybridised ? a.hybrid : null, selected: [] }, hybridised };
}
