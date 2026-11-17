// Turns the packets of a scene into drawable bench entries: individual bags, plus ONE exact "× N full packets" stack per
// substance when there are too many to draw one by one (spec D Stage 2).  Pure; the stack carries an exact count, never an estimate.
import { PACKET_CAPACITY_Q } from "../engine/packets.js";

export function packEntries(packets, cap = 6) {
  const bag = (p) => ({ key: p.id, type: "bag", packet: p });
  if (packets.length <= cap) return packets.map(bag);
  const subs = [...new Set(packets.map((p) => p.substanceId))];
  const full = (p) => p.q === PACKET_CAPACITY_Q;
  const nonFull = packets.filter((p) => !full(p)); const fullBy = Object.fromEntries(subs.map((s) => [s, packets.filter((p) => p.substanceId === s && full(p))]));
  const totalFull = packets.filter(full).length; const nsubs = subs.filter((s) => fullBy[s].length).length;
  const avail = Math.max(0, cap - nonFull.length - nsubs);
  const keep = {}; for (const s of subs) keep[s] = Math.min(fullBy[s].length, Math.max(1, Math.floor((avail * fullBy[s].length) / Math.max(1, totalFull))));
  const out = []; const stacked = new Set(); const keptSeen = {};
  for (const p of packets) {
    if (!full(p)) { out.push(bag(p)); continue; }
    keptSeen[p.substanceId] = (keptSeen[p.substanceId] ?? 0) + 1;
    if (keptSeen[p.substanceId] <= keep[p.substanceId]) out.push(bag(p));
    else if (!stacked.has(p.substanceId)) { stacked.add(p.substanceId); out.push({ key: `stack:${p.substanceId}`, type: "stack", substanceId: p.substanceId, count: fullBy[p.substanceId].length - keep[p.substanceId] }); }
  }
  return out;
}
