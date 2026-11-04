// Pure chemistry logic — no React, no DOM, fully unit-testable in isolation.
// Given an atomic number, builds the full ground-state electron configuration:
// shell-by-shell, subshell-by-subshell, and orbital-by-orbital (with Hund's
// rule applied for display). This file never imports curriculum data.

import electronConfigExceptions from "../../../data/chemistry/electron-config-exceptions.js";
import { getElement } from "../../../data/chemistry/elements.js";

export const SUBSHELL_LETTERS = { 0: "s", 1: "p", 2: "d", 3: "f" };
export const SUBSHELL_CAPACITY = { 0: 2, 1: 6, 2: 10, 3: 14 };
export const ORBITAL_COUNT = { 0: 1, 1: 3, 2: 5, 3: 7 }; // number of degenerate orbitals per subshell type

// The Madelung (n+l, then n) filling order, valid through Z = 118.
export const MADELUNG_ORDER = [
  [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [3, 2], [4, 1],
  [5, 0], [4, 2], [5, 1], [6, 0], [4, 3], [5, 2], [6, 1], [7, 0],
  [5, 3], [6, 2], [7, 1],
];

/** Fill subshells in Madelung order until `numElectrons` are placed. Pure algorithmic Aufbau — no exceptions applied here. */
function algorithmicFill(numElectrons) {
  const subshells = [];
  let remaining = numElectrons;
  for (const [n, l] of MADELUNG_ORDER) {
    if (remaining <= 0) break;
    const capacity = SUBSHELL_CAPACITY[l];
    const electrons = Math.min(capacity, remaining);
    subshells.push({ n, l, electrons });
    remaining -= electrons;
  }
  return subshells;
}

/** Sort subshells into the conventional display order: by shell (n) ascending, then subshell type (l) ascending. */
function toDisplayOrder(subshells) {
  return [...subshells].sort((a, b) => (a.n !== b.n ? a.n - b.n : a.l - b.l));
}

/** Distribute electrons across degenerate orbitals within a subshell, applying Hund's rule (singly-fill before pairing). */
export function distributeElectronsInOrbitals(l, electronCount) {
  const orbitalCount = ORBITAL_COUNT[l];
  const orbitals = Array.from({ length: orbitalCount }, () => ({ electrons: 0, spins: [] }));

  // First pass: one electron (spin up) into each orbital.
  let remaining = electronCount;
  for (let i = 0; i < orbitalCount && remaining > 0; i += 1) {
    orbitals[i].electrons = 1;
    orbitals[i].spins = ["up"];
    remaining -= 1;
  }
  // Second pass: pair up (spin down) once every orbital already has one electron.
  for (let i = 0; i < orbitalCount && remaining > 0; i += 1) {
    orbitals[i].electrons = 2;
    orbitals[i].spins = ["up", "down"];
    remaining -= 1;
  }
  return orbitals;
}

/** Sum electrons per principal shell (n) from a subshell list — the "shell distribution", e.g. [2, 8, 18, ...]. */
function computeShellDistribution(subshells) {
  const byShell = {};
  for (const { n, electrons } of subshells) {
    byShell[n] = (byShell[n] ?? 0) + electrons;
  }
  const maxN = Math.max(...Object.keys(byShell).map(Number));
  return Array.from({ length: maxN }, (_, i) => byShell[i + 1] ?? 0);
}

/**
 * Describe valence electrons without oversimplifying for d-/f-block elements.
 * For s/p-block: valence = electrons in the highest principal shell.
 * For d-block: conventionally ns + (n-1)d electrons of the outermost shells are treated as valence.
 * For f-block: valence assignment is genuinely ambiguous (near-degenerate (n-2)f, (n-1)d, ns energies),
 * so we return a qualitative note rather than a misleading single number.
 */
function describeValence(element, subshellsDisplayOrder) {
  const maxN = Math.max(...subshellsDisplayOrder.map((s) => s.n));

  if (element.block === "s" || element.block === "p") {
    const outerShellElectrons = subshellsDisplayOrder
      .filter((s) => s.n === maxN)
      .reduce((sum, s) => sum + s.electrons, 0);
    return {
      kind: "simple",
      valenceElectronCount: outerShellElectrons,
      note: `${outerShellElectrons} valence electron${outerShellElectrons === 1 ? "" : "s"} in the outermost shell (n = ${maxN}).`,
    };
  }

  if (element.block === "d") {
    const nsElectrons = subshellsDisplayOrder.find((s) => s.n === maxN && s.l === 0)?.electrons ?? 0;
    const dSubshell = subshellsDisplayOrder.find((s) => s.l === 2 && s.n === maxN - 1);
    const dElectrons = dSubshell?.electrons ?? 0;
    return {
      kind: "d-block",
      valenceElectronCount: nsElectrons + dElectrons,
      note: `Conventionally ${nsElectrons + dElectrons} valence electrons (${maxN}s${nsElectrons} + ${maxN - 1}d${dElectrons}) — transition elements commonly show several oxidation states because (n-1)d and ns electrons are similar in energy.`,
    };
  }

  // f-block
  return {
    kind: "f-block",
    valenceElectronCount: null,
    note: "Valence behaviour here doesn't reduce to a single count: the (n-2)f, (n-1)d and ns subshells sit close in energy, so several electrons across all three can participate in bonding depending on the compound.",
  };
}

/**
 * Build the complete ground-state electron configuration for an element.
 * Uses the curated exceptions table where one exists; otherwise falls back
 * to algorithmic Aufbau filling. This is the ONLY function that decides
 * between the two — callers never need to know which path was taken.
 */
export function buildConfiguration(atomicNumber) {
  const element = getElement(atomicNumber);
  if (!element) return null;

  const isException = Object.prototype.hasOwnProperty.call(electronConfigExceptions, atomicNumber);
  const subshellsFillingOrder = isException
    ? electronConfigExceptions[atomicNumber].filter((s) => s.electrons > 0)
    : algorithmicFill(atomicNumber);

  const subshellsDisplayOrder = toDisplayOrder(subshellsFillingOrder);
  const shells = computeShellDistribution(subshellsDisplayOrder);
  const valence = describeValence(element, subshellsDisplayOrder);

  const orbitals = subshellsDisplayOrder.map((s) => ({
    ...s,
    label: `${s.n}${SUBSHELL_LETTERS[s.l]}`,
    orbitals: distributeElectronsInOrbitals(s.l, s.electrons),
  }));

  return {
    element,
    isException,
    subshellsFillingOrder,
    subshellsDisplayOrder,
    orbitals,
    shells,
    valence,
    configurationString: subshellsDisplayOrder.map((s) => `${s.n}${SUBSHELL_LETTERS[s.l]}${s.electrons}`).join(" "),
  };
}

/** Build the configuration for a common ion by adding/removing electrons from the neutral atom. Architected for reuse, not exposed in the v1 UI. */
export function buildIonConfiguration(atomicNumber, charge) {
  const targetElectrons = atomicNumber - charge;
  if (targetElectrons <= 0) return null;

  // Cations: remove electrons from the highest-n subshell first, then highest-l within that shell
  // (this reflects the observed behaviour that (n-1)d electrons are retained over ns electrons once ionized).
  // Anions: add electrons via algorithmic Aufbau continuation.
  if (charge > 0) {
    const neutral = buildConfiguration(atomicNumber);
    if (!neutral) return null;
    let remainingToRemove = charge;
    const pool = [...neutral.subshellsDisplayOrder].sort((a, b) => (b.n !== a.n ? b.n - a.n : b.l - a.l));
    const reduced = pool.map((s) => ({ ...s }));
    for (const s of reduced) {
      if (remainingToRemove <= 0) break;
      const removeHere = Math.min(s.electrons, remainingToRemove);
      s.electrons -= removeHere;
      remainingToRemove -= removeHere;
    }
    const subshellsDisplayOrder = toDisplayOrder(reduced.filter((s) => s.electrons > 0));
    return {
      element: neutral.element,
      charge,
      subshellsDisplayOrder,
      shells: computeShellDistribution(subshellsDisplayOrder),
      configurationString: subshellsDisplayOrder.map((s) => `${s.n}${SUBSHELL_LETTERS[s.l]}${s.electrons}`).join(" "),
    };
  }

  const subshellsFillingOrder = algorithmicFill(targetElectrons);
  const subshellsDisplayOrder = toDisplayOrder(subshellsFillingOrder);
  return {
    element: getElement(atomicNumber),
    charge,
    subshellsDisplayOrder,
    shells: computeShellDistribution(subshellsDisplayOrder),
    configurationString: subshellsDisplayOrder.map((s) => `${s.n}${SUBSHELL_LETTERS[s.l]}${s.electrons}`).join(" "),
  };
}
