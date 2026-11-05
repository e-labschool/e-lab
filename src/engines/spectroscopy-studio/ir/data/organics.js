// The organic molecules shown in stages 7-9: structure graph + 3D coordinates + the localised group vibrations (pure data / builders).
//
// Coordinates: ethanol, ethanal, propanone, ethyl ethanoate and propan-1-ol use the NMR module's generated conformers (booklet bond lengths, ideal
// angles; a representative conformer, not an optimised structure); ethanoic acid is built with the same generator; methylamine, ethanenitrile and
// ethene are placed from standard bond lengths and angles. All are for DISPLAY and for mass-weighted group vibrations; none is a computed structure.
import { MOLECULE_BY_ID, buildMolecule } from "../../nmr/molecular/model/molecules.js";
import { coordinatesFor } from "../../nmr/molecular/model/geometry.js";
import { MASS_U } from "../physics/constants.js";
import { norm } from "../physics/linalg.js";
import { eckartVectors, projectOutTR, toCartesian, toMassWeighted } from "../physics/normalModes.js";

const BK = { basis: "reference", bookletRow: null };
const ethanoicAcidDef = {
  id: "ethanoic-acid", name: "Ethanoic acid", formula: "C₂H₄O₂", condensed: "CH₃COOH", aliases: ["acetic acid"],
  heavy: [["C1", "C"], ["C2", "C"], ["O1", "O"], ["O2", "O"]], bonds: [["C1", "C2", 1], ["C2", "O1", 2], ["C2", "O2", 1]], root: "C1", torsions: { H5: { ref: "O1", phi: 0 } },
  structural: "", environments: [
    { id: "a", label: "CH₃", heavy: ["C1"], delta: 2.1, range: [2.0, 2.3], ...BK, descriptor: "", note: "" },
    { id: "b", label: "OH", heavy: ["O2"], delta: 11, range: [9, 13], ...BK, exchangeable: true, descriptor: "", note: "" },
  ], couplings: [], teacherNote: "",
};
let acid = null;
try { acid = buildMolecule(ethanoicAcidDef); } catch { acid = null; }

const centre = (pts) => pts.map((p) => p).reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length);
const fromNmr = (mol, condensed, nameOverride) => {
  const xyz = coordinatesFor(mol);
  return { id: mol.id, name: nameOverride ?? mol.name, formula: mol.formula, condensed: condensed ?? mol.condensed, atoms: mol.atoms.map((a, i) => ({ el: a.el, pos: xyz[i], key: a.key })), bonds: mol.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })) };
};

const tetH = (c, axis, bond, phi0 = 0) => [0, 120, 240].map((d) => { const p = ((phi0 + d) * Math.PI) / 180; const s = 0.9428; return [c[0] + bond * s * Math.cos(p), c[1] + bond * s * Math.sin(p), c[2] + bond * (axis * -0.3333)]; });

function methylamine() {
  const C = [0, 0, 0]; const N = [0, 0, 1.471];
  const hc = tetH(C, 1, 1.09, 0); // H-C-N 109.5 deg: they point away from N (z negative)
  const ang = (70 * Math.PI) / 180; const half = (58.8 * Math.PI) / 180;
  const hn = [half, -half].map((p) => [N[0] + 1.01 * Math.sin(ang) * Math.cos(p), N[1] + 1.01 * Math.sin(ang) * Math.sin(p), N[2] + 1.01 * Math.cos(ang)]);
  const atoms = [{ el: "C", pos: C }, { el: "N", pos: N }, ...hc.map((pos) => ({ el: "H", pos })), ...hn.map((pos) => ({ el: "H", pos }))];
  return recentre({ id: "methylamine", name: "Methylamine", formula: "CH₅N", condensed: "CH₃NH₂", atoms, bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 }, { a: 1, b: 5, order: 1 }, { a: 1, b: 6, order: 1 }] });
}
function ethanenitrile() {
  const Cm = [0, 0, 0]; const Cn = [0, 0, 1.458]; const N = [0, 0, 1.458 + 1.157];
  const hc = tetH(Cm, 1, 1.09, 0);
  const atoms = [{ el: "C", pos: Cm }, { el: "C", pos: Cn }, { el: "N", pos: N }, ...hc.map((pos) => ({ el: "H", pos }))];
  return recentre({ id: "ethanenitrile", name: "Ethanenitrile", formula: "C₂H₃N", condensed: "CH₃CN", atoms, bonds: [{ a: 0, b: 1, order: 1 }, { a: 1, b: 2, order: 3 }, { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 }, { a: 0, b: 5, order: 1 }] });
}
function ethene() {
  const hx = 1.0868 * Math.cos((121.3 * Math.PI) / 180); const hy = 1.0868 * Math.sin((121.3 * Math.PI) / 180); const x = 0.6695;
  const atoms = [{ el: "C", pos: [-x, 0, 0] }, { el: "C", pos: [x, 0, 0] }, { el: "H", pos: [-x + hx, hy, 0] }, { el: "H", pos: [-x + hx, -hy, 0] }, { el: "H", pos: [x - hx, hy, 0] }, { el: "H", pos: [x - hx, -hy, 0] }];
  return recentre({ id: "ethene", name: "Ethene", formula: "C₂H₄", condensed: "CH₂=CH₂", atoms, bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }, { a: 1, b: 4, order: 1 }, { a: 1, b: 5, order: 1 }] });
}
function recentre(m) { const M = m.atoms.reduce((s, a) => s + MASS_U[a.el], 0); const c = [0, 1, 2].map((k) => m.atoms.reduce((s, a) => s + MASS_U[a.el] * a.pos[k], 0) / M); return { ...m, atoms: m.atoms.map((a) => ({ ...a, pos: a.pos.map((v, k) => v - c[k]) })) }; }

