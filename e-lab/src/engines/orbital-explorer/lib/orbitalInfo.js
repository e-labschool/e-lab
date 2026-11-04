// Human-readable descriptive facts about a single orbital -- used by the
// Build an Atom "selected orbital" info panel. Derives everything from
// the orbital id string plus the existing ORBITAL_DEFS (n, l), never a
// second competing data source.
import { ORBITAL_DEFS } from "./orbitalMath.js";

const SUBLEVEL_NAME = { s: "s", p: "p", d: "d" };
const SHAPE_BY_L = { 0: "sphere", 1: "dumbbell (two lobes)", 2: "cloverleaf / double-dumbbell" };

const ORIENTATION_TEXT = {
  "1s": "none (spherically symmetric)",
  "2s": "none (spherically symmetric)",
  "3s": "none (spherically symmetric)",
  "4s": "none (spherically symmetric)",
  "2px": "x-axis", "2py": "y-axis", "2pz": "z-axis",
  "3px": "x-axis", "3py": "y-axis", "3pz": "z-axis",
  "3dxy": "xy-plane", "3dxz": "xz-plane", "3dyz": "yz-plane",
  "3dx2y2": "x/y axes", "3dz2": "z-axis",
};

const OCCUPANCY_ELECTRONS = { "": 0, up: 1, paired: 2 };

/** Splits an orbital id like "2px" / "3dxy" / "1s" into its principal
 * quantum number, sublevel letter, and orientation suffix (if any) --
 * used to render labels such as 2p with a subscript x. */
export function splitOrbitalId(id) {
  const match = /^(\d)([spd])(.*)$/.exec(id);
  if (!match) return { n: id, letter: "", suffix: "" };
  return { n: match[1], letter: match[2], suffix: match[3] };
}

/** `orbital` is one entry from occupiedOrbitals(): { id, sublevel, occupancy }. */
export function describeOrbital(orbital) {
  const def = ORBITAL_DEFS[orbital.id];
  if (!def) return null;
  return {
    id: orbital.id,
    n: def.n,
    sublevel: SUBLEVEL_NAME[def.family] ?? def.family,
    orientation: ORIENTATION_TEXT[orbital.id] ?? "—",
    shape: SHAPE_BY_L[def.l] ?? "—",
    maxElectrons: 2,
    currentElectrons: OCCUPANCY_ELECTRONS[orbital.occupancy] ?? 0,
  };
}
