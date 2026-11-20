// Timeline and layout of the "vector addition" animation of the Molecular Polarity tab (pure). Arrow lengths are QUALITATIVE (proportional to delta-EN).
//
// Six steps (the spec order):
//   1. geometry  the molecule and its partial charges, no arrows yet
//   2. reveal    bond dipoles appear ALONGSIDE their bonds: crossed tail at the delta+ atom, head towards the more electronegative atom
//   3. add       COPIES of them (same length and direction) move into a separate "vector sum" diagram beside / below the molecule: two non-collinear dipoles
//                from a COMMON ORIGIN, three or more laid tip to tail one after another
//   4. complete  the dashed parallelogram is completed (two dipoles) / the sequential sum is finished (three or more)
//   5. result    the pink resultant from the start to the opposite corner / end of the chain; when the sum is zero no arrow is drawn, the arrows cancel
//   6. classify  polar / non-polar, "Net dipole moment" and the explanation
// The diagram is a SEPARATE picture (the vector sum does not depend on where vectors are drawn), so it never overlaps the atoms or the delta tags.
import { elementStyle } from "../../shared-3d/elementStyle.js";
import { add, cross, dot, len, mul, sub, unit, clamp, lerp3 } from "../../shared-3d/electronCloud/vec3.js";

export const ARROW_SCALE = 0.9; // scene units per "EN unit"
export const PHASES = Object.freeze({ geometry: [0, 0.1], reveal: [0.1, 0.3], add: [0.3, 0.6], complete: [0.6, 0.75], result: [0.75, 0.9], classify: [0.9, 1] });
export const STAGES = Object.freeze(["geometry", "reveal", "add", "complete", "result", "classify"]);
/** Which of the six steps progress u belongs to. */
export const stageAt = (u) => STAGES.find((k) => u < PHASES[k][1]) ?? "classify";
export const DURATION = 6; // seconds for the whole animation
export const ATOM_SCALE = 1.1; // ball radius = element radius x ATOM_SCALE (smaller than a space-filling view so arrows and bonds stay visible)
const ease = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const seg = (u, [a, b]) => ease((u - a) / (b - a));
const EPS = 1e-9;

/** Which bond dipoles are drawn: the polar ones; and, only when a molecule has no polar bond at all (CH4), its very small C-H dipoles, drawn faint, to show that they cancel too. */
export const isActive = (mol, d) => d.polar || (d.weak && !mol.net.hasPolarBonds);
/** The free stretch of bond d between the two atom surfaces: where a bond arrow may lie (tail just outside the delta+ ball's centre, head at the surface of the delta- ball). */
function bondSpan(mol, d) {
  const a = mol.atoms[d.plus]; const b = mol.atoms[d.minus]; const dir = unit(sub(b.p, a.p)); const ra = elementStyle(a.el).r * ATOM_SCALE; const rb = elementStyle(b.el).r * ATOM_SCALE;
  return { from: add(a.p, mul(dir, ra * 0.55)), to: sub(b.p, mul(dir, rb * 0.8)), dir };
}
const magOf = (d) => (d.polar ? d.magnitude : d.dEN);
/** Display scale of one molecule's arrows (scene units per "EN unit"): the largest scale at which EVERY drawn bond arrow fits along its own bond. The arrow lying on the bond, its copy in the
 *  vector-sum picture and the resultant all use this one scale, so a copy is exactly as long as its bond arrow (only its position changes). Relative lengths inside a molecule are untouched. */
const scaleCache = new Map();
export function arrowScale(mol) {
  if (scaleCache.has(mol.id)) return scaleCache.get(mol.id);
  const fits = mol.dipoles.filter((d) => isActive(mol, d)).map((d) => { const sp = bondSpan(mol, d); return len(sub(sp.to, sp.from)) / Math.max(1e-6, magOf(d)); });
  const s = fits.length ? Math.min(...fits) : ARROW_SCALE; scaleCache.set(mol.id, s); return s;
}
const vecOf = (d, mol) => (d.polar ? mul(d.dir, d.magnitude * arrowScale(mol)) : mul(d.wdir, d.dEN * arrowScale(mol)));

