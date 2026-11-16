// Electron-by-electron builder rules (pure). The STUDENT chooses which subshell, which orbital and which spin;
// this module enforces Pauli exclusion and Hund's rule with explained refusals, and diagnoses the finished
// configuration against the shared algorithm WITHOUT having shown the answer beforehand.
//
// state = { z, charge, electrons, boxes: { "1s": [[], ...], "3d": [["up"],["up"],[],[],[]] } }
// Each orbital is an array of 0-2 spins. Subshell keys are "<n><s|p|d|f>". Capacity of every subshell offered is
// the true one (2, 6, 10, 14); the builder never trims the choice to the answer.
import { SUBSHELL_LETTERS, ORBITAL_COUNT, MADELUNG_ORDER, SUBSHELL_CAPACITY, subshellLabel, speciesOccupancy, neutralOccupancy, isExceptionElement } from "./electronConfiguration.js";

export const rule = { PAULI: "Pauli exclusion principle", HUND: "Hund's rule", TOTAL: "Number of electrons", AUFBAU: "Aufbau principle" };

export const parseKey = (key) => {
  const n = Number(key[0]);
  const l = SUBSHELL_LETTERS.indexOf(key.slice(1));
  return { n, l };
};

export function emptyBoxes(shells = [1, 2, 3, 4, 5]) {
  const boxes = {};
  for (const [n, l] of MADELUNG_ORDER) {
    if (n <= Math.max(...shells) && l <= Math.min(n - 1, 3)) boxes[subshellLabel(n, l)] = Array.from({ length: ORBITAL_COUNT[l] }, () => []);
  }
  return boxes;
}

export function newBuilder(z, charge = 0, shells) {
  const sp = speciesOccupancy(z, charge);
  return { z, charge, electrons: sp ? sp.electrons : 0, boxes: emptyBoxes(shells) };
}

export const countInSubshell = (boxes, key) => (boxes[key] ?? []).reduce((s, o) => s + o.length, 0);
export function totalPlaced(state) {
  return Object.keys(state.boxes).reduce((s, k) => s + countInSubshell(state.boxes, k), 0);
}

const clone = (state) => ({ ...state, boxes: Object.fromEntries(Object.entries(state.boxes).map(([k, v]) => [k, v.map((o) => [...o])])) });

/** Try to place one electron of spin `spin` ("up" | "down") in orbital `index` of subshell `key`. */
export function place(state, key, index, spin) {
  const orbs = state.boxes[key];
  if (!orbs || !orbs[index]) return { ok: false, state, violation: { rule: rule.TOTAL, message: "That orbital is not available." } };
  if (totalPlaced(state) >= state.electrons) {
    return { ok: false, state, violation: { rule: rule.TOTAL, message: `All ${state.electrons} electrons of this ${state.charge === 0 ? "atom" : "ion"} are already placed. Remove one first if you want to change your answer.` } };
  }
  const orb = orbs[index];
  if (orb.length >= 2) {
    return { ok: false, state, violation: { rule: rule.PAULI, message: `Pauli exclusion principle: an orbital holds at most two electrons, and they must have opposite spins. This ${key} orbital is full.` } };
  }
  if (orb.includes(spin)) {
    return { ok: false, state, violation: { rule: rule.PAULI, message: `Pauli exclusion principle: two electrons in the same orbital must have opposite spins. This orbital already has a spin-${spin} electron.` } };
  }
  const others = orbs.filter((_, i) => i !== index);
  if (orb.length === 1) {
    // pairing
    if (others.some((o) => o.length === 0)) {
      return { ok: false, state, violation: { rule: rule.HUND, message: `Hund's rule: in a subshell with several orbitals of equal energy, every orbital gets one electron (all with the same spin) before any orbital is doubly occupied. The ${key} subshell still has an empty orbital.` } };
    }
  } else {
    // empty orbital: must be parallel to the singly occupied ones
    const ref = others.find((o) => o.length >= 1);
    if (ref && ref[0] !== spin && others.every((o) => o.length < 2)) {
      return { ok: false, state, violation: { rule: rule.HUND, message: `Hund's rule: electrons in different orbitals of the same subshell have parallel spins (same direction) so that repulsion is minimised. The other ${key} electron${others.filter((o) => o.length).length > 1 ? "s point" : " points"} ${ref[0]}.` } };
    }
  }
  const next = clone(state);
  next.boxes[key][index] = [...orb, spin];
  return { ok: true, state: next, violation: null };
}

