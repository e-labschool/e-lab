// Single source of truth for the Ionization Energy Explorer's atomic
// state. EVERYTHING the UI shows (shell occupancy, orbital diagram,
// electron configuration string, species/charge label, which electron is
// next to be removed) is derived here from ONE number -- the current
// electron count -- and nothing else. No shell/orbital numbers are ever
// hard-coded per element anywhere else in this engine.
//
// Sublevel filling itself is NOT reimplemented here: it reuses the
// existing, already-verified Aufbau/Hund/Pauli engine from the Orbital
// Explorer (src/engines/orbital-explorer/lib/electronConfigurations.js),
// which already covers Z = 1-20 (exactly this engine's scope) via a
// single FILLING_ORDER table (1s,2s,2p,3s,3p,4s) -- no separate/parallel
// filling logic to keep in sync.
import { fillSublevels, formatConfiguration, occupiedOrbitals } from "../../orbital-explorer/lib/electronConfigurations.js";
import { ionizationElementByAtomicNumber, ionizationEnergyForStep } from "./ionizationData.js";

/** Flattens `fillSublevels(n)`'s {sublevel,count} groups into ONE array
 * with one entry per electron, in Aufbau (build-up) fill order, e.g. for
 * n=12 (neutral Mg): ["1s","1s","2s","2s","2p","2p","2p","2p","2p","2p","3s","3s"]. */
function flattenFillOrder(electronCount) {
  const out = [];
  for (const { sublevel, count } of fillSublevels(electronCount)) {
    for (let i = 0; i < count; i += 1) out.push(sublevel);
  }
  return out;
}

/** The correct successive-ionization REMOVAL order for a main-group atom
 * (Z 3-20, no d-block electrons ever present in this range): simply the
 * REVERSE of Aufbau fill order -- highest n removed first, then highest l
 * within that n. Returns one sublevel label per electron, so
 * getRemovalOrder(12)[0] === "3s" (the first electron Mg loses) and
 * getRemovalOrder(12)[11] === "1s" (its very last, most tightly bound
 * electron). Verified against the exact sequences required for Na, Mg,
 * Al and Ca (see lib/atomState.test reference in the engine's README/PR
 * description, and the Node verification script run during development):
 *   Na (11e-): 3s, 2p,2p,2p,2p,2p,2p, 2s,2s, 1s,1s
 *   Mg (12e-): 3s,3s, 2p,2p,2p,2p,2p,2p, 2s,2s, 1s,1s
 *   Al (13e-): 3p, 3s,3s, 2p,2p,2p,2p,2p,2p, 2s,2s, 1s,1s
 *   Ca (20e-): 4s,4s, 3p,3p,3p,3p,3p,3p, 3s,3s, 2p,2p,2p,2p,2p,2p, 2s,2s, 1s,1s
 */
export function getRemovalOrder(atomicNumber) {
  return flattenFillOrder(atomicNumber).reverse();
}

/** Principal-shell (n) occupancy, e.g. { 1: 2, 2: 8, 3: 2 } for neutral
 * Mg -- summed from the same fillSublevels() sublevel-level data, never
 * independently tracked. A shell with zero electrons is simply absent
 * from the returned object (so it can be dropped from the visualization
 * entirely, e.g. Mg2+'s n=3 shell disappearing). */
export function getShellOccupancy(electronCount) {
  const shells = {};
  for (const { sublevel, count } of fillSublevels(electronCount)) {
    const n = Number(sublevel[0]);
    shells[n] = (shells[n] ?? 0) + count;
  }
  return shells;
}

/** Shell capacity (2n^2) -- a physical constant, not atom-specific. */
export function shellCapacity(n) {
  return 2 * n * n;
}

/** Species label, e.g. species("Mg", 0) -> "Mg", species("Mg", 1) ->
 * "Mg⁺", species("Mg", 2) -> "Mg²⁺". `electronsRemoved` is
 * the ONLY input describing charge -- charge is never separately tracked
 * from the electron count. */
const SUP_DIGITS = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
export function speciesLabel(symbol, electronsRemoved) {
  if (electronsRemoved <= 0) return symbol;
  const magnitude = electronsRemoved === 1 ? "" : String(electronsRemoved).split("").map((d) => SUP_DIGITS[d]).join("");
  return `${symbol}${magnitude}⁺`;
}

/** Full derived state for one element at one point in its ionization
 * sequence (`electronsRemoved`, 0 = neutral atom). Everything the UI
 * needs comes from this one object, all traced back to `electronCount`. */
export function deriveAtomState(atomicNumber, electronsRemoved) {
  const element = ionizationElementByAtomicNumber(atomicNumber);
  if (!element) return null;
  const totalElectrons = atomicNumber;
  const removed = Math.max(0, Math.min(electronsRemoved, totalElectrons));
  const electronCount = totalElectrons - removed;
  const removalOrder = getRemovalOrder(atomicNumber);
  const nextSublevel = removed < removalOrder.length ? removalOrder[removed] : null;
  const nextIE = ionizationEnergyForStep(atomicNumber, removed + 1);
  const shells = getShellOccupancy(electronCount);
  const maxShell = electronCount > 0 ? Math.max(...Object.keys(shells).map(Number)) : 0;
  const nextShell = nextSublevel ? Number(nextSublevel[0]) : null;
  // The shell the MOST RECENTLY removed electron came from (null before
  // any removal) -- comparing the upcoming removal's shell against THIS
  // (not against the atom's current outermost shell) is what correctly
  // identifies the exact step where removal crosses into a new, inner
  // main energy level, e.g. Mg2+ -> Mg3+ (2p, shell 2) right after
  // Mg+ -> Mg2+ (3s, shell 3) emptied shell 3 entirely.
  const previousSublevel = removed > 0 ? removalOrder[removed - 1] : null;
  const previousShell = previousSublevel ? Number(previousSublevel[0]) : null;
  return {
    element,
    electronsRemoved: removed,
    electronCount,
    charge: removed,
    speciesSymbol: speciesLabel(element.symbol, removed),
    shells, // { n: occupancy }
    maxOccupiedShell: maxShell,
    configuration: formatConfiguration(fillSublevels(electronCount)),
    orbitals: occupiedOrbitals(electronCount),
    nextSublevel, // sublevel the NEXT ionization removes from, or null if fully ionized
    nextShell, // principal shell (n) that sublevel belongs to
    nextIonizationEnergy: nextIE, // kJ/mol, or null if no more electrons
    isFullyIonized: nextSublevel == null,
    // True exactly when the electron about to be removed (nextSublevel)
    // comes from a shell with a LOWER n than the electron most recently
    // removed -- the "jump to an inner main energy level" teaching
    // moment, computed purely from real shell numbers.
    isInnerShellJump: nextShell != null && previousShell != null && nextShell < previousShell,
  };
}
