// Explore workspace helpers (pure): adding molecules without overlap, default layout, separation changes, rotation, validation of
// restored session state. A workspace entry is { uid, id, pos:[x,y,z] (A), quat:[x,y,z,w] }.
import { MOLECULES, TRAY_NONPOLAR, TRAY_POLAR } from "./molecules.js";
import { QID, add, dist, norm, qFromAxisAngle, qMul, qNorm, scale, sub } from "./vec.js";

export const MAX_IN_WORKSPACE = 6;
export const BOUND = 11; // A: molecules are kept inside +-BOUND on every axis
export const START_GAP = 6; // A between the molecule surfaces when the workspace is first laid out
export const MIN_SEPARATION_FACTOR = 0.9; // fraction of the vdW-radius sum below which the molecules are treated as touching
const KNOWN = new Set([...TRAY_NONPOLAR, ...TRAY_POLAR, "Ne", "F2"]);

export const clampPos = (p) => p.map((v) => Math.max(-BOUND, Math.min(BOUND, v)));
const clone = (m) => ({ uid: m.uid, id: m.id, pos: [...m.pos], quat: [...m.quat] });
export const cloneAll = (list) => list.map(clone);
export const nextUid = (list) => list.reduce((mx, m) => Math.max(mx, m.uid), 0) + 1;
const minDistance = (a, b) => (MOLECULES[a].radius + MOLECULES[b].radius) * 0.62 + 0.6;
export const overlaps = (list, id, pos, ignoreUid = -1) => list.some((m) => m.uid !== ignoreUid && dist(m.pos, pos) < minDistance(m.id, id));

/** Position for a new molecule: the wanted point if it is free, otherwise the nearest free spot on a widening ring around it. */
export function freeSpot(list, id, want = null) {
  const start = want ? clampPos(want) : [list.length % 2 === 0 ? -1 : 1, 0, 0].map((v, i) => (i === 0 ? v * (MOLECULES[id].radius + 3.6) : 0));
  if (!overlaps(list, id, start)) return start;
  for (let ring = 1; ring < 24; ring += 1) for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2 + ring * 0.4; const p = clampPos(add(start, [Math.cos(a) * ring * 1.6, Math.sin(a) * ring * 1.1, 0]));
    if (!overlaps(list, id, p)) return p;
  }
  return start;
}
export function addMolecule(list, id, want = null) {
  if (!KNOWN.has(id) || list.length >= MAX_IN_WORKSPACE) return list;
  return [...cloneAll(list), { uid: nextUid(list), id, pos: freeSpot(list, id, want), quat: [...QID] }];
}
export const removeMolecule = (list, uid) => list.filter((m) => m.uid !== uid).map(clone);
/** Default layout: molecules in a row along x, START_GAP apart (surface to surface), identity orientation. */
export function layoutRow(list, gap = START_GAP) {
  const out = cloneAll(list); const radii = out.map((m) => MOLECULES[m.id].radius); const total = radii.reduce((s, r) => s + 2 * r, 0) + gap * (out.length - 1); let x = -total / 2;
  out.forEach((m, i) => { m.pos = [x + radii[i], 0, 0]; m.quat = [...QID]; x += 2 * radii[i] + gap; });
  return out;
}
/** The two molecules that are closest to each other (the focus pair), or null. */
export function focusPair(list) {
  let best = null; for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) { const d = dist(list[i].pos, list[j].pos); if (!best || d < best.d) best = { i, j, d }; }
  return best;
}
/** Change the centre-to-centre distance of the focus pair by `delta` A (negative = closer), moving both molecules symmetrically; never below the touching distance. */
export function changeSeparation(list, delta, pair = focusPair(list)) {
  if (!pair) return list;
  const out = cloneAll(list); const a = out[pair.i]; const b = out[pair.j]; const d = dist(a.pos, b.pos); const dir = d > 1e-6 ? norm(sub(b.pos, a.pos)) : [1, 0, 0];
  const floor = (MOLECULES[a.id].radius + MOLECULES[b.id].radius) * 0.45; const nd = Math.max(floor, d + delta); const mid = scale(add(a.pos, b.pos), 0.5);
  a.pos = clampPos(sub(mid, scale(dir, nd / 2))); b.pos = clampPos(add(mid, scale(dir, nd / 2)));
  return out;
}
export function rotateEntry(list, uid, axis, angleRad) {
  return list.map((m) => (m.uid === uid ? { ...clone(m), quat: qNorm(qMul(qFromAxisAngle(axis, angleRad), m.quat)) } : clone(m)));
}
export function moveEntry(list, uid, delta) { return list.map((m) => (m.uid === uid ? { ...clone(m), pos: clampPos(add(m.pos, delta)) } : clone(m))); }
export const separationOf = (list) => { const f = focusPair(list); return f ? f.d : null; };
export function fromPoses(ids, poses, startUid = 1) { return ids.map((id, i) => ({ uid: startUid + i, id, pos: [...poses[i].pos], quat: [...poses[i].quat] })); }

/** Defensive parse of session-restored workspace state. */
export function validateWorkspace(raw) {
  if (!Array.isArray(raw)) return false;
  return raw.length <= MAX_IN_WORKSPACE && raw.every((m) => m && Number.isFinite(m.uid) && KNOWN.has(m.id) && Array.isArray(m.pos) && m.pos.length === 3 && m.pos.every(Number.isFinite) && Array.isArray(m.quat) && m.quat.length === 4 && m.quat.every(Number.isFinite) && Math.abs(Math.hypot(m.quat[0], m.quat[1], m.quat[2], m.quat[3]) - 1) < 0.01);
}
