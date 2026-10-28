// Covalent model: validated molecule table (shared pairs, lone pairs, central-atom electron counts).
// Pure logic. Lewis representation only: no geometry, bond angles, polarity, electronegativity,
// hybridisation or sigma/pi language belongs here.
//
// Each molecule lists atoms (symbols), bonds as [atomIndex, atomIndex, order] (order = shared pairs) and the lone
// pairs on each atom. `validateMolecule` proves the data: every atom's valence electrons (read from the
// shared electron-configuration engine) equal 2*lonePairs + sum(bond orders) -- each shared pair is formed by
// ONE electron from each atom -- so every molecule is electrically neutral and no electron is invented.
import { getBondingElement, toSub } from "./elements.js";

export const COVALENT_GROUPS = [
  { id: "normal", label: "Normal Octet", short: "Normal" },
  { id: "incomplete", label: "Incomplete Octet", short: "Incomplete" },
  { id: "expanded", label: "Expanded Octet (AHL)", short: "Expanded", ahl: true },
];

const mol = (id, name, group, atoms, bonds, lonePairs, extra = {}) => ({
  id, name, group, atoms, bonds, lonePairs, central: atoms.length > 2 ? 0 : null,
  formula: formulaFrom(atoms), ...extra,
});

function formulaFrom(atoms) {
  const counts = {};
  const order = [];
  for (const a of atoms) { if (!(a in counts)) order.push(a); counts[a] = (counts[a] ?? 0) + 1; }
  // Display convention used in the table: central/first atom first for AB_n species, "HCl" style for H-X.
  return order.map((a) => `${a}${counts[a] > 1 ? toSub(counts[a]) : ""}`).join("");
}

const star = (n, order = 1) => Array.from({ length: n }, (_, i) => [0, i + 1, order]);
const rep = (n, v) => Array.from({ length: n }, () => v);

export const MOLECULES = [
  mol("H2", "Hydrogen", "normal", ["H", "H"], [[0, 1, 1]], [0, 0], { structural: "H–H" }),
  mol("Cl2", "Chlorine", "normal", ["Cl", "Cl"], [[0, 1, 1]], [3, 3], { structural: "Cl–Cl" }),
  mol("HCl", "Hydrogen chloride", "normal", ["H", "Cl"], [[0, 1, 1]], [0, 3], { structural: "H–Cl" }),
  mol("O2", "Oxygen", "normal", ["O", "O"], [[0, 1, 2]], [2, 2], { structural: "O=O" }),
  mol("N2", "Nitrogen", "normal", ["N", "N"], [[0, 1, 3]], [1, 1], { structural: "N≡N" }),
  mol("H2O", "Water", "normal", ["O", "H", "H"], star(2), [2, 0, 0], { structural: "H–O–H", formula: "H₂O" }),
  mol("NH3", "Ammonia", "normal", ["N", "H", "H", "H"], star(3), [1, 0, 0, 0], { structural: "N(–H)₃" }),
  mol("CH4", "Methane", "normal", ["C", "H", "H", "H", "H"], star(4), [0, 0, 0, 0, 0], { structural: "C(–H)₄" }),
  mol("BF3", "Boron trifluoride", "incomplete", ["B", "F", "F", "F"], star(3), [0, ...rep(3, 3)], { structural: "B(–F)₃" }),
  mol("BeCl2", "Beryllium chloride", "incomplete", ["Be", "Cl", "Cl"], star(2), [0, 3, 3], { structural: "Cl–Be–Cl" }),
  mol("PCl5", "Phosphorus pentachloride", "expanded", ["P", ...rep(5, "Cl")], star(5), [0, ...rep(5, 3)], { structural: "P(–Cl)₅", ahl: true }),
  mol("SF6", "Sulfur hexafluoride", "expanded", ["S", ...rep(6, "F")], star(6), [0, ...rep(6, 3)], { structural: "S(–F)₆", ahl: true }),
];

export const getMolecule = (id) => MOLECULES.find((m) => m.id === id) ?? null;

