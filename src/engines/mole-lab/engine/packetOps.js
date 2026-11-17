// Generic, stage-independent operations on a SCENE (a bench of packets and vessels).  Pure functions: every op takes a scene
// and returns { scene, notice } where `notice` = { ok, code, message }.  On any rejection the SAME scene object is returned,
// so a refused or repeated action can never change, duplicate or destroy material.
//
// CONSERVATION: split / combine / pour move whole integer quanta between containers; the total per substance is invariant.
// `react` changes substances only by integer multiples of the stoichiometric coefficients (atoms and charge conserved).
import { ONE_MOLE_Q, fromQuanta } from "./numeric.js";
import { PACKET_CAPACITY_Q } from "./packets.js";
import { getSubstance } from "./substances.js";
import { getReaction, applyExtent } from "./reactions.js";
import { limitingReagent } from "./limiting.js";

const ok = (code, message, extra = {}) => ({ ok: true, code, message, ...extra });
const no = (code, message) => ({ ok: false, code, message });
const refuse = (scene, code, message) => ({ scene, notice: no(code, message) });

export const findPacket = (scene, id) => scene.packets.find((p) => p.id === id) ?? null;
export const findVessel = (scene, id) => (scene.vessels ?? []).find((v) => v.id === id) ?? null;
export const replacePacket = (scene, id, patch) => ({ ...scene, packets: scene.packets.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
const takeId = (scene, prefix = "p") => ({ id: `${prefix}${scene.nextId}`, scene: { ...scene, nextId: scene.nextId + 1 } });

export function newPacket(scene, substanceId, q, { open = false, role = "main" } = {}) {
  getSubstance(substanceId);
  if (!Number.isInteger(q) || q < 0 || q > PACKET_CAPACITY_Q) throw new Error("newPacket: invalid amount");
  const t = takeId(scene);
  return { scene: { ...t.scene, packets: [...t.scene.packets, { id: t.id, substanceId, q, open, role }] }, id: t.id };
}

export function openPacket(scene, id) {
  const p = findPacket(scene, id); if (!p) return refuse(scene, "missing", "That packet is not on the bench.");
  if (p.open) return { scene, notice: ok("already-open", "The packet is already open.") };
  return { scene: replacePacket(scene, id, { open: true }), notice: ok("opened", "Zipper opened.") };
}
export function closePacket(scene, id) {
  const p = findPacket(scene, id); if (!p) return refuse(scene, "missing", "That packet is not on the bench.");
  if (!p.open) return { scene, notice: ok("already-closed", "The packet is already closed.") };
  return { scene: replacePacket(scene, id, { open: false }), notice: ok("closed", "Zipper closed.") };
}

/** Split `q` quanta off packet `id` into a NEW closed packet (default: half).  Total unchanged. */
export function splitPacket(scene, id, q = null) {
  const p = findPacket(scene, id); if (!p) return refuse(scene, "missing", "Select a packet to split.");
  if (p.q < 2) return refuse(scene, "too-small", "That packet is too small to split.");
  const take = q == null ? Math.floor(p.q / 2) : q;
  if (!Number.isInteger(take) || take <= 0 || take >= p.q) return refuse(scene, "bad-amount", "Choose an amount that is more than zero and less than the packet holds.");
  const t = takeId(scene);
  const packets = [];
  for (const x of t.scene.packets) { packets.push(x.id === id ? { ...x, q: x.q - take } : x); if (x.id === id) packets.push({ id: t.id, substanceId: p.substanceId, q: take, open: false, role: p.role }); }
  return { scene: { ...t.scene, packets }, notice: ok("split", `Split ${fromQuanta(take)} mol into a new packet.`, { newId: t.id }) };
}

/** Move as much of packet b as fits into packet a (same substance only).  b keeps any overflow, so nothing exceeds one mole. */
export function combinePackets(scene, aId, bId) {
  const a = findPacket(scene, aId); const b = findPacket(scene, bId);
  if (!a || !b) return refuse(scene, "missing", "Both packets must be on the bench.");
  if (aId === bId) return refuse(scene, "same", "Choose two different packets.");
  if (a.substanceId !== b.substanceId) return refuse(scene, "incompatible", "Only packets of the same substance can be combined; mixing different substances is a separate, explicit operation.");
  const room = PACKET_CAPACITY_Q - a.q; const move = Math.min(room, b.q);
  if (move <= 0) return refuse(scene, "full", "The destination packet is already full (one mole is the most a packet holds).");
  let packets = scene.packets.map((p) => (p.id === aId ? { ...p, q: p.q + move } : p.id === bId ? { ...p, q: p.q - move } : p));
  packets = packets.filter((p) => p.q > 0 || p.id !== bId || packets.length === 1);
  return { scene: { ...scene, packets }, notice: ok("combined", `Combined ${fromQuanta(move)} mol.`, { movedQ: move, overflowQ: b.q - move }) };
}

/** Merge every packet of a substance into the canonical layout (full packets, then one partial).  Keeps the earliest ids. */
export function compactPackets(scene, substanceId) {
  const mine = scene.packets.filter((p) => p.substanceId === substanceId);
  if (mine.length < 2) return { scene, notice: ok("nothing", "Nothing to combine.") };
  const total = mine.reduce((a, p) => a + p.q, 0);
  let left = total; const out = []; let touched = false;
  for (const p of scene.packets) {
    if (p.substanceId !== substanceId) { out.push(p); continue; }
    const q = Math.min(PACKET_CAPACITY_Q, left); left -= q;
    if (q > 0) out.push({ ...p, q, open: p.open }); else touched = true;
  }
  if (!out.some((p) => p.substanceId === substanceId)) out.push({ ...mine[0], q: 0 });
  return { scene: { ...scene, packets: out }, notice: ok("compacted", "Combined into full packets.", { changed: touched || true }) };
}

/**
 * POUR amount from an OPEN source packet into an OPEN destination packet (same substance) or into a vessel that accepts it.
 * Source and destination are updated in the SAME step.  Refused (scene returned unchanged) when: the source is closed,
 * the destination is missing / closed / incompatible / full, the source is empty, or source === destination.
 */
export function pourPacket(scene, sourceId, destId, q = null) {
  const src = findPacket(scene, sourceId);
  if (!src) return refuse(scene, "missing", "The source packet is not on the bench.");
  if (!src.open) return refuse(scene, "closed", "The packet is closed: open the zipper before pouring.");
  if (src.q <= 0) return refuse(scene, "empty", "That packet is empty.");
  if (sourceId === destId) return refuse(scene, "same", "Choose a different destination.");
  if (q != null && (!Number.isInteger(q) || q <= 0)) return refuse(scene, "bad-amount", "Choose an amount greater than zero.");
  const dstP = findPacket(scene, destId); const dstV = dstP ? null : findVessel(scene, destId);
  if (!dstP && !dstV) return refuse(scene, "no-target", "Drop the packet on a valid target to pour.");
  const want = Math.min(src.q, q ?? src.q);
  if (dstP) {
    if (dstP.substanceId !== src.substanceId) return refuse(scene, "incompatible", "Those are different substances. Mixing needs an explicit mixture step.");
    if (!dstP.open) return refuse(scene, "dest-closed", "Open the destination packet first.");
    const move = Math.min(want, PACKET_CAPACITY_Q - dstP.q);
    if (move <= 0) return refuse(scene, "full", "The destination packet is full: a packet never holds more than one mole.");
    let packets = scene.packets.map((p) => (p.id === sourceId ? { ...p, q: p.q - move } : p.id === destId ? { ...p, q: p.q + move } : p));
    if (packets.find((p) => p.id === sourceId).q === 0 && packets.length > 1) packets = packets.filter((p) => p.id !== sourceId);
    return { scene: { ...scene, packets }, notice: ok("poured", `Poured ${fromQuanta(move)} mol.`, { movedQ: move, remainderQ: src.q - move }) };
  }
  if (!dstV.accepts.includes(src.substanceId)) return refuse(scene, "incompatible", "That container does not accept this substance.");
  const total = Object.values(dstV.contents).reduce((a, b) => a + b, 0);
  const room = dstV.capacityQ == null ? Infinity : dstV.capacityQ - total;
  const move = Math.min(want, room);
  if (move <= 0) return refuse(scene, "full", "That container is full.");
  const vessels = scene.vessels.map((v) => (v.id === destId ? { ...v, contents: { ...v.contents, [src.substanceId]: (v.contents[src.substanceId] || 0) + move } } : v));
  let packets = scene.packets.map((p) => (p.id === sourceId ? { ...p, q: p.q - move } : p));
  if (packets.find((p) => p.id === sourceId).q === 0 && packets.length > 1) packets = packets.filter((p) => p.id !== sourceId);
  return { scene: { ...scene, packets, vessels }, notice: ok("poured", `Poured ${fromQuanta(move)} mol.`, { movedQ: move, remainderQ: src.q - move }) };
}

/** React the contents of a vessel by the limiting extent (or a smaller explicit `extentQ`).  Conserves atoms and charge exactly. */
export function reactVessel(scene, vesselId, reactionId, extentQ = null) {
  const v = findVessel(scene, vesselId); if (!v) return refuse(scene, "missing", "No such reaction vessel.");
  let r; try { r = getReaction(reactionId); } catch { return refuse(scene, "unknown-reaction", "Unknown reaction."); }
  const lim = limitingReagent(r, v.contents);
  if (lim.noReaction) return refuse(scene, "no-reaction", lim.reason);
  const xi = extentQ == null ? lim.extentQ : extentQ;
  if (!Number.isInteger(xi) || xi <= 0 || xi > lim.extentQ) return refuse(scene, "bad-extent", "That extent is more than the reactants allow.");
  const contents = applyExtent(r, v.contents, xi);
  return { scene: { ...scene, vessels: scene.vessels.map((x) => (x.id === vesselId ? { ...x, contents } : x)) }, notice: ok("reacted", "Reaction complete.", { extentQ: xi, result: lim }) };
}

export { ONE_MOLE_Q };
