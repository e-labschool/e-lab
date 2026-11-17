// Atom View configurations for Z = 1-36, taken from the shared atomic layer (src/lib/atomic) so that this simulation
// agrees with Electron Configuration and Build an Atom, including the Cr and Cu exceptions (OE-06, X-01).
// The old local Aufbau table stopped at Z = 20; this module keeps the same exports for the components that use them.
import { neutralOccupancy, orbitalBoxes, subshellLabel } from "../../../lib/atomic/index.js";

export const MAX_ATOM_VIEW_Z = 36;
const P_AXES = ["x", "y", "z"];
const D_NAMES = ["xy", "xz", "yz", "x2y2", "z2"];
const OCC = (box) => (box.up && box.down ? "paired" : box.up || box.down ? "up" : "");

/** [{ sublevel: "1s", count: 2 }, ...] in FILLING (energy) order for the neutral atom with Z electrons (Z = 1-36). */
export function fillSublevels(z) {
  if (!Number.isInteger(z) || z < 1 || z > MAX_ATOM_VIEW_Z) return [];
  return neutralOccupancy(z).map((s) => ({ sublevel: subshellLabel(s.n, s.l), count: s.electrons, n: s.n, l: s.l }));
}

const SUPERSCRIPT = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const superscript = (n) => String(n).split("").map((d) => SUPERSCRIPT[d] ?? d).join("");

/** "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶" (filling order, as the orbital diagram is drawn). */
export function formatConfiguration(sublevels) {
  return sublevels.map((s) => `${s.sublevel}${superscript(s.count)}`).join(" ");
}

/** Hund's-rule occupancy for ONE p sublevel (3 orbitals): each "" | "up" | "paired". */
export function pOrbitalOccupancy(pElectronCount) {
  return orbitalBoxes(1, pElectronCount).map(OCC);
}

/** Every occupied (or part-occupied) orbital as an individual id with its occupancy (Hund's rule), for the legend, the
 *  orbital boxes and the 3D clouds: "2p" -> 2px, 2py, 2pz; "3d" -> 3dxy, 3dxz, 3dyz, 3dx2y2, 3dz2. */
export function occupiedOrbitals(z) {
  const out = [];
  for (const { sublevel, count, n, l } of fillSublevels(z)) {
    if (l === 0) out.push({ id: sublevel, sublevel, occupancy: count === 1 ? "up" : "paired", n, l });
    else {
      const names = l === 1 ? P_AXES : D_NAMES;
      orbitalBoxes(l, count).forEach((box, i) => out.push({ id: `${n}${"spd"[l]}${names[i]}`, sublevel, occupancy: OCC(box), n, l }));
    }
  }
  return out;
}

/** Energy order of the subshells that matter up to Z = 36, with the electrons each holds (0 = empty). */
export const ENERGY_ORDER = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p"];
export function energyOrderRows(z) {
  const held = new Map(fillSublevels(z).map((s) => [s.sublevel, s.count]));
  return ENERGY_ORDER.map((sublevel) => ({ sublevel, electrons: held.get(sublevel) ?? 0 }));
}