/** Shared pairs / bonding electrons an atom takes part in. */
export function sharedPairsOn(m, i) { return m.bonds.reduce((n, [a, b, o]) => n + (a === i || b === i ? o : 0), 0); }
/** Electrons in the Lewis valence shell of atom i (2 per lone pair + 2 per shared pair). */
export function electronsAround(m, i) { return 2 * m.lonePairs[i] + 2 * sharedPairsOn(m, i); }
export function totalSharedPairs(m) { return m.bonds.reduce((n, b) => n + b[2], 0); }
export function totalLonePairs(m) { return m.lonePairs.reduce((n, x) => n + x, 0); }
/** Common order when every bond has the same order, else null. */
export function uniformBondOrder(m) { const s = new Set(m.bonds.map((b) => b[2])); return s.size === 1 ? [...s][0] : null; }

/** Octet classification from the electron count around the CENTRAL (or either diatomic) atom(s). */
export function octetClass(m) {
  const idx = m.central === null ? [0, 1] : [m.central];
  const worst = idx.map((i) => {
    const n = electronsAround(m, i);
    const target = m.atoms[i] === "H" ? 2 : 8; // hydrogen follows the duet
    return n < target ? "incomplete" : n > target ? "expanded" : "normal";
  });
  if (worst.includes("expanded")) return "expanded";
  if (worst.includes("incomplete")) return "incomplete";
  return "normal";
}

/** Returns a list of problems (empty = molecule is consistent). */
export function validateMolecule(m) {
  const problems = [];
  let valenceSum = 0;
  m.atoms.forEach((sym, i) => {
    const e = getBondingElement(sym);
    if (!e) { problems.push(`${m.id}: unknown element ${sym}`); return; }
    valenceSum += e.valence;
    const used = 2 * m.lonePairs[i] + sharedPairsOn(m, i);
    if (used !== e.valence) problems.push(`${m.id}: ${sym}#${i} uses ${used} of its ${e.valence} valence electrons`);
  });
  const shown = 2 * totalLonePairs(m) + 2 * totalSharedPairs(m);
  if (shown !== valenceSum) problems.push(`${m.id}: ${shown} electrons drawn but ${valenceSum} supplied`);
  if (octetClass(m) !== m.group) problems.push(`${m.id}: group ${m.group} does not match computed class ${octetClass(m)}`);
  return problems;
}

const keyOf = (symbols) => [...symbols].sort().join(",");
const KEYS = new Map(MOLECULES.map((m) => [keyOf(m.atoms), m]));

/** Exact match of the atoms on the canvas to a validated molecule, or null. */
export function findMolecule(symbols) { return KEYS.get(keyOf(symbols)) ?? null; }

const countMap = (symbols) => symbols.reduce((o, s) => ((o[s] = (o[s] ?? 0) + 1), o), {});

/** Molecules that contain the current atoms plus more (to suggest what to add). */
function supersets(symbols) {
  const have = countMap(symbols);
  return MOLECULES.filter((m) => {
    const need = countMap(m.atoms);
    const keys = Object.keys(have);
    return keys.every((k) => (need[k] ?? 0) >= have[k]) && m.atoms.length > symbols.length;
  });
}

/** Human explanation for a set of atoms that is not (yet) a supported molecule. */
export function explainUnsupported(symbols) {
  if (symbols.length === 0) return "Add atoms from the library.";
  if (symbols.length === 1) return `Add more atoms to bond with ${symbols[0]}.`;
  const sup = supersets(symbols);
  if (sup.length) {
    const m = sup[0];
    const have = countMap(symbols);
    const need = countMap(m.atoms);
    const add = Object.keys(need).map((k) => [k, need[k] - (have[k] ?? 0)]).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(" + ");
    return `Not a complete molecule yet. Add ${add} to make ${m.formula}.`;
  }
  return "No validated molecule for these atoms. Try H₂, Cl₂, HCl, O₂, N₂, H₂O, NH₃, CH₄, BF₃, BeCl₂, PCl₅ or SF₆.";
}

/** Example sets for the Single | Double | Triple selector (Normal Octet group only; filtered from the table). */
export function examplesForOrder(order) {
  return MOLECULES.filter((m) => m.group === "normal" && uniformBondOrder(m) === order);
}
export const BOND_ORDERS = [
  { id: 1, label: "Single Bond", title: "Single bond: one shared pair (H₂, Cl₂, HCl and every bond in H₂O, NH₃, CH₄)." },
  { id: 2, label: "Double Bond", title: "Double bond: two shared pairs (O₂)." },
  { id: 3, label: "Triple Bond", title: "Triple bond: three shared pairs (N₂)." },
];
export function examplesForGroup(group) { return MOLECULES.filter((m) => m.group === group); }
