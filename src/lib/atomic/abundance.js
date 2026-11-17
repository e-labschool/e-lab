// Natural isotopic abundances (percent, mole fraction x 100) for the elements IB mass-spectrometry questions use.
// Source: NIST "Atomic Weights and Isotopic Compositions" (Coursey et al.), values as tabulated on the LibreTexts A4 table (checked 2026-11-17).
// Standard relative atomic masses are the IB data-booklet/IUPAC values (Ar to 2 d.p.).
// The simulation computes Ar from MASS NUMBERS, the way the IB asks students to, and shows the accepted value beside it:
// the small difference is the mass defect and isotopic masses not being whole numbers.
export const ABUNDANCE = Object.freeze({
  3: { symbol: "Li", name: "Lithium", ar: 6.94, isotopes: [[6, 7.59], [7, 92.41]] },
  5: { symbol: "B", name: "Boron", ar: 10.81, isotopes: [[10, 19.9], [11, 80.1]] },
  6: { symbol: "C", name: "Carbon", ar: 12.01, isotopes: [[12, 98.93], [13, 1.07]] },
  10: { symbol: "Ne", name: "Neon", ar: 20.18, isotopes: [[20, 90.48], [21, 0.27], [22, 9.25]] },
  12: { symbol: "Mg", name: "Magnesium", ar: 24.31, isotopes: [[24, 78.99], [25, 10.0], [26, 11.01]] },
  17: { symbol: "Cl", name: "Chlorine", ar: 35.45, isotopes: [[35, 75.76], [37, 24.24]] },
  18: { symbol: "Ar", name: "Argon", ar: 39.95, isotopes: [[36, 0.3365], [38, 0.0632], [40, 99.6003]] },
  29: { symbol: "Cu", name: "Copper", ar: 63.55, isotopes: [[63, 69.15], [65, 30.85]] },
  35: { symbol: "Br", name: "Bromine", ar: 79.9, isotopes: [[79, 50.69], [81, 49.31]] },
  47: { symbol: "Ag", name: "Silver", ar: 107.87, isotopes: [[107, 51.839], [109, 48.161]] },
});
export const MIXER_ELEMENTS = Object.keys(ABUNDANCE).map(Number);

/** Ar = sum(A_i x abundance_i) / sum(abundance_i), A_i = mass numbers. Abundances need not sum to 100 (the sum is divided out). Returns NaN for a zero total. */
export function averageMass(isotopes) {
  const total = isotopes.reduce((s, [, p]) => s + p, 0);
  return total > 0 ? isotopes.reduce((s, [a, p]) => s + a * p, 0) / total : NaN;
}
/** Rescale a list of percentages so that moving ONE abundance keeps the total at 100 (the others share the remainder in proportion). */
export function setAbundance(percents, index, value) {
  const v = Math.min(100, Math.max(0, value)); const rest = percents.reduce((s, p, i) => (i === index ? s : s + p), 0);
  const left = 100 - v;
  return percents.map((p, i) => (i === index ? v : rest > 0 ? (p / rest) * left : left / (percents.length - 1)));
}
