// Adding strong acid / strong base to a known volume of water (pure). Moles are tracked, the volume grows, and the exact
// charge-balance solver gives [H+] (so water autoionisation matters near pH 7 and nothing "multiplies by 5").
import { solveSolution } from "./solver.js";

export const WATER_VOLUME_CM3 = 100;
export const DROP_CM3 = 0.05; // 20 drops per cm3
export const MAX_ADDED_CM3 = 100; // equal to the starting volume: the beaker is then 200 cm3

export function waterState({ hclDrops = 0, naohDrops = 0, c = 0.1, v0 = WATER_VOLUME_CM3, drop = DROP_CM3, kw }) {
  const vAdded = (hclDrops + naohDrops) * drop;
  const V = (v0 + vAdded) / 1000; // dm3
  const nH = (c * hclDrops * drop) / 1000; // mol of H+ delivered by HCl
  const nOH = (c * naohDrops * drop) / 1000; // mol of OH- delivered by NaOH
  const r = solveSolution({ strongAnions: nH / V, strongCations: nOH / V, ...(kw ? { kw } : {}) });
  return { ...r, nH, nOH, vAdded, totalCm3: v0 + vAdded, V, hclDrops, naohDrops, atLimit: vAdded >= MAX_ADDED_CM3 - 1e-9 };
}
