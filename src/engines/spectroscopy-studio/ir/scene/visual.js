// What the molecule viewers draw: atoms (element, rest position, style), bonds (with order) and a display rotation. Pure; cached per molecule id.
import { ALL_DEFS, ATOM_STYLE } from "../physics/molecules.js";
import { ORGANICS } from "../data/organics.js";
import { MASS_U } from "../physics/constants.js";

const BOND_ORDER = { co2: 2, n2: 3 };
const LINEAR_DISPLAY = new Set(["hcl", "co2", "n2"]); // drawn horizontally: the physics frame has them along z
const cache = new Map();

export function visualOf(id) {
  if (cache.has(id)) return cache.get(id);
  let v;
  if (ORGANICS[id]) {
    const m = ORGANICS[id];
    v = { id, name: m.name, atoms: m.atoms.map((a) => ({ el: a.el, pos: a.pos })), bonds: m.bonds, masses: m.masses, rotY: 0 };
  } else {
    const d = ALL_DEFS[id]; if (!d) throw new Error(`no visual for ${id}`);
    const bonds = d.molecule ? d.molecule.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })) : d.coordinates.filter((c) => c.type === "stretch").map((c) => ({ a: c.atoms[0], b: c.atoms[1], order: BOND_ORDER[id] ?? 1 }));
    v = { id, name: d.name, atoms: d.atoms.map((a) => ({ el: a.el, pos: a.pos })), bonds, masses: d.atoms.map((a) => MASS_U[a.el]), rotY: LINEAR_DISPLAY.has(id) ? Math.PI / 2 : 0 };
  }
  const M = v.masses.reduce((s, x) => s + x, 0);
  const c = [0, 1, 2].map((k) => v.atoms.reduce((s, a, i) => s + v.masses[i] * a.pos[k], 0) / M);
  v.atoms = v.atoms.map((a) => ({ ...a, pos: a.pos.map((x, k) => x - c[k]), style: ATOM_STYLE[a.el] }));
  v.radius = Math.max(...v.atoms.map((a) => Math.hypot(...a.pos))) + 0.6;
  cache.set(id, v); return v;
}
