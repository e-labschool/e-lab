// Curated nuclide dataset for Z = 1-20, kept local to Build an Atom
// (never merged into the shared src/data/chemistry/elements.js, which
// stays physical-facts-only by its own established convention).
//
// Sourced from the NUBASE2020 nuclear-data evaluation (Kondev, F.G. et
// al., "The NUBASE2020 evaluation of nuclear properties", Chinese
// Physics C 45.3 (2021)), via its tabulation in Wikipedia's "List of
// nuclides" -- NOT populated from memory. This is a deliberately
// curated TEACHING SET (1-5 isotopes per element, chosen for being
// genuinely well-known), not an exhaustive list of every known nuclide
// of these elements -- the UI must always describe it that way.
//
// "radioactive" here means a genuine, real, named radioactive nuclide
// (verified against the source), never a stand-in for "does not
// exist". Ca-48 is a confirmed real radioactive isotope (double-beta
// decay, half-life ~5.6x10^19 years) despite its extremely long
// half-life, and is intentionally classified "radioactive" here rather
// than "stable" per explicit instruction. Ar-40 is classified "stable"
// (it is the dominant, ~99.6%-abundance natural argon isotope,
// universally treated as stable).
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
};

export const MAX_SUPPORTED_ATOMIC_NUMBER = 20;

/** True only for atomic numbers this curated dataset actually covers
 * (1-20). Elements 21+ deliberately have NO nuclide-boundary
 * restriction -- their existing unrestricted neutron behaviour is
 * preserved until verified coverage is added later. */
export function hasCuratedCoverage(atomicNumber) {
  return Boolean(NUCLIDES[atomicNumber]);
}

/** Looks up whether a specific (protons, neutrons) combination is one
 * of the curated nuclides -- returns the isotope record (with its
 * stability) if so, or null if not. For elements outside curated
 * coverage, always returns null (never used to restrict those). */
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
 * only -- "stable" | "radioactive" | "not-included". This is a pure
 * classification, never a boundary: every proton/neutron combination a
 * student can build (down to 0 neutrons) is always constructible, and
 * this function only says how to LABEL it, never whether to allow it.
 * "not-included" covers both elements with curated coverage where this
 * specific mass number isn't one of the curated isotopes, and elements
 * entirely outside curated coverage (Z > 20). */
export function classifyNuclide(protons, neutrons) {
  const found = findNuclide(protons, neutrons);
  return found ? found.stability : "not-included";
}