/** Remove the last electron of an orbital. */
export function removeFrom(state, key, index) {
  const orbs = state.boxes[key];
  if (!orbs || !orbs[index] || !orbs[index].length) return state;
  const next = clone(state);
  next.boxes[key][index].pop();
  // keep Hund consistent: removing from a doubly occupied orbital is always fine
  return next;
}

export function countsOf(state) {
  const counts = {};
  for (const k of Object.keys(state.boxes)) {
    const c = countInSubshell(state.boxes, k);
    if (c > 0) counts[k] = c;
  }
  return counts;
}

const ORDER = MADELUNG_ORDER.map(([n, l]) => subshellLabel(n, l));

/**
 * Diagnose a (possibly wrong) configuration. Returns { complete, correct, messages: [{ kind, subshell?, text }], expected }.
 * `complete` = all electrons placed. Messages explain WHY, never just "wrong".
 */
export function diagnose(state) {
  const sp = speciesOccupancy(state.z, state.charge);
  const expected = Object.fromEntries(sp.occupancy.map((s) => [subshellLabel(s.n, s.l), s.electrons]));
  const got = countsOf(state);
  const placed = totalPlaced(state);
  const messages = [];
  const complete = placed === state.electrons;
  if (!complete) {
    return { complete, correct: false, expected, messages: [{ kind: "total", text: `You have placed ${placed} electron${placed === 1 ? "" : "s"}, but this ${state.charge === 0 ? "atom" : "ion"} has ${state.electrons} (${state.z} protons ${state.charge === 0 ? "and as many electrons" : state.charge > 0 ? `minus ${state.charge}` : `plus ${-state.charge}`}). Place ${placed < state.electrons ? "the remaining" : "fewer"} electrons before checking.` }] };
  }
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(got)])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const same = keys.every((k) => (expected[k] ?? 0) === (got[k] ?? 0));
  if (same) return { complete, correct: true, expected, messages: [] };

  // 1. Aufbau violation: electrons in a higher subshell while a lower one is not full (ignoring what the species legitimately has).
  const aufbauOnly = state.charge <= 0 ? aufbauRows(state.electrons) : null;
  // 2. special explanations
  const neutralExc = isExceptionElement(state.z);
  if (state.charge === 0 && neutralExc && matchesAufbau(got, aufbauOnly)) {
    messages.push({ kind: "exception", text: exceptionText(state.z) });
  } else if (state.charge > 0) {
    const neutral = Object.fromEntries(neutralOccupancy(state.z).map((s) => [subshellLabel(s.n, s.l), s.electrons]));
    const fromNeutralByAufbau = reduceByFilling(neutral, state.charge);
    if (sameCounts(got, fromNeutralByAufbau) && !sameCounts(got, expected)) {
      messages.push({ kind: "cation-order", text: "For a cation, electrons are removed from the OUTERMOST shell first (highest n), not from the last subshell to be filled. Removing the 4s electrons before the 3d is the classic case: once 3d is occupied it lies below 4s, but the 4s electrons are farther from the nucleus and leave first." });
    } else if (sameCounts(got, neutral)) {
      messages.push({ kind: "cation-neutral", text: `You wrote the neutral atom. A ${state.charge}+ ion has ${state.charge} fewer electrons.` });
    }
  }
  if (!messages.length) {
    const lowerNotFullFor = (k) => ORDER.slice(0, ORDER.indexOf(k)).find((lower) => (got[lower] ?? 0) < SUBSHELL_CAPACITY[SUBSHELL_LETTERS.indexOf(lower.slice(1))] && (expected[lower] ?? 0) > (got[lower] ?? 0));
    const au = keys.find((k) => (got[k] ?? 0) > (expected[k] ?? 0) && lowerNotFullFor(k));
    if (au) {
      messages.push({ kind: "aufbau", subshell: au, text: `Aufbau principle: electrons fill the lowest-energy available subshell first. ${lowerNotFullFor(au)} is lower in energy than ${au} and still has room, so it must fill before ${au}.` });
    } else {
      const k = keys.find((x) => (expected[x] ?? 0) !== (got[x] ?? 0));
      const e = expected[k] ?? 0, g = got[k] ?? 0;
      if (g > e) messages.push({ kind: "too-many", subshell: k, text: `${k} should hold ${e} electron${e === 1 ? "" : "s"}, not ${g}. Check which subshells come before it in the energy order (1s 2s 2p 3s 3p 4s 3d 4p 5s ...).` });
      else messages.push({ kind: "too-few", subshell: k, text: `${k} should hold ${e} electron${e === 1 ? "" : "s"}, but you placed ${g}. ${e === SUBSHELL_CAPACITY[SUBSHELL_LETTERS.indexOf(k.slice(1))] ? `It must be completely full (${e}) before the next subshell starts.` : "Count the electrons still unplaced after the lower subshells are full."}` });
    }
  }
  return { complete, correct: false, expected, messages };
}

