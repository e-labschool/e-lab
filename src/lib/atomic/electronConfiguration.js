// THE electron-configuration algorithm for every simulation (atoms Z = 1-118 and monatomic ions).
// Replaces three earlier, disagreeing copies (build-an-atom/lib/electronConfiguration.js,
// orbital-explorer/lib/electronConfigurations.js, electron-configuration/logic/buildConfiguration.js).
//
// RULES (IB DP Chemistry S1.3.5 conventions):
//  * Neutral atoms: Aufbau / Madelung order (n + l, then n): 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p,
//    except the ground-state exceptions from src/data/chemistry/electron-config-exceptions.js
//    (Cr, Cu in the IB range Z <= 36; Nb, Mo, Ru, Rh, Pd, Ag, La, Ce, Gd, Pt, Au, Ac, Th, Pa, U, Np, Cm, Lr beyond it).
//  * Cations: electrons are removed from the highest principal shell n first, and within that shell from the
//    highest l first (4p before 4s, and the 4s before the 3d). So Fe -> Fe2+ loses 4s2 (3d6), and Cu -> Cu+
//    loses its single 4s electron (3d10). Ions are NOT filled by the Aufbau order.
//  * Anions: the extra electrons continue the Madelung filling of the neutral atom (O2-: 2p6).
//  * Hund's rule / Pauli: see orbitalBoxes() and the placement rules in electronBuilder.js.
// All functions are pure.
import electronConfigExceptions from "../../data/chemistry/electron-config-exceptions.js";
import { getElement } from "../../data/chemistry/elements.js";
import { toSuperscript } from "./format.js";