/** Where bond arrow d rests: ALONG its own bond, from the delta+ atom towards the more electronegative atom (the head ends at the surface of that atom, so in H2O both heads meet at the oxygen).
 *  The direction is exactly the bond direction in 3D and the length is exactly that of the copy in the vector-sum picture (vecOf). */
export function restingArrow(mol, d) {
  const sp = bondSpan(mol, d); return { from: sub(sp.to, mul(sp.dir, len(vecOf(d, mol)))), to: sp.to };
}
/** Centre of positive charge: the mean of the delta+ atoms (the midpoint of the two H atoms in H2O); the mean of all atoms if none is delta+. */
export function chargeCentre(mol) {
  const pos = mol.atoms.filter((_, i) => mol.signs[i] > 0); const set = pos.length ? pos : mol.atoms;
  return set.reduce((acc, a) => add(acc, a.p), [0, 0, 0]).map((x) => x / set.length);
}
/** The net-dipole arrow drawn IN the molecule: from the centre of positive charge along the vector sum (same crossed-tail convention). null when the sum is zero. */
export function moleculeResultant(mol) {
  if (!mol.net.polar) return null; const c = chargeCentre(mol); return { from: c, to: add(c, mul(mol.net.vector, arrowScale(mol))) };
}

/** Display-only sideways nudge of the PINK resultant when exactly one bond dipole is drawn (HCl, HF, HBr, CH3Cl): the resultant is then identical to that dipole and would hide behind it.
 *  [0,0,0] for every other molecule. The nudge is perpendicular to the arrow in the screen plane; it changes where the arrow is drawn, not its length or direction. */
export function resultantNudge(mol) {
  const act = mol.dipoles.filter((d) => isActive(mol, d)); if (act.length !== 1 || !mol.net.polar) return [0, 0, 0];
  const p = perpXY(mol.net.vector); const flip = p[1] < -1e-9 || (Math.abs(p[1]) <= 1e-9 && p[0] < 0) ? -1 : 1; return mul(p, 0.32 * flip);
}

/** Order of the head-to-tail chain: opposite dipoles are never adjacent when avoidable (so the chain walks around a loop instead of retracing itself). */
export function chainOrder(mol) {
  const idx = mol.dipoles.map((d, k) => (isActive(mol, d) ? k : -1)).filter((k) => k >= 0); const g = unit([0.53, 0.31, 0.17]);
  const key = (k) => dot(vecOf(mol.dipoles[k], mol), g);
  return [...idx.filter((k) => key(k) >= -EPS), ...idx.filter((k) => key(k) < -EPS)];
}
/** "para": exactly two non-collinear bond dipoles are drawn from a COMMON ORIGIN and the dashed parallelogram is completed; otherwise "chain" (tip to tail). */
export const diagramKind = (mol) => { const vs = mol.dipoles.filter((d) => isActive(mol, d)).map((d) => vecOf(d, mol)); return vs.length === 2 && len(cross(vs[0], vs[1])) > 1e-6 ? "para" : "chain"; };
const collinear = (mol) => { const vs = mol.dipoles.filter((d) => isActive(mol, d)).map((d) => vecOf(d, mol)); return vs.length > 1 && vs.every((v) => len(cross(v, vs[0])) < 1e-6); };

