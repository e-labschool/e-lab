// Pure ground-state electronic structure for Build an Atom (no React, no DOM).
//
// Everything here is derived from ONE source: the ground-state electron
// configuration of the neutral atom whose atomic number equals the number of
// ELECTRONS shown (aufbau / Madelung order with the two known exceptions in the
// supported range, Cr and Cu). The per-shell arrangement is then the sum of that
// configuration's subshells per principal quantum number n, so arrangement and
// configuration can never disagree.
//
//   Mn, 25 electrons: 1s2 2s2 2p6 3s2 3p6 3d5 4s2  ->  2,8,13,2
//
// Scope: 0-40 electrons (the simulation's cap). Shell maxima are the true 2n^2
// (2, 8, 18, 32, 50), never a display convention. For an ION the same by-count
// ground state is shown (see ionNote): exact for main-group ions that are
// isoelectronic with a noble gas (Na+, Cl-, O2-), only a count-based display for
// transition-metal cations, which lose their 4s electrons first (Fe2+ is 2,8,14).

export const MAX_ELECTRONS = 40;

/** True maximum number of electrons in shell n. */
export const shellMax = (n) => 2 * n * n;

const SUBSHELL_LETTER = ["s", "p", "d", "f"];
const SUBSHELL_CAPACITY = [2, 6, 10, 14];

// Madelung (n + l, then n) filling order as far as 40 electrons needs it.
const FILL_ORDER = [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [3, 2], [4, 1], [5, 0], [4, 2], [5, 1]];

// Known ground-state exceptions to the Madelung order for Z <= 40.
// Cr: 4s1 3d5 (half-filled d), Cu: 4s1 3d10 (filled d). Nb (41) and beyond are out of range.
const EXCEPTIONS = { 24: { "3d": 5, "4s": 1 }, 29: { "3d": 10, "4s": 1 } };

const SUPERSCRIPT = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const superscript = (value) => String(value).split("").map((c) => SUPERSCRIPT[c] ?? c).join("");

// Noble-gas cores usable for the shorthand, with the subshells they contain.
const NOBLE_CORES = [
  { symbol: "Kr", electrons: 36 },
  { symbol: "Ar", electrons: 18 },
  { symbol: "Ne", electrons: 10 },
  { symbol: "He", electrons: 2 },
];

function assertCount(electrons) {
  if (!Number.isInteger(electrons) || electrons < 0 || electrons > MAX_ELECTRONS) {
    throw new RangeError(`electron count must be an integer 0-${MAX_ELECTRONS}, got ${electrons}`);
  }
}

/** Raw aufbau fill (no exceptions): [{n, l, count}] in filling order. */
function aufbau(electrons) {
  const out = [];
  let remaining = electrons;
  for (const [n, l] of FILL_ORDER) {
    if (remaining <= 0) break;
    const count = Math.min(SUBSHELL_CAPACITY[l], remaining);
    out.push({ n, l, count });
    remaining -= count;
  }
  return out;
}

/** Ground-state subshell occupation for `electrons` electrons, in conventional
 * WRITING order (by n, then s, p, d): [{ n, l, label: "3d", count }]. */
export function groundStateSubshells(electrons) {
  assertCount(electrons);
  let subshells = aufbau(electrons);
  const exception = EXCEPTIONS[electrons];
  if (exception) {
    subshells = subshells.map((s) => {
      const label = `${s.n}${SUBSHELL_LETTER[s.l]}`;
      return label in exception ? { ...s, count: exception[label] } : s;
    });
  }
  return subshells
    .map((s) => ({ ...s, label: `${s.n}${SUBSHELL_LETTER[s.l]}` }))
    .sort((a, b) => (a.n - b.n) || (a.l - b.l));
}

/** Electrons per shell derived from the configuration: 25 -> [2, 8, 13, 2]. */
export function shellArrangement(electrons) {
  const perShell = [];
  for (const s of groundStateSubshells(electrons)) perShell[s.n - 1] = (perShell[s.n - 1] ?? 0) + s.count;
  return Array.from(perShell, (c) => c ?? 0);
}

/** "1s² 2s² 2p⁶ ..." (full configuration). "" for 0 electrons. */
export function fullConfiguration(electrons) {
  return groundStateSubshells(electrons).map((s) => `${s.label}${superscript(s.count)}`).join(" ");
}

/** Noble-gas shorthand: "[Ar] 3d⁵ 4s²". null when no core applies (1-2 electrons). */
export function shorthandConfiguration(electrons) {
  assertCount(electrons);
  const core = NOBLE_CORES.find((c) => c.electrons < electrons);
  if (!core) return null;
  const inCore = new Set(groundStateSubshells(core.electrons).map((s) => s.label));
  const rest = groundStateSubshells(electrons).filter((s) => !inCore.has(s.label));
  return `[${core.symbol}] ${rest.map((s) => `${s.label}${superscript(s.count)}`).join(" ")}`;
}

const TRANSITION_Z = [21, 30]; // Sc-Zn: the elements whose cations the count-based display gets wrong

/** Everything the "shells and configuration" panel shows, for the electron count
 * actually drawn in the atom (never the proton count). */
export function describeElectrons(electrons, protons = electrons) {
  assertCount(electrons);
  const netCharge = protons - electrons;
  const isIon = protons > 0 && netCharge !== 0;
  const arrangement = shellArrangement(electrons);
  const shells = arrangement.map((count, i) => {
    const n = i + 1;
    const max = shellMax(n);
    return { n, count, max, full: count === max, empty: count === 0 };
  });
  const transitionIon = isIon && protons >= TRANSITION_Z[0] && protons <= TRANSITION_Z[1];
  return {
    electrons,
    protons,
    netCharge,
    isIon,
    none: electrons === 0,
    shells,
    arrangement: arrangement.join(","),
    configuration: fullConfiguration(electrons),
    shorthand: shorthandConfiguration(electrons),
    ionNote: transitionIon
      ? "Shown for this electron count (count-based). Real transition-metal ions lose 4s electrons first, e.g. Fe²⁺ is 2,8,14."
      : null,
  };
}
