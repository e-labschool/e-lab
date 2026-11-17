// Paper chromatography model. Pure JS.
//
// Rf = (distance moved by the spot) / (distance moved by the solvent front), both measured from the BASELINE.
// A spot's Rf is a property of the substance, the solvent and the paper (here: the `rf` table in chem.js, model values).
// The solvent front rises roughly with the square root of time (capillary rise); a spot sits at Rf x (front distance).
import { SUBSTANCES } from "./chem.js";

/** Paper geometry in cm, measured from the bottom edge of the paper strip. */
export const CHROMA = { paperHeight: 12, baseline: 1.5, solventLine: 0.8, top: 11.0 };

/** Rf from two measured distances (any consistent unit). null if the solvent front has not passed the baseline. */
export function rfFrom(spotDistance, frontDistance) {
  if (!(frontDistance > 0) || !Number.isFinite(spotDistance)) return null;
  return spotDistance / frontDistance;
}

/** Round a distance in cm to the nearest millimetre, as a student would read it off a ruler. */
export const toMm = (cm) => Math.round(cm * 10);

/** Rf worked from distances measured with a ruler to the nearest mm: returns { spotMm, frontMm, rf (to 2 d.p.), unrounded }. */
export function measureRf(spotCm, frontCm) {
  const spotMm = toMm(spotCm); const frontMm = toMm(frontCm);
  const raw = rfFrom(spotMm, frontMm);
  return { spotMm, frontMm, rf: raw == null ? null : Math.round(raw * 100) / 100, unrounded: raw };
}

/** Does the entered Rf match the real one within `tol`? (the student's own calculation check) */
export function checkRf(entered, actual, tol = 0.03) {
  const v = Number(entered);
  if (!Number.isFinite(v)) return { ok: false, reason: "Enter a number between 0 and 1." };
  if (v < 0 || v > 1) return { ok: false, reason: "An Rf value is always between 0 and 1, because the spot cannot travel further than the solvent." };
  return Math.abs(v - actual) <= tol ? { ok: true, reason: "" } : { ok: false, reason: v > actual ? "Too high: check you divided spot distance by SOLVENT distance, not the other way round." : "Too low: check both distances are measured from the baseline." };
}

/** The chromatogram of a sample in a solvent: visible dye spots with their Rf, and what stays invisible. */
export function chromatogram(sample, solvent = "water") {
  const spots = []; const invisible = []; const stuck = [];
  const dyes = sample.parts.filter((p) => SUBSTANCES[p.sub]?.dye);
  for (const p of dyes) {
    const rf = SUBSTANCES[p.sub].rf?.[solvent] ?? 0;
    spots.push({ sub: p.sub, rf, colour: SUBSTANCES[p.sub].colour, name: SUBSTANCES[p.sub].name });
  }
  spots.sort((a, b) => b.rf - a.rf);
  for (const p of sample.parts) {
    if (SUBSTANCES[p.sub]?.dye) continue;
    if (p.form === "solid") stuck.push(p.sub); else if (p.form === "dissolved") invisible.push(p.sub);
  }
  return { spots, invisible, stuck, solvent };
}

/** Smallest difference in Rf between neighbouring spots (resolution); Infinity for fewer than two spots. */
export function minSpotGap(spots) {
  const r = spots.map((s) => s.rf).sort((a, b) => a - b); let g = Infinity;
  for (let i = 1; i < r.length; i++) g = Math.min(g, r[i] - r[i - 1]);
  return g;
}
