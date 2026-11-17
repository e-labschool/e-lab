// Module 7 -- DILUTION.  C1 V1 = C2 V2, and the moles travel WITH the aliquot (spec D Stage 3, Experiment 4).
import { clean, toQuanta, fromQuanta } from "./numeric.js";
import { mlToDm3 } from "./solutions.js";

/** A solution is { nQ (integer quanta), volumeMl }.  Concentration is always derived, never stored. */
export const solutionConc = (sol) => (sol.volumeMl > 0 ? clean(fromQuanta(sol.nQ) / mlToDm3(sol.volumeMl)) : 0);

/**
 * Take an aliquot of `aliquotMl` from `stock`, then make it up to `finalVolumeMl`.
 * The aliquot carries n = c1 V1 moles; the stock keeps the rest (conservation: stock before = stock after + aliquot).
 * Returns { ok, stockAfter, diluted, nAliquotQ, c1, c2, dilutionFactor, error }.
 */
export function dilute(stock, aliquotMl, finalVolumeMl) {
  if (!Number.isFinite(aliquotMl) || aliquotMl <= 0) return { ok: false, error: "The aliquot volume must be greater than zero." };
  if (aliquotMl > stock.volumeMl + 1e-9) return { ok: false, error: "You cannot take more solution than the stock contains." };
  if (!Number.isFinite(finalVolumeMl) || finalVolumeMl < aliquotMl) return { ok: false, error: "The final volume must be at least the aliquot volume." };
  const c1 = solutionConc(stock);
  // aliquot moles in quanta: stock moles x (aliquot / stock volume); round once, the stock keeps the exact remainder
  const nAliquotQ = Math.min(stock.nQ, Math.round((stock.nQ * aliquotMl) / stock.volumeMl));
  const diluted = { nQ: nAliquotQ, volumeMl: finalVolumeMl };
  const stockAfter = { nQ: stock.nQ - nAliquotQ, volumeMl: clean(stock.volumeMl - aliquotMl) };
  const c2 = solutionConc(diluted);
  return { ok: true, stockAfter, diluted, nAliquotQ, nAliquotMol: fromQuanta(nAliquotQ), c1, c2, dilutionFactor: clean(finalVolumeMl / aliquotMl), error: null };
}
/** Direct C1V1 = C2V2 solver: give any three, get the fourth. Exactly one of the four must be null. */
export function c1v1c2v2({ c1 = null, v1 = null, c2 = null, v2 = null }) {
  const missing = [c1, v1, c2, v2].filter((x) => x == null).length;
  if (missing !== 1) return { ok: false, error: "Give exactly three of C1, V1, C2, V2." };
  const bad = [c1, v1, c2, v2].some((x) => x != null && (!Number.isFinite(x) || x < 0));
  if (bad) return { ok: false, error: "Values cannot be negative." };
  if (c1 == null) { if (!v1) return { ok: false, error: "V1 must be greater than zero." }; return { ok: true, c1: clean((c2 * v2) / v1), v1, c2, v2 }; }
  if (v1 == null) { if (!c1) return { ok: false, error: "C1 must be greater than zero." }; return { ok: true, c1, v1: clean((c2 * v2) / c1), c2, v2 }; }
  if (c2 == null) { if (!v2) return { ok: false, error: "V2 must be greater than zero." }; return { ok: true, c1, v1, c2: clean((c1 * v1) / v2), v2 }; }
  if (!c2) return { ok: false, error: "C2 must be greater than zero." }; return { ok: true, c1, v1, c2, v2: clean((c1 * v1) / c2) };
}
export { toQuanta };