const NMR_IDS = { ethanol: "CH₃CH₂OH", ethanal: "CH₃CHO", propanone: "CH₃COCH₃", "ethyl-ethanoate": "CH₃COOCH₂CH₃", "propan-1-ol": "CH₃CH₂CH₂OH" };
export const ORGANICS = {};
for (const [id, cond] of Object.entries(NMR_IDS)) ORGANICS[id] = fromNmr(MOLECULE_BY_ID[id], cond);
if (acid) ORGANICS["ethanoic-acid"] = fromNmr(acid, "CH₃COOH");
ORGANICS.methylamine = methylamine(); ORGANICS.ethanenitrile = ethanenitrile(); ORGANICS.ethene = ethene();
for (const m of Object.values(ORGANICS)) { m.centre = centre(m.atoms.map((a) => a.pos)); m.masses = m.atoms.map((a) => MASS_U[a.el]); m.radius = Math.max(...m.atoms.map((a) => norm(a.pos.map((v, k) => v - m.centre[k])))); }

// ------------- localised group vibrations -------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a) => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };
const neighbours = (mol, i) => mol.bonds.filter((b) => b.a === i || b.b === i).map((b) => (b.a === i ? b.b : b.a));
const bondOrder = (mol, i, j) => mol.bonds.find((b) => (b.a === i && b.b === j) || (b.a === j && b.b === i))?.order ?? 0;
const atomsOf = (mol, el) => mol.atoms.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0);

/**
 * The atoms of the group a given functional-group id vibrates, found from the structure graph: { centre, terminals, rigid? }.
 *   oh      O–H            centre O, terminal H
 *   nh      N–H (NH2)      centre N, terminals both H
 *   ch      C–H            centre = the CH3 carbon, terminals its H atoms (symmetric stretch of the CH3 group)
 *   cn      C≡N            centre C, terminal N
 *   cdo     C=O            centre C, terminal O
 *   cdc     C=C            centre C, terminal the other C
 *   co      C–O (single)   centre C, terminals the O and whatever is on it (moves as a rigid fragment)
 *   aldch   CHO C–H        centre C(=O), terminal H
 */
