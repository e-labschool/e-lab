// Pure: the scene content (atoms, orbitals, overlap regions, delocalised ring) of a compiled molecule at a given step. No React / three,
// so the data-driven step logic is testable without WebGL. The view describes the TARGET state of a step; the scene animates towards
// it inside the frame loop (atoms glide, orbitals fade, overlap regions swell, the hybridisation morph plays), so a step change costs one
// cheap call here and no per-frame React work.
import { orbitalSpecs, highlightFor, requestsFromSpecs } from "./viewModel.js";
import { reach } from "../model/orbitals.js";
import { resolveRef } from "../model/moleculeLayout.js";
import { add, scale, sub, len } from "../model/vec.js";

export const MORPH_MS = 1700; // the Mix morph of a step that hybridises
export const FADE_OTHERS = 0.3; // opacity factor of orbitals that take no part in the bond(s) being shown
export const FORMED_DIM = 0.62; // opacity factor of orbitals of bonds formed in earlier steps

/** Time (ms) a step is shown while playing: its motion plus a short dwell so the sentence can be read; there is never an idle gap longer than the dwell. */
export function stepDuration(st) {
  if (st.newHybridise.length) return MORPH_MS + 1500;
  if (st.newForm.length) return 1500 + 1700;
  return 2800;
}
export const stepMotion = (st) => (st.newHybridise.length ? MORPH_MS : st.newForm.length ? 1500 : 600);

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

/** Where an atom is DRAWN at a step: separated before its bonding step, at the intermediate pi-stage distance until the pi step, else at its final place. */
export function displayedPos(compiled, id, stepIndex) {
  const a = compiled.atoms[id]; const anchor = compiled.anchorStep[id]; const pi = compiled.piStage?.[id];
  if (anchor > stepIndex) return add(a.pos, compiled.offsets[id]);
  if (pi && stepIndex < pi.step) return add(a.pos, pi.off);
  return a.pos;
}
const lensCache = new WeakMap(); // detected bond -> Map(position key -> overlap highlight); the geometry of a compiled molecule never changes
function lensOf(compiled, b, stepIndex) {
  const A = b.detected.a; const B = b.detected.b; const pa = displayedPos(compiled, A.atomId, stepIndex); const pb = displayedPos(compiled, B.atomId, stepIndex);
  const key = `${pa.map((v) => v.toFixed(3))}|${pb.map((v) => v.toFixed(3))}`; let m = lensCache.get(b); if (!m) { m = new Map(); lensCache.set(b, m); }
  let h = m.get(key); if (!h) { h = highlightFor({ ...A, pos: pa }, { ...B, pos: pb }, b.type); m.set(key, h); } return h;
}

/** Every orbital instance (by key "atom|orbId") that appears in the given bond ids. */
function bondOrbitals(compiled, ids) {
  const set = new Set(); for (const id of ids) { const d = compiled.bondsById[id].detected; if (d) { set.add(d.a.key); set.add(d.b.key); } } return set;
}

/**
 * The view of step `stepIndex`. `startMs` stamps the step (the scene delays overlap highlights and starts the morph from it).
 * options: { labels: boolean (sigma / pi tags on all formed bonds), prevStep: previous step index or null (atoms new in this step glide in from their offset) }
 */