export const SUBSHELL_LETTERS = ["s", "p", "d", "f"];
export const SUBSHELL_CAPACITY = [2, 6, 10, 14];
export const ORBITAL_COUNT = [1, 3, 5, 7];
export const MAX_Z = 118;
export const MADELUNG_ORDER = [
  [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [3, 2], [4, 1],
  [5, 0], [4, 2], [5, 1], [6, 0], [4, 3], [5, 2], [6, 1], [7, 0],
  [5, 3], [6, 2], [7, 1],
];
export const NOBLE_GASES = [
  { symbol: "He", z: 2 }, { symbol: "Ne", z: 10 }, { symbol: "Ar", z: 18 },
  { symbol: "Kr", z: 36 }, { symbol: "Xe", z: 54 }, { symbol: "Rn", z: 86 }, { symbol: "Og", z: 118 },
];

export const subshellLabel = (n, l) => `${n}${SUBSHELL_LETTERS[l]}`;
export const shellMax = (n) => 2 * n * n;

const byWriting = (a, b) => (a.n - b.n) || (a.l - b.l);
const byEnergyOrder = (a, b) => orderIndex(a.n, a.l) - orderIndex(b.n, b.l);
const ORDER_INDEX = new Map(MADELUNG_ORDER.map(([n, l], i) => [`${n}${l}`, i]));
const orderIndex = (n, l) => ORDER_INDEX.get(`${n}${l}`) ?? 99;

/** Plain Madelung fill of `electrons` electrons. [{n,l,electrons}] in FILLING order. */
function aufbauFill(electrons) {
  const out = [];
  let left = electrons;
  for (const [n, l] of MADELUNG_ORDER) {
    if (left <= 0) break;
    const e = Math.min(SUBSHELL_CAPACITY[l], left);
    out.push({ n, l, electrons: e });
    left -= e;
  }
  return out;
}

export function isExceptionElement(z) {
  return Object.prototype.hasOwnProperty.call(electronConfigExceptions, z);
}

/** Ground-state occupancy of the NEUTRAL atom, in filling (energy) order, zero rows removed. */
export function neutralOccupancy(z) {
  if (!Number.isInteger(z) || z < 1 || z > MAX_Z) return [];
  const rows = isExceptionElement(z) ? electronConfigExceptions[z].map((s) => ({ ...s })) : aufbauFill(z);
  return rows.filter((s) => s.electrons > 0).sort(byEnergyOrder);
}

/** Cation occupancy: remove `charge` electrons, highest n first then highest l. Returns { occupancy, removed }. */
function removeElectrons(occ, charge) {
  const work = occ.map((s) => ({ ...s }));
  const removed = [];
  let left = charge;
  for (const s of [...work].sort((a, b) => (b.n - a.n) || (b.l - a.l))) {
    if (left <= 0) break;
    const take = Math.min(s.electrons, left);
    if (take > 0) removed.push({ n: s.n, l: s.l, count: take });
    s.electrons -= take;
    left -= take;
  }
  return { occupancy: work.filter((s) => s.electrons > 0).sort(byEnergyOrder), removed };
}

/** Anion occupancy: continue Madelung filling of the neutral atom's subshells. */
function addElectrons(occ, extra) {
  const map = new Map(occ.map((s) => [`${s.n}${s.l}`, { ...s }]));
  const added = [];
  let left = extra;
  for (const [n, l] of MADELUNG_ORDER) {
    if (left <= 0) break;
    const row = map.get(`${n}${l}`) ?? { n, l, electrons: 0 };
    const room = SUBSHELL_CAPACITY[l] - row.electrons;
    if (room <= 0) continue;
    const take = Math.min(room, left);
    row.electrons += take;
    map.set(`${n}${l}`, row);
    added.push({ n, l, count: take });
    left -= take;
  }
  return { occupancy: [...map.values()].filter((s) => s.electrons > 0).sort(byEnergyOrder), added };
}

/**
 * Occupancy of the species with atomic number z and charge `charge` (negative = anion).
 * Returns null when impossible (more electrons removed than exist, or beyond Z = 118).
 */
export function speciesOccupancy(z, charge = 0) {
  if (!Number.isInteger(z) || z < 1 || z > MAX_Z || !Number.isInteger(charge)) return null;
  const electrons = z - charge;
  if (electrons < 0 || electrons > 120) return null;
  const neutral = neutralOccupancy(z);
  if (charge === 0) return { occupancy: neutral, removed: [], added: [], electrons };
  if (charge > 0) {
    const r = removeElectrons(neutral, charge);
    return { occupancy: r.occupancy, removed: r.removed, added: [], electrons };
  }
  const r = addElectrons(neutral, -charge);
  return { occupancy: r.occupancy, removed: [], added: r.added, electrons };
}

/** Subshells sorted into the written order (by n, then s p d f). */
export const writingOrder = (occ) => [...occ].sort(byWriting);
/** Subshells in filling (energy) order. */
export const fillingOrder = (occ) => [...occ].sort(byEnergyOrder);

/** Electrons per shell: [2, 8, 14, 2]. Shell 1 first. */
export function shellArrangement(occ) {
  const per = [];
  for (const s of occ) per[s.n - 1] = (per[s.n - 1] ?? 0) + s.electrons;
  return Array.from(per, (c) => c ?? 0);
}

const fmtRow = (s, sup) => `${subshellLabel(s.n, s.l)}${sup ? toSuperscript(s.electrons) : s.electrons}`;

/** Full configuration string in WRITING order: "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶". */
export function fullString(occ, { superscript = true } = {}) {
  return writingOrder(occ).map((s) => fmtRow(s, superscript)).join(" ");
}
/** Same subshells but in FILLING order: "...3p⁶ 4s² 3d⁶". */
export function fillingString(occ, { superscript = true } = {}) {
  return fillingOrder(occ).map((s) => fmtRow(s, superscript)).join(" ");
}

/** Largest noble-gas core fully contained in the species (needs the species to have > core electrons or equal). */
export function nobleCoreFor(occ, electrons, { strict = false } = {}) {
  let best = null;
  for (const ng of NOBLE_GASES) {
    if (strict ? ng.z >= electrons : ng.z > electrons) break;
    const core = aufbauFill(ng.z);
    const ok = core.every((c) => (occ.find((s) => s.n === c.n && s.l === c.l)?.electrons ?? 0) >= c.electrons);
    if (ok) best = ng;
  }
  return best;
}

/** Noble-gas shorthand "[Ar] 3d⁶" (writing order inside), or null when no core applies. */
export function shorthandString(occ, electrons, { superscript = true, strict = false } = {}) {
  const core = nobleCoreFor(occ, electrons, { strict });
  if (!core) return null;
  const coreRows = aufbauFill(core.z);
  const rest = writingOrder(occ).flatMap((s) => {
    const inCore = coreRows.find((c) => c.n === s.n && c.l === s.l)?.electrons ?? 0;
    const left = s.electrons - inCore;
    return left > 0 ? [{ ...s, electrons: left }] : [];
  });
  return `[${core.symbol}]${rest.length ? ` ${rest.map((s) => fmtRow(s, superscript)).join(" ")}` : ""}`;
}

/**
 * Occupation of the orbitals of one subshell by Hund's rule: each orbital is singly occupied (spin up, parallel)
 * before any is doubly occupied. Returns [{ up: bool, down: bool }] one per orbital.
 */
export function orbitalBoxes(l, electrons) {
  const k = ORBITAL_COUNT[l];
  const boxes = Array.from({ length: k }, () => ({ up: false, down: false }));
  let left = Math.min(electrons, 2 * k);
  for (let i = 0; i < k && left > 0; i += 1, left -= 1) boxes[i].up = true;
  for (let i = 0; i < k && left > 0; i += 1, left -= 1) boxes[i].down = true;
  return boxes;
}

/** Unpaired electrons of a subshell filled by Hund's rule. */
export const unpairedInSubshell = (l, electrons) => {
  const k = ORBITAL_COUNT[l];
  return electrons <= k ? electrons : 2 * k - electrons;
};

/** Total unpaired electrons of a species. */
export function unpairedElectrons(occ) {
  return occ.reduce((sum, s) => sum + unpairedInSubshell(s.l, s.electrons), 0);
}

/** Teaching notes: why this configuration, in IB language. */
export function explainSpecies(z, charge = 0) {
  const sp = speciesOccupancy(z, charge);
  const el = getElement(z);
  if (!sp || !el) return [];
  const notes = [];
  if (isExceptionElement(z)) {
    if (z === 24) notes.push("Chromium is an exception: 4s¹ 3d⁵ (not 4s² 3d⁴). A half-filled 3d subshell with one electron in each d orbital, all parallel, is especially stable (the 3d and 4s energies are very close).");
    else if (z === 29) notes.push("Copper is an exception: 4s¹ 3d¹⁰ (not 4s² 3d⁹). A completely filled 3d subshell is especially stable.");
    else notes.push(`${el.name} is an exception to the simple Aufbau order (beyond the IB range, Z > 36): the real ground state differs from the Madelung prediction.`);
  }
  if (charge > 0) {
    const gone = sp.removed.map((r) => `${r.count} from ${subshellLabel(r.n, r.l)}`).join(", ");
    notes.push(`Cation: electrons are removed from the outermost shell first (highest n): ${gone}.`);
    if (sp.removed.some((r) => r.l === 0 && r.n >= 4) && neutralOccupancy(z).some((s) => s.l === 2 && s.n === 3 && s.n < 4)) {
      notes.push("Transition metals lose the 4s electrons before the 3d electrons, even though 4s fills first. Once 3d is occupied it is lower in energy than 4s.");
    }
  }
  if (charge < 0) {
    const gained = sp.added.map((r) => `${r.count} into ${subshellLabel(r.n, r.l)}`).join(", ");
    notes.push(`Anion: the extra electron${-charge > 1 ? "s go" : " goes"} ${gained}, continuing the Aufbau order.`);
  }
  return notes;
}

/** Everything a UI panel needs about a species. */
export function describeSpecies(z, charge = 0) {
  const sp = speciesOccupancy(z, charge);
  const el = getElement(z);
  if (!sp || !el) return null;
  const occ = sp.occupancy;
  return {
    z, charge, element: el, electrons: sp.electrons,
    occupancy: occ,
    shells: shellArrangement(occ),
    full: fullString(occ),
    filling: fillingString(occ),
    shorthand: shorthandString(occ, sp.electrons, { strict: charge === 0 }),
    isException: charge === 0 && isExceptionElement(z),
    unpaired: unpairedElectrons(occ),
    removed: sp.removed,
    added: sp.added,
    notes: explainSpecies(z, charge),
  };
}
