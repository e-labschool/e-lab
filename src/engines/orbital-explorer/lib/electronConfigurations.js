// Generates ground-state electron configurations for neutral atoms
// Z=1-20 PROGRAMMATICALLY (Aufbau + Hund + Pauli), not hardcoded per
// element -- so correctness rests on getting the filling ORDER and
// CAPACITY rules right once, verifiable against known configurations,
// rather than needing to separately verify 20 hand-typed strings.

// Filling order through Ca (no transition-metal exceptions needed at
// this scope, per instruction): 1s,2s,2p,3s,3p,4s.
const FILLING_ORDER = [
  { sublevel: "1s", capacity: 2, orbitalCount: 1 },
  { sublevel: "2s", capacity: 2, orbitalCount: 1 },
  { sublevel: "2p", capacity: 6, orbitalCount: 3 },
  { sublevel: "3s", capacity: 2, orbitalCount: 1 },
  { sublevel: "3p", capacity: 6, orbitalCount: 3 },
  { sublevel: "4s", capacity: 2, orbitalCount: 1 },
];

/** Returns [{ sublevel: "1s", count: 2 }, ...] for the given electron
 * total -- Aufbau filling (fill each sublevel to capacity before the
 * next), stopping exactly at `electronCount`. */
export function fillSublevels(electronCount) {
  const result = [];
  let remaining = electronCount;
  for (const { sublevel, capacity } of FILLING_ORDER) {
    if (remaining <= 0) break;
    const count = Math.min(capacity, remaining);
    result.push({ sublevel, count });
    remaining -= count;
  }
  return result;
}

/** Formats a sublevel list as the conventional string, e.g.
 * "1s\u00B2 2s\u00B2 2p\u00B2" -- using real superscript digit
 * characters so it renders correctly even where <sup> markup isn't
 * used (e.g. inside an SVG label or aria-label). */
const SUPERSCRIPT = { "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074", "5": "\u2075", "6": "\u2076" };
function superscript(n) {
  return String(n).split("").map((d) => SUPERSCRIPT[d] ?? d).join("");
}
export function formatConfiguration(sublevels) {
  return sublevels.map((s) => `${s.sublevel}${superscript(s.count)}`).join(" ");
}

/** Hund's-rule occupancy for ONE p sublevel (3 degenerate orbitals):
 * returns an array of 3 values, each "" | "up" | "paired" -- singly
 * occupied (parallel spin) before any pairing, matching the required
 * B: up,_,_ ... N: up,up,up ... O: paired,up,up ... Ne: paired,paired,paired
 * sequence. */
export function pOrbitalOccupancy(pElectronCount) {
  const slots = [0, 0, 0]; // electrons in px, py, pz
  for (let i = 0; i < pElectronCount; i++) {
    // first pass fills each slot singly (i < 3), second pass pairs them (i >= 3)
    const slot = i % 3;
    slots[slot] += 1;
  }
  return slots.map((n) => (n === 0 ? "" : n === 1 ? "up" : "paired"));
}

/** All occupied orbitals for an atom, expanded to individual orbital
 * ids (e.g. "2p" -> "2px","2py","2pz") with their occupancy, for
 * driving both the box diagram and which 3D orbitals to render. */
export function occupiedOrbitals(electronCount) {
  const sublevels = fillSublevels(electronCount);
  const orbitals = [];
  for (const { sublevel, count } of sublevels) {
    if (sublevel.endsWith("s")) {
      orbitals.push({ id: sublevel, sublevel, occupancy: count === 1 ? "up" : "paired" });
    } else if (sublevel.endsWith("p")) {
      const n = sublevel[0];
      const occ = pOrbitalOccupancy(count);
      ["x", "y", "z"].forEach((axis, i) => {
        orbitals.push({ id: `${n}p${axis}`, sublevel, occupancy: occ[i] });
      });
    }
  }
  return orbitals;
}
