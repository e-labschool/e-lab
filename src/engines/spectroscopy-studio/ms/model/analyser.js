// Mass analyser rules of the six-stage experiment. PURE. Builds on physics/kinematics.js, physics/sector.js and physics/tof.js (unchanged, tested).
//
// MAGNETIC SECTOR. r = (1/B) sqrt(2 m V / (z e)) = (1/B) sqrt(2 (m/z) V / e): the radius depends on m/z only, NOT on mass and charge separately. So a 2+ ion of
// mass 86 follows the same circle as a 1+ ion of mass 43 (both have m/z 43). A fixed detector slit at the radius R_DET therefore transmits ONE m/z for a given
// pair (V, B): m/z_focus = e B^2 R_DET^2 / (2 V). Changing B (or V) scans the transmitted m/z; a spectrum is built up over time from many settings.
// RESOLUTION. physics/sector.js models a slit of +-1.2 mm in radius (+-1.2 %), which also admits the neighbouring integers above about m/z 42 (checked in
// scripts/test-ms-model.mjs). The six-stage experiment therefore uses the unit-resolution rule of a real instrument at nominal mass: an ion is transmitted when
// its m/z is within +-0.5 of the focused m/z (the slit is narrowed accordingly in the drawing).
// TIME OF FLIGHT. t = L sqrt(m / (2 z e V)) = L sqrt((m/z) / (2 e V)) for ions that all gained the same kinetic energy z e V (the equal-kinetic-energy assumption).
import { SECTOR, sectorTrajectory, tunedField } from "../physics/sector.js";
import { mzFromRadius, flightTimeS, radiusFromMz } from "../physics/kinematics.js";
import { TOF } from "../physics/tof.js";

export const UNIT_RESOLUTION_HALF_WIDTH = 0.5;
export const sectorFocusMz = (B, V) => mzFromRadius(SECTOR.R_DET, B, V);
export const sectorMzRange = (V) => ({ lo: sectorFocusMz(SECTOR.B_MIN, V), hi: sectorFocusMz(SECTOR.B_MAX, V) });
export const fieldFor = (mz, V) => tunedField(mz, V);
/** does an ion of this m/z (z-independent) pass the detector slit at (V, B)? */
export const sectorTransmits = (mz, V, B) => Math.abs(mz - sectorFocusMz(B, V)) <= UNIT_RESOLUTION_HALF_WIDTH;
/** trajectory of an ion with the given m/z at (V, B) with the unit-resolution transmission rule; outcome: "detector" | "plate" | "wall" */
export function sectorPath(mz, V, B) {
  const t = sectorTrajectory(mz, V, B);
  if (t.outcome === "wall") return t;
  const hit = sectorTransmits(mz, V, B);
  return { ...t, outcome: hit ? "detector" : "plate", hitsDetector: hit };
}
/** a short phrase for the sector outcome */
export function sectorWhere(t) {
  if (t.outcome === "detector") return "reaches the detector";
  if (t.outcome === "wall") return "hits the wall of the field region";
  return t.r < SECTOR.R_DET ? "lands on the plate before the detector (radius too small)" : "lands on the plate beyond the detector (radius too large)";
}
/** radius in metres of an ion of m/z and charge number z (z does not matter at fixed m/z) */
export const radiusM = (mz, V, B) => radiusFromMz(mz, V, B);

/** time of flight in seconds over the tube of length L for the given m/z (and z through m/z) */
export const tofTime = (mz, V, L = TOF.L) => flightTimeS(mz, V, L, 1);
export const mzOfTime = (t, V, L = TOF.L) => (2 * (V * 1.602176634e-19) * (t / L) ** 2) / 1.66053906892e-27;

/** m/z of an ion of mass m (u) and charge number z */
export const mzOf = (massU, z) => massU / z;
