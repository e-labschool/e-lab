// Module 6 -- SOLUTION CALCULATIONS.  c = n / V with V in dm3 (1 dm3 = 1000 mL), c in mol dm^-3.
import { clean, toQuanta, fromQuanta } from "./numeric.js";

export const mlToDm3 = (mL) => clean(mL / 1000);
export const dm3ToMl = (dm3) => clean(dm3 * 1000);

/** c = n / V.  V is the FINAL VOLUME OF THE SOLUTION (made up to the calibration mark), not the volume of water added. */
export function concentration(nMol, volumeMl) {
  if (!Number.isFinite(nMol) || nMol < 0) return { ok: false, c: NaN, error: "Amount cannot be negative." };
  if (!Number.isFinite(volumeMl) || volumeMl <= 0) return { ok: false, c: NaN, error: "Final volume must be greater than zero." };
  return { ok: true, c: clean(nMol / mlToDm3(volumeMl)), error: null };
}
/** n = c V. */
export function amountFromConcentration(cMolDm3, volumeMl) {
  if (!Number.isFinite(cMolDm3) || cMolDm3 < 0 || !Number.isFinite(volumeMl) || volumeMl < 0) return { ok: false, n: NaN, nQ: 0, error: "Concentration and volume cannot be negative." };
  const n = clean(cMolDm3 * mlToDm3(volumeMl)); return { ok: true, n, nQ: toQuanta(n), error: null };
}
/** V = n / c (mL). */
export function volumeForConcentration(nMol, cMolDm3) {
  if (!Number.isFinite(cMolDm3) || cMolDm3 <= 0) return { ok: false, volumeMl: NaN, error: "Concentration must be greater than zero." };
  return { ok: true, volumeMl: dm3ToMl(clean(nMol / cMolDm3)), error: null };
}
/** Particle-viewer scale: ions per unit volume is proportional to c; both beakers MUST use this same scale to be comparable (D, Exp. 5). */
export function relativeIonDensity(cMolDm3, referenceCMolDm3 = 5) { return clean(Math.min(1, Math.max(0, cMolDm3 / referenceCMolDm3))); }

/** Preparation of a solution of a solid from a mass: n = m / M, c = n / V (final volume V). */
export function prepareSolution({ massG, molarMassGPerMol, finalVolumeMl }) {
  if (!Number.isFinite(massG) || massG < 0) return { ok: false, error: "Mass cannot be negative." };
  if (!Number.isFinite(molarMassGPerMol) || molarMassGPerMol <= 0) return { ok: false, error: "Molar mass must be greater than zero." };
  const n = clean(massG / molarMassGPerMol); const r = concentration(n, finalVolumeMl);
  if (!r.ok) return r;
  return { ok: true, n, nQ: toQuanta(n), c: r.c, finalVolumeMl, error: null };
}
export { fromQuanta };