function aufbauRows(electrons) {
  const out = {};
  let left = electrons;
  for (const [n, l] of MADELUNG_ORDER) {
    if (left <= 0) break;
    const e = Math.min(SUBSHELL_CAPACITY[l], left);
    out[subshellLabel(n, l)] = e;
    left -= e;
  }
  return out;
}
const matchesAufbau = (got, aufbau) => aufbau && sameCounts(got, aufbau);
const sameCounts = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
};
// remove `charge` electrons from the neutral occupancy in REVERSE FILLING order (the common wrong answer)
function reduceByFilling(neutral, charge) {
  const out = { ...neutral };
  let left = charge;
  for (const k of [...ORDER].reverse()) {
    if (left <= 0) break;
    const have = out[k] ?? 0;
    const take = Math.min(have, left);
    if (take) { out[k] = have - take; left -= take; }
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v > 0));
}
function exceptionText(z) {
  if (z === 24) return "Chromium is one of the two exceptions in the IB range. 4s¹ 3d⁵ is lower in energy than 4s² 3d⁴ because a half-filled 3d subshell (five parallel electrons, one per orbital) is especially stable and the 3d and 4s energies are very close.";
  if (z === 29) return "Copper is one of the two exceptions in the IB range. 4s¹ 3d¹⁰ is lower in energy than 4s² 3d⁹ because a completely filled 3d subshell is especially stable and the 3d and 4s energies are very close.";
  return "This element is an exception to the simple Aufbau order: the real ground-state configuration differs because the subshells involved are very close in energy.";
}

/** Hint ladder. level 1 = principle, 2 = which subshell comes next, 3 = how many there. Never shows more than asked. */
export function hint(state, level = 1) {
  const sp = speciesOccupancy(state.z, state.charge);
  const expected = Object.fromEntries(sp.occupancy.map((s) => [subshellLabel(s.n, s.l), s.electrons]));
  const got = countsOf(state);
  const next = ORDER.find((k) => (got[k] ?? 0) !== (expected[k] ?? 0) && (expected[k] ?? 0) > 0) ?? null;
  if (level <= 1) return { text: state.charge > 0 ? "Start from the neutral atom's configuration, then remove the electrons from the outermost shell (highest n) first." : state.charge < 0 ? "Fill the neutral atom's configuration, then add the extra electrons to the next available orbitals in energy order." : "Fill the lowest-energy subshell first: 1s 2s 2p 3s 3p 4s 3d 4p ... Remember each orbital holds two electrons of opposite spin." };
  if (!next) return { text: "Your subshell counts already match." };
  if (level === 2) return { text: `Look at ${next}: your electrons there do not match.` };
  return { text: `${next} should hold ${expected[next]} electron${expected[next] === 1 ? "" : "s"}.` };
}
