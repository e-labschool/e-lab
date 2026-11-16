// Single source of truth for the Ionization Energy Explorer's atomic state, derived from ONE number: how many electrons have
// been removed. Electron structure comes from the SHARED atomic data layer (src/lib/atomic/electronConfiguration.js): the species
// after k removals is speciesOccupancy(Z, +k), so the removal order is the IB cation rule (outermost shell first, p before s,
// 4s before 3d), identical to every other simulation. The orbital-explorer Z <= 20 helper this file used to depend on is no
// longer used here.
import { ionizationElementByAtomicNumber, ionizationEnergyForStep } from "./ionizationData.js";
import { speciesOccupancy, fullString, orbitalBoxes, subshellLabel, shellMax } from "../../../lib/atomic/electronConfiguration.js";
import { speciesLabel as sharedSpeciesLabel } from "../../../lib/atomic/format.js";

const occKey = (s) => `${s.n}${"spdf"[s.l]}`;

/** Sublevel label of each successive electron removed, e.g. Mg: ["3s","3s","2p",...,"1s"]. */
export function getRemovalOrder(atomicNumber) {
  const order = [];
  let prev = new Map();
  for (let k = 0; k <= atomicNumber; k += 1) {
    const sp = speciesOccupancy(atomicNumber, k);
    const cur = new Map(sp.occupancy.map((s) => [occKey(s), s.electrons]));
    if (k > 0) {
      for (const [key, count] of prev) if ((cur.get(key) ?? 0) < count) order.push(key);
    }
    prev = cur;
  }
  return order;
}

/** Principal-shell occupancy { n: electrons }, empty shells absent. */
export function getShellOccupancy(atomicNumber, electronsRemoved) {
  const sp = speciesOccupancy(atomicNumber, electronsRemoved);
  const shells = {};
  for (const s of sp?.occupancy ?? []) shells[s.n] = (shells[s.n] ?? 0) + s.electrons;
  return shells;
}

export const shellCapacity = shellMax;
export const speciesLabel = (symbol, electronsRemoved) => sharedSpeciesLabel(symbol, Math.max(0, electronsRemoved));

/** Orbital boxes as the OrbitalDiagram expects them (s and p orbitals, "up" | "paired"), by Hund's rule. */
function orbitalsFor(occupancy) {
  const out = [];
  for (const s of occupancy) {
    if (s.l === 0) out.push({ id: occKey(s), sublevel: occKey(s), occupancy: s.electrons === 1 ? "up" : "paired" });
    else if (s.l === 1) orbitalBoxes(1, s.electrons).forEach((b, i) => out.push({ id: `${s.n}p${"xyz"[i]}`, sublevel: occKey(s), occupancy: b.up && b.down ? "paired" : b.up ? "up" : "" }));
  }
  return out;
}

export function deriveAtomState(atomicNumber, electronsRemoved) {
  const element = ionizationElementByAtomicNumber(atomicNumber);
  if (!element) return null;
  const removed = Math.max(0, Math.min(electronsRemoved, atomicNumber));
  const sp = speciesOccupancy(atomicNumber, removed);
  const neutral = speciesOccupancy(atomicNumber, 0);
  const electronCount = atomicNumber - removed;
  const removalOrder = getRemovalOrder(atomicNumber);
  const nextSublevel = removed < removalOrder.length ? removalOrder[removed] : null;
  const shells = getShellOccupancy(atomicNumber, removed);
  const nextShell = nextSublevel ? Number(nextSublevel[0]) : null;
  const previousSublevel = removed > 0 ? removalOrder[removed - 1] : null;
  const previousShell = previousSublevel ? Number(previousSublevel[0]) : null;
  return {
    element,
    electronsRemoved: removed,
    electronCount,
    charge: removed,
    speciesSymbol: speciesLabel(element.symbol, removed),
    shells,
    neutralMaxShell: Math.max(1, ...neutral.occupancy.map((s) => s.n)), // ring radii are fixed by the NEUTRAL atom (a cation is smaller, never re-spaced)
    maxOccupiedShell: electronCount > 0 ? Math.max(...Object.keys(shells).map(Number)) : 0,
    configuration: fullString(sp.occupancy),
    orbitals: orbitalsFor(sp.occupancy),
    nextSublevel,
    nextShell,
    previousSublevel,
    nextIonizationEnergy: ionizationEnergyForStep(atomicNumber, removed + 1),
    previousIonizationEnergy: removed > 0 ? ionizationEnergyForStep(atomicNumber, removed) : null,
    occupiedSublevels: sp.occupancy.map(occKey),
    isFullyIonized: nextSublevel == null,
    isInnerShellJump: nextShell != null && previousShell != null && nextShell < previousShell,
  };
}
export { subshellLabel };