export function stepView(compiled, stepIndex, startMs = 0, { labels = false } = {}) {
  const st = compiled.steps[stepIndex];
  const emph = emphasisFor(compiled, st);
  const newKeys = bondOrbitals(compiled, st.newForm); const oldKeys = bondOrbitals(compiled, st.formed.filter((id) => !st.newForm.includes(id)));
  const showFade = st.newForm.length > 0;
  const atoms = compiled.atomList.filter((a) => st.visible.includes(a.id)).map((a) => {
    const anchor = compiled.anchorStep[a.id]; const off = compiled.offsets[a.id]; const pi = compiled.piStage?.[a.id];
    const pos = displayedPos(compiled, a.id, stepIndex);
    const startPos = anchor === stepIndex ? add(a.pos, off) : pi && pi.step === stepIndex ? add(a.pos, pi.off) : null; // appears (or begins to move) from its separated position
    const hybridised = st.hybridised.includes(a.id);
    const morphing = st.newHybridise.includes(a.id);
    const fade = new Set();
    let orbitals = orbitalSpecs(a, { mode: hybridised ? "hybrid" : "atomic", morph: hybridised && morphing, emphasise: emph.get(a.id) ?? null, labels: hybridised && morphing && a.id === st.focus });
    if (showFade) {
      for (const s of orbitals) {
        const key = `${a.id}|${s.id}`;
        if (newKeys.has(key)) { s.glow = true; continue; }
        if (oldKeys.has(key)) s.opacity *= FORMED_DIM; else { s.opacity *= FADE_OTHERS; s.faded = true; s.tag = false; fade.add(s.id); }
      }
    }
    if (st.ring) for (const s of orbitals) if (s.id === "2pz" && s.cls === "p") s.opacity *= 0.45;
    return { id: a.id, symbol: a.symbol, label: a.symbol === "H" ? "" : a.id, pos, startPos, quat: a.quat, active: false, orbitals, hybridised };
  });
  // overlap regions of the bonds formed so far: new ones swell in after the atoms have arrived, old ones stay
  const regions = []; const bondTags = []; const tagged = new Map();
  for (const id of st.formed) {
    const b = compiled.bondsById[id]; if (!b.detected) continue;
    const isNew = st.newForm.includes(id); const lens = lensOf(compiled, b, stepIndex);
    const moves = [b.a[0], b.b[0]].some((aid) => compiled.anchorStep[aid] === stepIndex || compiled.piStage?.[aid]?.step === stepIndex);
    lens.regions.forEach((r) => regions.push({ ...r, id: `${b.id}#${r.id.split("#")[1]}`, alpha: isNew ? 1 : 0.5, formed: false, delay: isNew ? (moves ? 1100 : 450) : 0 }));
    if (isNew || (labels && stepIndex === compiled.steps.length - 1)) {
      const d = b.detected; const r0 = lens.regions[0]; if (!r0) continue;
      const p = d.type === "pi" ? add(r0.center, scale(d.side, 0.62)) : add(r0.center, [0, 0, -0.5]);
      const key = `${d.type}|${d.label}`; // identical bonds (four C-H sigma bonds) share ONE tag: "sigma (sp2-1s) x4"
      if (tagged.has(key)) { tagged.get(key).count += 1; continue; }
      const tag = { id: b.id, type: d.type, latex: d.label, position: p, delay: isNew ? 1500 : 0, count: 1 }; tagged.set(key, tag); bondTags.push(tag);
    }
  }
  for (const t of bondTags) if (t.count > 1) t.latex = `${t.latex} \\times ${t.count}`;
  let ring = null;
  if (st.ring && compiled.delocalised) {
    const cs = compiled.delocalised.ring.map((id) => compiled.atoms[id].pos); const c = scale(cs.reduce((s, q) => add(s, q), [0, 0, 0]), 1 / cs.length);
    ring = { center: c, normal: [0, 0, 1], radius: len(sub(cs[0], c)), tube: 0.3, offset: reach("p", 2) * 0.5, alpha: 1 };
  }
  return {
    atoms, regions, ring, gizmo: false, bondTags, smooth: true, stepStart: startMs, stepIndex,
    morph: atoms.some((a) => a.hybridised && st.newHybridise.includes(a.id)) ? { atomIds: st.newHybridise, startMs, durMs: MORPH_MS } : null,
  };
}

/** Every geometry request (terms, R, K, palette) the whole sequence needs -- the warm-up builds these before Play so no step builds geometry. */
export function geometryRequests(compiled) {
  const specs = [];
  for (let i = 0; i < compiled.steps.length; i += 1) for (const a of stepView(compiled, i, 0).atoms) specs.push(...a.orbitals);
  return requestsFromSpecs(specs);
}

/** Atom as the EnergyPanel wants it (config at this step, hybrid section only once hybridised). */
export function energyAtom(compiled, stepIndex) {
  const st = compiled.steps[stepIndex]; const a = compiled.atoms[st.focus] ?? compiled.atomList[0];
  const hybridised = st.hybridised.includes(a.id);
  return { atom: { ...a, hybrid: hybridised ? a.hybrid : null, selected: [] }, hybridised };
}
