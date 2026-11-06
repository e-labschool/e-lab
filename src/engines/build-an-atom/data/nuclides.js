// Curated nuclide dataset for Z = 1-36, kept local to Build an Atom
// (never merged into the shared src/data/chemistry/elements.js, which
// stays physical-facts-only by its own established convention).
//
// SOURCES
//  - Which isotopes of each element occur in nature, and which one is the
//    most abundant (the REFERENCE isotope, `defaultMassNumber`): IUPAC /
//    CIAAW "Isotopic Abundances of the Elements" (2024 table; same values
//    as NIST "Atomic Weights and Isotopic Compositions").
//  - Radioactive vs stable: NUBASE2020 (Kondev, F.G. et al., Chinese
//    Physics C 45.3 (2021)). "stable" = no radioactive decay has ever been
//    observed ("observationally stable"; this includes Ca-46, Cr-50, Fe-54,
//    Ni-58, Zn-70 whose decay is theoretically possible but unobserved).
//  - The Z = 1-20 rows were first compiled from NUBASE2020 via Wikipedia's
//    "List of nuclides"; Z = 21-36 were added from the CIAAW table above.
//    Nothing here is populated from memory without a source.
//
// The `stable` entries of each element are COMPLETE (every stable isotope
// of the element is listed), so any other proton/neutron combination for
// Z = 1-36 is, by definition, "not a stable nuclide" (see classifyNuclide).
// The `radioactive` entries are only the real, named, long-lived natural
// ones (plus a few well-known others) -- a teaching set, not every known
// nuclide, and the UI must always describe it that way.
//
// Ca-48 (half-life ~5.6x10^19 y), V-50, Ge-76, Se-82 and Kr-78 are real
// radioactive isotopes (double-beta / double-electron-capture decay or
// electron capture, all observed) with extremely long half-lives and are
// therefore classified "radioactive" here. Ar-40 is "stable" (~99.6 %
// of natural argon).
export const NUCLIDES = {
  1: { symbol: "H", defaultMassNumber: 1, isotopes: [
    { massNumber: 1, stability: "stable" },
    { massNumber: 2, stability: "stable" },
    { massNumber: 3, stability: "radioactive" },
  ]},
  2: { symbol: "He", defaultMassNumber: 4, isotopes: [
    { massNumber: 3, stability: "stable" },
    { massNumber: 4, stability: "stable" },
  ]},
  3: { symbol: "Li", defaultMassNumber: 7, isotopes: [
    { massNumber: 6, stability: "stable" },
    { massNumber: 7, stability: "stable" },
  ]},
  4: { symbol: "Be", defaultMassNumber: 9, isotopes: [
    { massNumber: 9, stability: "stable" },
    { massNumber: 10, stability: "radioactive" },
  ]},
  5: { symbol: "B", defaultMassNumber: 11, isotopes: [
    { massNumber: 10, stability: "stable" },
    { massNumber: 11, stability: "stable" },
  ]},
  6: { symbol: "C", defaultMassNumber: 12, isotopes: [
    { massNumber: 12, stability: "stable" },
    { massNumber: 13, stability: "stable" },
    { massNumber: 14, stability: "radioactive" },
  ]},
  7: { symbol: "N", defaultMassNumber: 14, isotopes: [
    { massNumber: 14, stability: "stable" },
    { massNumber: 15, stability: "stable" },
  ]},
  8: { symbol: "O", defaultMassNumber: 16, isotopes: [
    { massNumber: 16, stability: "stable" },
    { massNumber: 17, stability: "stable" },
    { massNumber: 18, stability: "stable" },
  ]},
  9: { symbol: "F", defaultMassNumber: 19, isotopes: [
    { massNumber: 19, stability: "stable" },
  ]},
  10: { symbol: "Ne", defaultMassNumber: 20, isotopes: [
    { massNumber: 20, stability: "stable" },
    { massNumber: 21, stability: "stable" },
    { massNumber: 22, stability: "stable" },
  ]},
  11: { symbol: "Na", defaultMassNumber: 23, isotopes: [
    { massNumber: 22, stability: "radioactive" },
    { massNumber: 23, stability: "stable" },
  ]},
  12: { symbol: "Mg", defaultMassNumber: 24, isotopes: [
    { massNumber: 24, stability: "stable" },
    { massNumber: 25, stability: "stable" },
    { massNumber: 26, stability: "stable" },
  ]},
  13: { symbol: "Al", defaultMassNumber: 27, isotopes: [
    { massNumber: 27, stability: "stable" },
  ]},
  14: { symbol: "Si", defaultMassNumber: 28, isotopes: [
    { massNumber: 28, stability: "stable" },
    { massNumber: 29, stability: "stable" },
    { massNumber: 30, stability: "stable" },
    { massNumber: 32, stability: "radioactive" },
  ]},
  15: { symbol: "P", defaultMassNumber: 31, isotopes: [
    { massNumber: 31, stability: "stable" },
    { massNumber: 32, stability: "radioactive" },
  ]},
  16: { symbol: "S", defaultMassNumber: 32, isotopes: [
    { massNumber: 32, stability: "stable" },
    { massNumber: 33, stability: "stable" },
    { massNumber: 34, stability: "stable" },
    { massNumber: 35, stability: "radioactive" },
    { massNumber: 36, stability: "stable" },
  ]},
  17: { symbol: "Cl", defaultMassNumber: 35, isotopes: [
    { massNumber: 35, stability: "stable" },
    { massNumber: 36, stability: "radioactive" },
    { massNumber: 37, stability: "stable" },
  ]},
  18: { symbol: "Ar", defaultMassNumber: 40, isotopes: [
    { massNumber: 36, stability: "stable" },
    { massNumber: 38, stability: "stable" },
    { massNumber: 40, stability: "stable" },
  ]},
  19: { symbol: "K", defaultMassNumber: 39, isotopes: [
    { massNumber: 39, stability: "stable" },
    { massNumber: 40, stability: "radioactive" },
    { massNumber: 41, stability: "stable" },
  ]},
  20: { symbol: "Ca", defaultMassNumber: 40, isotopes: [
    { massNumber: 40, stability: "stable" },
    { massNumber: 42, stability: "stable" },
    { massNumber: 43, stability: "stable" },
    { massNumber: 44, stability: "stable" },
    { massNumber: 46, stability: "stable" },
    { massNumber: 48, stability: "radioactive" },
  ]},
  21: { symbol: "Sc", defaultMassNumber: 45, isotopes: [
    { massNumber: 45, stability: "stable" },
  ]},
  22: { symbol: "Ti", defaultMassNumber: 48, isotopes: [
    { massNumber: 46, stability: "stable" },
    { massNumber: 47, stability: "stable" },
    { massNumber: 48, stability: "stable" },
    { massNumber: 49, stability: "stable" },
    { massNumber: 50, stability: "stable" },
  ]},
  23: { symbol: "V", defaultMassNumber: 51, isotopes: [
    { massNumber: 50, stability: "radioactive" },
    { massNumber: 51, stability: "stable" },
  ]},
  24: { symbol: "Cr", defaultMassNumber: 52, isotopes: [
    { massNumber: 50, stability: "stable" },
    { massNumber: 52, stability: "stable" },
    { massNumber: 53, stability: "stable" },
    { massNumber: 54, stability: "stable" },
  ]},
  25: { symbol: "Mn", defaultMassNumber: 55, isotopes: [
    { massNumber: 55, stability: "stable" },
  ]},
  26: { symbol: "Fe", defaultMassNumber: 56, isotopes: [
    { massNumber: 54, stability: "stable" },
    { massNumber: 56, stability: "stable" },
    { massNumber: 57, stability: "stable" },
    { massNumber: 58, stability: "stable" },
  ]},
  27: { symbol: "Co", defaultMassNumber: 59, isotopes: [
    { massNumber: 59, stability: "stable" },
  ]},
  28: { symbol: "Ni", defaultMassNumber: 58, isotopes: [
    { massNumber: 58, stability: "stable" },
    { massNumber: 60, stability: "stable" },
    { massNumber: 61, stability: "stable" },
    { massNumber: 62, stability: "stable" },
    { massNumber: 64, stability: "stable" },
  ]},
  29: { symbol: "Cu", defaultMassNumber: 63, isotopes: [
    { massNumber: 63, stability: "stable" },
    { massNumber: 65, stability: "stable" },
  ]},
  30: { symbol: "Zn", defaultMassNumber: 64, isotopes: [
    { massNumber: 64, stability: "stable" },
    { massNumber: 66, stability: "stable" },
    { massNumber: 67, stability: "stable" },
    { massNumber: 68, stability: "stable" },
    { massNumber: 70, stability: "stable" },
  ]},
  31: { symbol: "Ga", defaultMassNumber: 69, isotopes: [
    { massNumber: 69, stability: "stable" },
    { massNumber: 71, stability: "stable" },
  ]},
  32: { symbol: "Ge", defaultMassNumber: 74, isotopes: [
    { massNumber: 70, stability: "stable" },
    { massNumber: 72, stability: "stable" },
    { massNumber: 73, stability: "stable" },
    { massNumber: 74, stability: "stable" },
    { massNumber: 76, stability: "radioactive" },
  ]},
  33: { symbol: "As", defaultMassNumber: 75, isotopes: [
    { massNumber: 75, stability: "stable" },
  ]},
  34: { symbol: "Se", defaultMassNumber: 80, isotopes: [
    { massNumber: 74, stability: "stable" },
    { massNumber: 76, stability: "stable" },
    { massNumber: 77, stability: "stable" },
    { massNumber: 78, stability: "stable" },
    { massNumber: 80, stability: "stable" },
    { massNumber: 82, stability: "radioactive" },
  ]},
  35: { symbol: "Br", defaultMassNumber: 79, isotopes: [
    { massNumber: 79, stability: "stable" },
    { massNumber: 81, stability: "stable" },
  ]},
  36: { symbol: "Kr", defaultMassNumber: 84, isotopes: [
    { massNumber: 78, stability: "radioactive" },
    { massNumber: 80, stability: "stable" },
    { massNumber: 82, stability: "stable" },
    { massNumber: 83, stability: "stable" },
    { massNumber: 84, stability: "stable" },
    { massNumber: 86, stability: "stable" },
  ]},
};

