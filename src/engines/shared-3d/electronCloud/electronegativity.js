// Electronegativity data and the bond-polarity rules used by the Polarity Playground AND the Intermolecular Forces Visualiser
// (pure; no three, no React).
//
//   PAULING       Pauling electronegativities to two decimal places (the values the Polarity Playground shows for real atoms).
//                 They agree with the IB data-booklet table in src/lib/lewis/data.js to its one-decimal rounding (tested).
//   thresholds    the SAME bond-type thresholds as src/lib/lewis/polarity.js (non-polar < 0.05, "slightly polar" <= 0.4, polar,
//                 "very polar" above 1.8), imported rather than repeated.
//   visualPolarity()  a QUALITATIVE 0..1 number that decides how far the simplified electron-density picture is pushed. It is a
//                 teaching dial driven by the electronegativity difference, not a calculated charge or a dipole moment.
import { NONPOLAR_MAX, SLIGHT_MAX, IONIC_MIN } from "../../../lib/lewis/polarity.js";

export const PAULING = Object.freeze({
  H: 2.20, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98,
  Na: 0.93, Mg: 1.31, Al: 1.61, Si: 1.90, P: 2.19, S: 2.58, Cl: 3.16,
  K: 0.82, Ca: 1.00, Se: 2.55, Br: 2.96, I: 2.66, Xe: 2.60,
});
/** Real atoms offered in the Tug-of-War "Real Atom Mode" (their values are fixed: the UI offers no way to change them). */
export const REAL_ATOMS = Object.freeze(["H", "C", "N", "O", "F", "Cl", "S", "Br", "I", "P", "Li", "Na", "Mg"]);
export const NAMES = Object.freeze({ H: "Hydrogen", C: "Carbon", N: "Nitrogen", O: "Oxygen", F: "Fluorine", Cl: "Chlorine", S: "Sulfur", Br: "Bromine", B: "Boron", I: "Iodine", P: "Phosphorus", Li: "Lithium", Na: "Sodium", Mg: "Magnesium" });
export const electronegativityOf = (el) => PAULING[el];
export { NONPOLAR_MAX, SLIGHT_MAX, IONIC_MIN };
/** Bond-dipole threshold of the IB convention: a bond with delta-EN below this is treated as non-polar (C-H, S-H ...). */
export const POLAR_BOND_MIN = SLIGHT_MAX;

/** Free-play slider range (fictional atoms A and B): the span of the Pauling scale. */
export const FREE_RANGE = Object.freeze({ min: 0.7, max: 4.0, step: 0.1 });
export const EQUAL_TOL = 0.005; // two values closer than this count as equal

export const round2 = (x) => Math.round(x * 100) / 100;

/** Qualitative 0..1 strength of the electron-density redistribution for a given |delta-EN| (zero for equal, saturating at ~1.6). */
export function visualPolarity(dEN) {
  const d = Math.abs(dEN);
  if (d < EQUAL_TOL) return 0;
  return Math.min(1, d / 1.6) ** 0.8;
}

/** Bond type words (IB level). */
export function bondKind(dEN) {
  const d = Math.abs(dEN);
  if (d < NONPOLAR_MAX) return "non-polar";
  if (d <= SLIGHT_MAX) return "slightly polar";
  if (d > IONIC_MIN) return "very polar (strong ionic character)";
  return "polar";
}

/**
 * The tug-of-war between two values enA and enB: who pulls harder, how large the difference is, which way the shared density moves.
 *   shift  -1 .. +1: negative = towards A, positive = towards B, 0 = equal sharing
 */
export function tugState(enA, enB) {
  const diff = enB - enA; const dEN = Math.abs(diff);
  const equal = dEN < EQUAL_TOL;
  const winner = equal ? null : diff > 0 ? "B" : "A";
  const p = visualPolarity(dEN);
  return { enA, enB, dEN, equal, winner, loser: equal ? null : winner === "A" ? "B" : "A", kind: bondKind(dEN), polarity: p, shift: equal ? 0 : (diff > 0 ? 1 : -1) * p, partialCharges: !equal };
}

/** Bond between two element symbols: { dEN, equal, more (symbol), less (symbol), kind, polar (IB convention: delta-EN >= 0.4) }. */
export function elementBond(a, b) {
  const ea = PAULING[a]; const eb = PAULING[b];
  if (ea === undefined || eb === undefined) return null;
  const dEN = Math.abs(ea - eb); const equal = dEN < EQUAL_TOL;
  return { a, b, enA: ea, enB: eb, dEN, equal, more: equal ? null : ea > eb ? a : b, less: equal ? null : ea > eb ? b : a, kind: bondKind(dEN), polar: dEN >= POLAR_BOND_MIN, polarity: visualPolarity(dEN) };
}