export function groupAtoms(mol, groupId) {
  const A = mol.atoms;
  switch (groupId) {
    case "oh-alc": case "oh-acid": { const o = atomsOf(mol, "O").find((i) => neighbours(mol, i).some((n) => A[n].el === "H")); return o === undefined ? null : { centre: o, terminals: neighbours(mol, o).filter((n) => A[n].el === "H") }; }
    case "nh": { const n = atomsOf(mol, "N").find((i) => neighbours(mol, i).some((x) => A[x].el === "H")); return n === undefined ? null : { centre: n, terminals: neighbours(mol, n).filter((x) => A[x].el === "H") }; }
    case "ch": { const c = atomsOf(mol, "C").find((i) => neighbours(mol, i).filter((n) => A[n].el === "H").length === 3); return c === undefined ? null : { centre: c, terminals: neighbours(mol, c).filter((n) => A[n].el === "H") }; }
    case "aldch": { const c = atomsOf(mol, "C").find((i) => neighbours(mol, i).some((n) => A[n].el === "O" && bondOrder(mol, i, n) === 2) && neighbours(mol, i).some((n) => A[n].el === "H")); return c === undefined ? null : { centre: c, terminals: neighbours(mol, c).filter((n) => A[n].el === "H") }; }
    case "cn": { const n = atomsOf(mol, "N").find((i) => neighbours(mol, i).some((c) => bondOrder(mol, i, c) === 3)); if (n === undefined) return null; return { centre: neighbours(mol, n)[0], terminals: [n] }; }
    case "cdo": { const o = atomsOf(mol, "O").find((i) => neighbours(mol, i).some((c) => bondOrder(mol, i, c) === 2)); if (o === undefined) return null; return { centre: neighbours(mol, o)[0], terminals: [o] }; }
    case "cdc": { const b = mol.bonds.find((x) => x.order === 2 && A[x.a].el === "C" && A[x.b].el === "C"); return b ? { centre: b.a, terminals: [b.b] } : null; }
    case "co": { // a C-O single bond: the O (with its H or its other group) moves against the carbon
      for (const o of atomsOf(mol, "O")) { const nb = neighbours(mol, o); const c = nb.find((i) => A[i].el === "C" && bondOrder(mol, i, o) === 1 && !neighbours(mol, i).some((k) => A[k].el === "O" && bondOrder(mol, i, k) === 2)); if (c !== undefined) return { centre: c, terminals: [o, ...nb.filter((i) => i !== c && A[i].el === "H")], rigid: true }; }
      for (const o of atomsOf(mol, "O")) { const nb = neighbours(mol, o); const c = nb.find((i) => A[i].el === "C" && bondOrder(mol, i, o) === 1); if (c !== undefined) return { centre: c, terminals: [o, ...nb.filter((i) => i !== c)], rigid: true }; }
      return null;
    }
    default: return null;
  }
}

/** Does this molecule contain the group? (used to decide whether a clicked band can be shown on the structure) */
export const hasGroup = (mol, groupId) => groupAtoms(mol, groupId) !== null && (groupId !== "oh-alc" || !mol.atoms.some((a, i) => a.el === "O" && neighbours(mol, i).some((n) => bondOrder(mol, i, n) === 2)))
  && (groupId !== "oh-acid" || mol.atoms.some((a, i) => a.el === "O" && neighbours(mol, i).some((n) => bondOrder(mol, i, n) === 2)));

/**
 * LOCALISED group-stretch pattern (simplified normal-mode representation): the terminal atoms move along their bond to the centre, the centre recoils so
 * that the linear momentum is zero (mass-weighted amplitudes), then the translation and rotation components that remain (for off-axis fragments) are
 * projected out, so the displacement has zero linear AND angular momentum. Returns { disp: [[x,y,z] per atom, max |d| = 1], moving: [indices] }.
 */
export function groupStretchMode(mol, groupId) {
  const g = groupAtoms(mol, groupId); if (!g) return null;
  const n = mol.atoms.length; const m = mol.masses; const d = new Float64Array(3 * n);
  const P = mol.atoms.map((a) => a.pos);
  const dir0 = unit(sub(P[g.terminals[0]], P[g.centre]));
  for (const t of g.terminals) {
    const u = g.rigid ? dir0 : unit(sub(P[t], P[g.centre]));
    for (let k = 0; k < 3; k += 1) { d[3 * t + k] += u[k]; d[3 * g.centre + k] -= (m[t] * u[k]) / m[g.centre]; }
  }
  const tr = eckartVectors(mol.atoms.map((a) => ({ el: a.el, pos: a.pos })));
  const L = projectOutTR(toMassWeighted(d, m), tr);
  const cart = toCartesian(L, m);
  let mx = 0; for (let i = 0; i < n; i += 1) mx = Math.max(mx, Math.hypot(cart[3 * i], cart[3 * i + 1], cart[3 * i + 2]));
  const disp = Array.from({ length: n }, (_, i) => [cart[3 * i] / mx, cart[3 * i + 1] / mx, cart[3 * i + 2] / mx]);
  const moving = g.terminals.concat([g.centre]);
  return { disp, dispRaw: cart, L, moving, group: g };
}