/** Head-to-tail chain starting at `origin`: arrow k begins where the previous arrow of the chain ended. `drawn` also carries a small sideways offset for collinear chains (display only). */
export function chainArrows(mol, placement = "below", origin = layoutOf(mol, placement).origin) {
  let p = [...origin]; const out = mol.dipoles.map(() => null); const drawn = mol.dipoles.map(() => null); const col = collinear(mol);
  if (diagramKind(mol) === "para") {
    let sum = [...origin]; mol.dipoles.forEach((d, k) => { if (!isActive(mol, d)) return; const v = vecOf(d, mol); out[k] = { from: [...origin], to: add(origin, v) }; drawn[k] = { from: add(origin, [0, 0, 0.1]), to: add(add(origin, v), [0, 0, 0.1]) }; sum = add(sum, v); });
    return { arrows: out, drawn, end: sum, kind: "para" };
  }
  chainOrder(mol).forEach((k, n) => {
    const to = add(p, vecOf(mol.dipoles[k], mol)); out[k] = { from: p, to };
    const off = col ? [0, (n % 2 === 0 ? 1 : -1) * 0.2, 0.1] : [0, 0, 0.1]; drawn[k] = { from: add(p, off), to: add(to, off) }; p = to;
  });
  return { arrows: out, drawn, end: p, kind: "chain" };
}

/** Colours that tie a bond arrow to its copy in the vector-sum picture (labels d1, d2 ...). Deliberately not yellow (the dipoles), pink (the resultant), blue or red (delta+ / delta-). */
export const DIPOLE_TAGS = Object.freeze(["#0a8f87", "#7c3aed", "#b45309", "#0369a1", "#4d7c0f", "#475569", "#a16207", "#0f766e"]);
const perpXY = (v) => { const h = Math.hypot(v[0], v[1]); return h < 0.15 * Math.max(1e-9, len(v)) ? [0.7, 0.7, 0] : [-v[1] / h, v[0] / h, 0]; };
/** Where the small d1, d2 ... tags sit, so every bond arrow can be matched with its copy: { k (dipole index), n (1-based number), color, name, restOffset, copyOffset }.
 *  Empty when fewer than two arrows are drawn (nothing to match). Offsets are display-only nudges beside the arrow, away from the other arrows / the molecule. */
export function labelPlan(mol, placement = "below") {
  const act = mol.dipoles.map((d, k) => (isActive(mol, d) ? k : -1)).filter((k) => k >= 0); if (act.length < 2) return [];
  const cen = mol.atoms.reduce((a, q) => add(a, q.p), [0, 0, 0]).map((x) => x / mol.atoms.length);
  const chain = chainArrows(mol, placement); const mids = act.map((k) => mul(add(chain.drawn[k].from, chain.drawn[k].to), 0.5)); const mc = mids.reduce((a, q) => add(a, q), [0, 0, 0]).map((x) => x / mids.length);
  return act.map((k, n) => {
    const r = restingArrow(mol, mol.dipoles[k]); const rm = mul(add(r.from, r.to), 0.5); const rp = perpXY(sub(r.to, r.from)); const rs = dot(rp, sub(rm, cen)) >= 0 ? 1 : -1;
    const dv = sub(chain.drawn[k].to, chain.drawn[k].from); const cp = perpXY(dv); const away = dot(cp, sub(mids[n], mc)); const cs = Math.abs(away) > 1e-6 ? Math.sign(away) : (chain.drawn[k].from[1] - chain.arrows[k].from[1] >= 0 ? 1 : -1);
    const d = mol.dipoles[k]; return { k, n: n + 1, color: DIPOLE_TAGS[n % DIPOLE_TAGS.length], name: `${mol.atoms[d.plus].el}→${mol.atoms[d.minus].el} bond ${n + 1}`, restOffset: mul(rp, 0.34 * rs), copyOffset: mul(cp, 0.34 * cs) };
  });
}

