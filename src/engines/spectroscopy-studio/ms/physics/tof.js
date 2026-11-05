// Time-of-flight analyser of stage 7 (field-free tube of length L after acceleration through V). PURE.
// All ions are singly charged here (z = 1). They leave the acceleration region together; the ion with the smallest m/z has the highest speed and arrives first.
import { flightTimeS, speedFromMz } from "./kinematics.js";

export const TOF = Object.freeze({ L: 1.0, V_DEFAULT: 2000, MASS_MIN: 10, MASS_MAX: 100 });
export const TOF_ION_COLORS = ["#2dd4bf", "#fbbf24", "#f472b6", "#a78bfa"];

/** ions: [{id, mz}]  ->  rows with speed, flight time and arrival rank (1 = first; equal times share the same rank). */
export function raceTable(ions, V, L = TOF.L) {
  const rows = ions.map((ion) => ({ ...ion, v: speedFromMz(ion.mz, V), t: flightTimeS(ion.mz, V, L) }));
  const order = [...rows].sort((a, b) => a.t - b.t);
  return rows.map((r) => ({ ...r, rank: 1 + order.filter((o) => o.t < r.t - 1e-15).length }));
}
/** Position (0..1 of the tube) after the display clock reached tau, for an ion with flight time t: the ion moves at constant speed in the field-free tube. */
export const tubePosition = (t, tau) => Math.min(1, Math.max(0, tau / t));
/** Display clock: progress 0..1 maps linearly onto 0..(slowest flight time x margin) - a constant stretch of time, so arrival times keep their true ratios. */
export const displayClock = (progress, rows, margin = 1.12) => progress * Math.max(...rows.map((r) => r.t)) * margin;
export const arrivalOrder = (rows) => [...rows].sort((a, b) => a.t - b.t || a.mz - b.mz);
