// Pure rules for the three particle controls and the optional "Auto-balance
// particles" mode. No React, no DOM -- unit-tested by
// scripts/test-build-atom-controls.mjs.
//
// THE CONTRACT
//  * Auto-balance OFF (the default): + / - on protons, neutrons or electrons
//    changes ONLY that count, by exactly 1 (clamped to the limits below).
//    Nothing else is ever touched -- adding a proton does not add a neutron,
//    does not add an electron and does not "snap" to another isotope.
//  * Auto-balance ON: the atom is kept neutral and, where reliable data
//    exists, on the reference isotope of the current element:
//      electrons = protons
//      neutrons  = reference neutron count (most abundant isotope, IUPAC/CIAAW)
//    For an element WITHOUT reference data (Z = 0 or Z > 36) neutrons are
//    never changed. While auto-balance is on, the electron controls (and the
//    neutron controls when a reference exists) are locked because their values
//    are determined by the protons.
//  * Turning auto-balance ON applies the balance once to the current atom;
//    turning it OFF changes nothing.
import { defaultNeutronsFor, hasCuratedCoverage, classifyNuclide } from "../data/nuclides.js";
import { elementByAtomicNumber } from "../data/elementLookup.js";

export const LIMITS = { protons: 36, neutrons: 60, electrons: 40 };
export const MIN_COUNT = 0;
export const PARTICLE_KEY = { proton: "protons", neutron: "neutrons", electron: "electrons" };

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const toSuperscript = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");

export function clampCount(type, value) {
  const key = PARTICLE_KEY[type];
  return Math.max(MIN_COUNT, Math.min(LIMITS[key], value));
}

/** The reference isotope of an element: the most abundant isotope in nature
 * (IUPAC/CIAAW), only for Z = 1-36. null when no reliable data exists. */
export function referenceIsotope(protons) {
  if (!hasCuratedCoverage(protons)) return null;
  const el = elementByAtomicNumber(protons);
  const neutrons = defaultNeutronsFor(protons);
  const massNumber = protons + neutrons;
  return {
    protons,
    neutrons,
    massNumber,
    symbol: el.symbol,
    name: `${el.name.toLowerCase()}-${massNumber}`,
    notation: `${toSuperscript(massNumber)}${el.symbol}`,
  };
}

/** Atom after balancing: electrons = protons; neutrons = reference when data exists. */
export function balance(atom) {
  const ref = referenceIsotope(atom.protons);
  return {
    protons: atom.protons,
    neutrons: ref ? ref.neutrons : atom.neutrons,
    electrons: atom.protons,
  };
}

/** Is this particle's +/- locked by auto-balance? */
export function isLocked(type, atom, autoBalance) {
  if (!autoBalance) return false;
  if (type === "electron") return true;
  if (type === "neutron") return referenceIsotope(atom.protons) !== null;
  return false;
}

/** The new atom after one +/- press (returns the SAME object when nothing changes). */
export function applyChange(atom, type, delta, { autoBalance = false } = {}) {
  const key = PARTICLE_KEY[type];
  if (!key) return atom;
  if (isLocked(type, atom, autoBalance)) return atom;
  const nextValue = clampCount(type, atom[key] + delta);
  if (nextValue === atom[key]) return atom;
  let next = { ...atom, [key]: nextValue };
  if (autoBalance && type === "proton") next = balance(next);
  return next;
}

/** Set the proton count directly (periodic table). Same rules as +/-. */
export function setProtons(atom, protons, { autoBalance = false } = {}) {
  const z = clampCount("proton", protons);
  if (z === atom.protons) return atom;
  const next = { ...atom, protons: z };
  return autoBalance ? balance(next) : next;
}

/** Ticking the checkbox: ON balances the current atom once, OFF changes nothing. */
export function toggleAutoBalance(atom, on) {
  return on ? balance(atom) : atom;
}

/** Identity derived only from the counts: element from protons, isotope from protons + neutrons. */
export function isotopeIdentity(protons, neutrons) {
  const el = protons > 0 ? elementByAtomicNumber(protons) : null;
  if (!el) return null;
  const massNumber = protons + neutrons;
  const ref = referenceIsotope(protons);
  return {
    element: el,
    massNumber,
    name: `${el.name.toLowerCase()}-${massNumber}`,
    notation: `${toSuperscript(massNumber)}${el.symbol}`,
    isReference: ref ? ref.neutrons === neutrons : false,
    reference: ref,
  };
}

/** What to tell the student about a (Z, N) combination. Never blocks anything.
 * status: "reference" | "stable" | "radioactive" | "not-stable" | "no-data" */
export function nuclideStatus(protons, neutrons) {
  if (protons === 0) return { status: "no-data", label: "No nucleus yet", detail: "" };
  const c = classifyNuclide(protons, neutrons);
  const ref = referenceIsotope(protons);
  if (c === "stable") {
    return ref && ref.neutrons === neutrons
      ? { status: "reference", label: "Stable nuclide", detail: "Most abundant isotope of this element (reference isotope)." }
      : { status: "stable", label: "Stable nuclide", detail: "A stable isotope, but not the most abundant one." };
  }
  if (c === "radioactive") return { status: "radioactive", label: "Radioactive nuclide", detail: "A real isotope, but it decays." };
  if (c === "not-stable") return { status: "not-stable", label: "Not a stable nuclide", detail: "Not one of the stable isotopes of this element." };
  return { status: "no-data", label: "No isotope data", detail: "This simulation has isotope data for elements 1–36 only." };
}