const layoutCache = new Map();
/** Positions of the vector-sum diagram and the box the camera must fit. placement: "below" (narrow screens) or "right". */
export function layoutOf(mol, placement = "below") {
  const key = `${mol.id}|${placement}`; if (layoutCache.has(key)) return layoutCache.get(key);
  const xs = mol.atoms.map((a) => a.p[0]); const ys = mol.atoms.map((a) => a.p[1]);
  const depth = Math.max(...mol.atoms.map((a) => Math.abs(a.p[2]))); const pad = 1.2 + depth * 0.45;
  const mb = { minX: Math.min(...xs) - pad - 0.55, maxX: Math.max(...xs) + pad + 0.55, minY: Math.min(...ys) - pad - 0.25, maxY: Math.max(...ys) + pad + 0.6 };
  // diagram extents with its start at the origin of its own frame
  const pts = [[0, 0]]; let p = [0, 0, 0];
  if (diagramKind(mol) === "para") { const vs = chainOrder(mol).map((k) => vecOf(mol.dipoles[k], mol)); pts.push([vs[0][0], vs[0][1]], [vs[1][0], vs[1][1]], [vs[0][0] + vs[1][0], vs[0][1] + vs[1][1]]); } else for (const k of chainOrder(mol)) { p = add(p, vecOf(mol.dipoles[k], mol)); pts.push([p[0], p[1]]); }
  const hasChain = pts.length > 1; const nx = pts.map((q) => q[0]); const ny = pts.map((q) => q[1]);
  const bb = { minX: Math.min(...nx) - 0.45, maxX: Math.max(...nx) + 0.45, minY: Math.min(...ny) - 0.45, maxY: Math.max(...ny) + 0.45 };
  const cx = (mb.minX + mb.maxX) / 2; const cy = (mb.minY + mb.maxY) / 2; const hw = Math.max(2.1, (bb.maxX - bb.minX) / 2); const hh = (bb.maxY - bb.minY) / 2;
  let dc; // diagram centre
  if (!hasChain) dc = [cx, mb.minY - 0.9];
  else if (placement === "right") dc = [mb.maxX + 0.35 + hw, cy]; else dc = [cx, mb.minY - 1.25 - hh - 0.15]; // below the molecule: leave room for the two-line 'Vector sum' title above the diagram, clear of the delta tags
  const origin = [dc[0] - (bb.minX + bb.maxX) / 2, dc[1] - (bb.minY + bb.maxY) / 2, 0];
  const box = hasChain ? { minX: dc[0] - hw, maxX: dc[0] + hw, minY: dc[1] - hh, maxY: dc[1] + hh } : { minX: dc[0] - 1, maxX: dc[0] + 1, minY: dc[1] - 0.4, maxY: dc[1] + 0.4 };
  const labelY = box.minY - 0.45; const bounds = { minX: Math.min(mb.minX, box.minX), maxX: Math.max(mb.maxX, box.maxX), minY: Math.min(mb.minY, labelY - 0.4), maxY: Math.max(mb.maxY, box.maxY + 1.05) };
  const out = { hasChain, origin, box, bounds, labelY, titleY: box.maxY + 0.62, mol: mb, placement }; layoutCache.set(key, out); return out;
}
/** Start of the vector-sum diagram (kept for the tests and the scene). */
export const originOf = (mol, placement = "below") => layoutOf(mol, placement).origin;

/** State at progress u (0..1): { arrows (the copies that travel to the vector-sum picture), rest (the arrows ALONG the bonds in the molecule), resultant (in the vector-sum picture), molResultant (in the molecule),
 *  para (dashed parallelogram edges), zero, stage, chainEnd }. All directions are the 3D bond vectors, unrotated and unmirrored. */