export const MAX_SUPPORTED_ATOMIC_NUMBER = 36;

/** True only for atomic numbers this curated dataset actually covers
 * (1-36). */
export function hasCuratedCoverage(atomicNumber) {
  return Boolean(NUCLIDES[atomicNumber]);
}

/** Looks up whether a specific (protons, neutrons) combination is one
 * of the curated nuclides -- returns the isotope record (with its
 * stability) if so, or null if not. For elements outside curated
 * coverage, always returns null. Never used to restrict construction. */
export function findNuclide(protons, neutrons) {
  const entry = NUCLIDES[protons];
  if (!entry) return null;
  const massNumber = protons + neutrons;
  return entry.isotopes.find((iso) => iso.massNumber === massNumber) ?? null;
}

/** The neutron count for this element's curated default nuclide -- used
 * both for "Reset to Carbon-12"-style resets on proton change and for
 * periodic-table selection. Returns null for elements outside curated
 * coverage (21+), where no default restriction applies. */
export function defaultNeutronsFor(atomicNumber) {
  const entry = NUCLIDES[atomicNumber];
  if (!entry) return null;
  return entry.defaultMassNumber - atomicNumber;
}

/** All curated isotopes for one element, for Isotope Comparison and
 * Challenge generation -- never an arbitrary +/-1 neutron guess. */
export function curatedIsotopesFor(atomicNumber) {
  return NUCLIDES[atomicNumber]?.isotopes ?? [];
}

/** Classifies any (protons, neutrons) combination for DISPLAY purposes
 * only -- "stable" | "radioactive" | "not-stable" | "not-included". This is a pure
 * classification, never a boundary: every proton/neutron combination a
 * student can build (down to 0 neutrons) is always constructible, and
 * this function only says how to LABEL it, never whether to allow it.
 * "not-stable": element has data and this mass number is not one of its
 * stable isotopes (nor one of the named radioactive ones).
 * "not-included": no data (Z = 0 or Z > 36). */
export function classifyNuclide(protons, neutrons) {
  const found = findNuclide(protons, neutrons);
  if (found) return found.stability;
  // Every stable isotope of Z = 1-36 is listed, so an element with data
  // whose (Z, N) is not listed is, by definition, not a stable nuclide.
  if (hasCuratedCoverage(protons)) return "not-stable";
  return "not-included";
}
