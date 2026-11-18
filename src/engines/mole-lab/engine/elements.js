// Atomic masses and the molar-mass POLICY (spec A5).
//
// There are exactly two named policies and every mass calculation takes one explicitly; nothing in the engine ever switches
// between them silently.  The active policy is part of the experiment state and is shown next to every molar mass.
//
//   "teaching"  Relative atomic masses to 2 d.p. in the style of the IB data booklet (taken from src/lib/atomic/abundance.js
//               where that table has the element, so e.g. Cl 35.45 and C 12.01 come from ONE place), with the single
//               documented simplification required by the spec: Mg = 24.0 (simplified teaching value).
//               Gives NaOH 40.00, H2O 18.02, Mg 24.0, MgO 40.00, NaCl 58.44.
//   "precise"   IUPAC standard atomic weights (abridged conventional values, 3-5 s.f.).  Mg = 24.305, H2O = 18.015.
//
// Nothing else is allowed to declare an atomic mass.  Each record keeps `simplified` so the UI can label the value.
import { ABUNDANCE } from "../../../lib/atomic/abundance.js";

export const MASS_POLICIES = Object.freeze({
  booklet: Object.freeze({ id: "booklet", label: "IB data booklet values (2 d.p.)", short: "IB data booklet values", dp: 2,
    source: "Relative atomic masses as printed in the IB DP Chemistry data booklet (2 d.p.): H 1.01, C 12.01, N 14.01, O 16.00, Na 22.99, Mg 24.31, Cl 35.45." }),
  teaching: Object.freeze({ id: "teaching", label: "Teaching values (2 d.p., Mg = 24.0)", short: "teaching values", dp: 2,
    source: "IB data-booklet-style relative atomic masses to 2 d.p. (shared with src/lib/atomic/abundance.js); Mg simplified to 24.0." }),
  precise: Object.freeze({ id: "precise", label: "Precise values (IUPAC)", short: "precise values", dp: 3,
    source: "IUPAC standard atomic weights, abridged conventional values." }),
});
export const DEFAULT_POLICY = "booklet"; // owner decision: the data-booklet values are the DEFAULT and the only policy the UI shows; "teaching" (Mg 24.0) and "precise" stay available as explicit arguments (tests).

// symbol: [Z, name, teaching Ar, precise Ar]
const RAW = {
  H: [1, "Hydrogen", 1.01, 1.008], Li: [3, "Lithium", 6.94, 6.94], B: [5, "Boron", 10.81, 10.81], C: [6, "Carbon", 12.01, 12.011],
  N: [7, "Nitrogen", 14.01, 14.007], O: [8, "Oxygen", 16.00, 15.999], F: [9, "Fluorine", 19.00, 18.998], Ne: [10, "Neon", 20.18, 20.180],
  Na: [11, "Sodium", 22.99, 22.990], Mg: [12, "Magnesium", 24.31, 24.305], Al: [13, "Aluminium", 26.98, 26.982], Si: [14, "Silicon", 28.09, 28.085],
  P: [15, "Phosphorus", 30.97, 30.974], S: [16, "Sulfur", 32.07, 32.06], Cl: [17, "Chlorine", 35.45, 35.45], Ar: [18, "Argon", 39.95, 39.95],
  K: [19, "Potassium", 39.10, 39.098], Ca: [20, "Calcium", 40.08, 40.078], Fe: [26, "Iron", 55.85, 55.845], Cu: [29, "Copper", 63.55, 63.546],
  Zn: [30, "Zinc", 65.38, 65.38], Ag: [47, "Silver", 107.87, 107.87], He: [2, "Helium", 4.00, 4.0026],
};
/** Elements whose TEACHING value is a deliberate simplification of the 2 d.p. table (labelled wherever shown). */
export const TEACHING_SIMPLIFIED = Object.freeze({ Mg: 24.0 });

const byZ = Object.fromEntries(Object.values(ABUNDANCE).map((a) => [a.symbol, a.ar]));
export const ELEMENTS = Object.freeze(Object.fromEntries(Object.entries(RAW).map(([sym, [z, name, teach, precise]]) => {
  const simplified = sym in TEACHING_SIMPLIFIED;
  const teaching = simplified ? TEACHING_SIMPLIFIED[sym] : teach;
  return [sym, Object.freeze({ symbol: sym, z, name, masses: Object.freeze({ booklet: teach, teaching, precise }), simplifiedTeaching: simplified, tableAr: byZ[sym] ?? null })];
})));

export function atomicMass(symbol, policy = DEFAULT_POLICY) {
  const el = ELEMENTS[symbol];
  if (!el) throw new Error(`Unknown element "${symbol}"`);
  if (!MASS_POLICIES[policy]) throw new Error(`Unknown molar-mass policy "${policy}"`);
  return el.masses[policy];
}
export const isElement = (s) => Object.prototype.hasOwnProperty.call(ELEMENTS, s);