export function vectorFrame(mol, u, mode = "overall", placement = "below") {
  const rest = mol.dipoles.map((d) => (isActive(mol, d) ? restingArrow(mol, d) : null));
  const faint = (d) => (d.polar ? 1 : 0.6);
  if (mode === "model") return { arrows: rest.map(() => null), rest: rest.map(() => null), resultant: null, molResultant: null, para: null, zero: 0, stage: "model" };
  const restOn = (o) => rest.map((r, k) => (r ? { ...r, opacity: o * faint(mol.dipoles[k]) } : null));
  if (mode === "bonds") return { arrows: restOn(1), rest: restOn(1), resultant: null, molResultant: null, para: null, zero: 0, stage: "bonds" };
  const rv = seg(u, PHASES.reveal); const res = seg(u, PHASES.result);
  const lay = layoutOf(mol, placement); const chain = chainArrows(mol, placement, lay.origin);
  // two dipoles from a common origin move together (step 3); a tip-to-tail chain is laid one arrow after another across steps 3 and 4
  const order = chainOrder(mol); const N = order.length; const L = (2 * (PHASES.complete[1] - PHASES.add[0])) / (N + 1);
  const avOf = (k) => { if (chain.kind === "para" || N < 2) return seg(u, PHASES.add); const n = order.indexOf(k); const a0 = PHASES.add[0] + (PHASES.complete[1] - PHASES.add[0] - L) * (n / (N - 1)); return seg(u, [a0, a0 + L]); };
  const av = Math.min(...mol.dipoles.map((d, k) => (isActive(mol, d) ? avOf(k) : 1)));
  const arrows = rest.map((r, k) => {
    if (!r) return null; const c = chain.drawn[k]; const a = avOf(k); if (a < 0.001) return null;
    return { from: lerp3(r.from, c.from, a), to: lerp3(r.to, c.to, a), opacity: faint(mol.dipoles[k]), t: a };
  });
  const net = mol.net; const target = add(lay.origin, mul(net.vector, arrowScale(mol)));
  const resultant = net.polar && res > 0 ? { from: lay.origin, to: lerp3(lay.origin, target, res), opacity: res } : null;
  const mr = moleculeResultant(mol); const molResultant = mr && res > 0 ? { from: mr.from, to: lerp3(mr.from, mr.to, res), opacity: res } : null;
  const para = chain.kind === "para" && u >= PHASES.complete[0] ? chain.arrows.filter(Boolean).map((a, n, all) => ({ from: a.to, to: chain.end, opacity: 1, n, all: all.length })) : null;
  const stage = stageAt(u); void av;
  return { arrows, rest: restOn(rv), resultant, molResultant, para, zero: net.zero ? res : 0, stage, chainEnd: chain.end, chainVisible: u >= PHASES.add[0] ? 1 : 0 };
}
/** The explanation text for the molecule, reduced to what the current stage may say (the classification and the full explanation only at step 6). */
export const stageText = (mol, stage) => ({
  model: `${mol.geometry}${mol.angles[0] ? `, bond angle about ${Math.min(...mol.angles.map((a) => a.deg)).toFixed(1).replace(/\.0$/, "")}°` : ""}.`,
  bonds: mol.dipoles.some((d) => d.polar) ? "Each polar bond has a bond dipole pointing towards the more electronegative atom." : mol.dipoles.some((d) => d.weak) ? "The C–H bonds are only very slightly polar (below the usual 0.4 cut-off): shown faint, and they cancel anyway." : "No bond here is polar enough to draw a dipole.",
  geometry: `The molecule and its partial charges: ${mol.geometry.toLowerCase()}${mol.angles[0] ? `, bond angle about ${Math.min(...mol.angles.map((a) => a.deg)).toFixed(1).replace(/\.0$/, "")}°` : ""}.`,
  reveal: mol.dipoles.some((d) => d.polar) ? "Each polar bond has a bond dipole pointing towards the more electronegative atom." : "No bond is polar enough to draw a dipole (very small C–H dipoles are shown faint).",
  add: "Copies of the bond dipoles move into the vector-sum picture; their lengths and directions do not change.",
  complete: diagramKindOf(mol) === "para" ? "Complete the parallelogram: the dashed sides are copies of the two dipoles." : "Finish the sum: each dipole starts where the previous one ends.",
  result: mol.net.polar ? "The resultant (pink) runs from the start to the end of the sum." : "The bond dipoles cancel: the sum comes back to the start, so there is no resultant arrow.",
  classify: mol.explain,
}[stage] ?? mol.explain);
function diagramKindOf(mol) { return diagramKind(mol); }
export { dot };
