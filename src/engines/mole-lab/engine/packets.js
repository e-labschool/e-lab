// Module 4 -- PACKET DECOMPOSITION.  Every packet has the same fixed capacity of ONE MOLE.  Amounts are integer quanta.
//   n = 2.50 mol -> 2 full packets + 1 half-filled packet.   Overflow never exceeds a packet: it creates another packet.
import { ONE_MOLE_Q, fromQuanta } from "./numeric.js";

export const PACKET_CAPACITY_Q = ONE_MOLE_Q;

/** Canonical decomposition of q quanta: { fullCount, partialQ, packetsQ[], totalQ, isZero }.  packetsQ lists every packet's amount (full first, partial last). */
export function decompose(q) {
  if (!Number.isInteger(q) || q < 0) throw new Error("decompose: q must be a non-negative integer number of quanta");
  const fullCount = Math.floor(q / ONE_MOLE_Q);
  const partialQ = q - fullCount * ONE_MOLE_Q;
  const packetsQ = Array.from({ length: fullCount }, () => ONE_MOLE_Q);
  if (partialQ > 0) packetsQ.push(partialQ);
  return { fullCount, partialQ, partialFraction: partialQ / ONE_MOLE_Q, packetsQ, totalQ: q, isZero: q === 0, packetCount: packetsQ.length };
}

/** Fill fraction (0..1) of a packet holding q quanta: ONLY the fraction of the one-mole capacity, never a density. */
export const fillFraction = (q) => Math.min(1, Math.max(0, q / ONE_MOLE_Q));

/** Human description: "2 full packets + 1 half-filled packet". */
export function describeDecomposition(q) {
  const d = decompose(q);
  if (d.isZero) return "no material";
  const parts = [];
  if (d.fullCount) parts.push(`${d.fullCount} full packet${d.fullCount === 1 ? "" : "s"}`);
  if (d.partialQ) {
    const f = d.partialFraction;
    const name = f === 0.25 ? "quarter-filled" : f === 0.5 ? "half-filled" : f === 0.75 ? "three-quarter-filled" : `${Math.round(f * 1000) / 10}%-filled`;
    parts.push(`1 ${name} packet`);
  }
  return parts.join(" + ");
}

/**
 * Grouped representation for large amounts (spec D Stage 2): at most `maxIndividual` packets are drawn one by one; the
 * remaining FULL packets are summarised as one group with an exact count.  The partial packet is always drawn individually.
 */
export function representPackets(q, { maxIndividual = 6 } = {}) {
  const d = decompose(q);
  const hasPartial = d.partialQ > 0;
  const slots = Math.max(1, maxIndividual) - (hasPartial ? 1 : 0);
  const individualFull = Math.min(d.fullCount, slots);
  const groupedFull = d.fullCount - individualFull;
  return {
    fullCount: d.fullCount, partialQ: d.partialQ, individualFull, groupedFull, groupedMol: fromQuanta(groupedFull * ONE_MOLE_Q),
    grouped: groupedFull > 0, label: groupedFull > 0 ? `${groupedFull} more full packet${groupedFull === 1 ? "" : "s"} (${groupedFull} mol)` : null,
    drawn: individualFull + (groupedFull > 0 ? 1 : 0) + (hasPartial ? 1 : 0), totalQ: q,
  };
}

/**
 * Adjust the TOTAL held in an ordered packet list to `targetQ`, preserving the packets that exist:
 *  - increasing: fill existing packets in order up to capacity, then create new packets (full ones, then a partial);
 *  - decreasing: empty the LAST packet first, removing packets that become empty.
 * The returned list always sums to exactly targetQ and no packet exceeds capacity.  `newId()` supplies ids for new packets.
 * keepOne: keep a single empty packet when the target is 0 (Stage 2 shows an empty reference packet).
 * @param {{id:string,q:number}[]} packets
 */
export function adjustTotal(packets, targetQ, newId, { keepOne = false } = {}) {
  if (!Number.isInteger(targetQ) || targetQ < 0) throw new Error("adjustTotal: target must be a non-negative integer number of quanta");
  const out = packets.map((p) => ({ ...p }));
  let sum = out.reduce((a, p) => a + p.q, 0);
  if (targetQ > sum) {
    let delta = targetQ - sum;
    for (const p of out) { const room = PACKET_CAPACITY_Q - p.q; const add = Math.min(room, delta); p.q += add; delta -= add; if (!delta) break; }
    while (delta > 0) { const add = Math.min(PACKET_CAPACITY_Q, delta); out.push({ id: newId(), q: add }); delta -= add; }
  } else if (targetQ < sum) {
    let cut = sum - targetQ;
    for (let i = out.length - 1; i >= 0 && cut > 0; i -= 1) { const take = Math.min(out[i].q, cut); out[i].q -= take; cut -= take; }
  }
  const kept = out.filter((p) => p.q > 0 || false);
  if (!kept.length && keepOne) return [out[0] ? { ...out[0], q: 0 } : { id: newId(), q: 0 }];
  return kept;
}
export const sumQ = (packets) => packets.reduce((a, p) => a + p.q, 0);
