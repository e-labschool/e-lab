// Validated molecule data for the Intermolecular Forces Visualiser. Pure data + geometry (no React, no three).
//
// COORDINATES are in angstrom (A), in a local frame whose origin is the centre of mass. Geometries are experimental gas-phase
// values (bond lengths and angles listed in each builder). PARTIAL CHARGES are qualitative model charges (units of e), one
// per atom, chosen so that the dipole vector computed from geometry + charges reproduces the experimental dipole moment
// (`muD`, debye). They are NOT the result of a quantum-chemical calculation. Homonuclear molecules, noble gases and CH4
// (C-H treated as non-polar, as in IB DP) carry zero charges; CO2 carries bond-polarity charges (EPM2 values) whose
// vector sum is zero by symmetry.
//
// POLARIZABILITY `alpha` is the polarizability volume alpha' in A^3 (CRC Handbook, "Atomic and Molecular Polarizabilities",
// orientation-averaged). It is used only for RELATIVE scaling of induced dipoles (p = alpha' * E, with E in e/A^2 -> p in e*A).
import { ELEMENTS as VSEPR_ELEMENTS } from "../../vsepr-explorer-3d/model/elements.js";
import { add, cross, dot, len, norm, qRot, scale, sub } from "./vec.js";

export const DEBYE_IN_E_ANGSTROM = 0.20819434; // 1 D = 0.2082 e*A

/** Per-element data: colour (shared with the VSEPR Explorer), mass (u), van der Waals radius (A, Bondi/Alvarez), ball-and-stick radius (A). */
export const ELEM = {
  H: { ...VSEPR_ELEMENTS.H, mass: 1.008, vdw: 1.2, ball: 0.3 },
  C: { ...VSEPR_ELEMENTS.C, mass: 12.011, vdw: 1.7, ball: 0.42 },
  N: { ...VSEPR_ELEMENTS.N, mass: 14.007, vdw: 1.55, ball: 0.42 },
  O: { ...VSEPR_ELEMENTS.O, mass: 15.999, vdw: 1.52, ball: 0.41 },
  F: { ...VSEPR_ELEMENTS.F, mass: 18.998, vdw: 1.47, ball: 0.38 },
  S: { ...VSEPR_ELEMENTS.S, mass: 32.06, vdw: 1.8, ball: 0.5 },
  Cl: { ...VSEPR_ELEMENTS.Cl, mass: 35.45, vdw: 1.75, ball: 0.5 },
  Br: { ...VSEPR_ELEMENTS.Br, mass: 79.904, vdw: 1.85, ball: 0.55 },
  I: { ...VSEPR_ELEMENTS.I, mass: 126.904, vdw: 1.98, ball: 0.6 },
  Ar: { symbol: "Ar", name: "Argon", color: "#80d1e3", text: "#05303a", mass: 39.948, vdw: 1.88, ball: 0.9 },
  Ne: { symbol: "Ne", name: "Neon", color: "#ff9bd2", text: "#3a1730", mass: 20.18, vdw: 1.54, ball: 0.72 },
  Na: { symbol: "Na", name: "Sodium", color: "#ab5cf2", text: "#ffffff", mass: 22.99, vdw: 1.02, ball: 0.55 },
};

const RAD = Math.PI / 180;

// ---- geometry builders (return atoms with element + position; bonds as [i, j, order]) -------------------------------
function diatomic(a, b, d) { return { atoms: [{ el: a, p: [0, 0, 0] }, { el: b, p: [d, 0, 0] }], bonds: [[0, 1, 1]] }; }
function bent(centre, outer, r, angleDeg, order = 1) {
  const h = (angleDeg / 2) * RAD;
  return { atoms: [{ el: centre, p: [0, 0, 0] }, { el: outer, p: [r * Math.sin(h), r * Math.cos(h), 0] }, { el: outer, p: [-r * Math.sin(h), r * Math.cos(h), 0] }], bonds: [[0, 1, order], [0, 2, order]] };
}
function pyramidal(centre, outer, r, hxhDeg) {
  const alpha = Math.asin(Math.sin((hxhDeg / 2) * RAD) / Math.sin(60 * RAD)); // angle between each X-H bond and the C3 axis
  const atoms = [{ el: centre, p: [0, 0, 0] }]; const bonds = [];
  for (let k = 0; k < 3; k += 1) { const phi = (k * 2 * Math.PI) / 3; atoms.push({ el: outer, p: [r * Math.sin(alpha) * Math.cos(phi), r * Math.cos(alpha), r * Math.sin(alpha) * Math.sin(phi)] }); bonds.push([0, k + 1, 1]); }
  return { atoms, bonds };
}
function tetrahedral(centre, outer, r) {
  const c = r / Math.sqrt(3);
  const atoms = [{ el: centre, p: [0, 0, 0] }, ...[[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(([x, y, z]) => ({ el: outer, p: [x * c, y * c, z * c] }))];
  return { atoms, bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] };
}
function linear3(centre, outer, r, order) { return { atoms: [{ el: centre, p: [0, 0, 0] }, { el: outer, p: [r, 0, 0] }, { el: outer, p: [-r, 0, 0] }], bonds: [[0, 1, order], [0, 2, order]] }; }
function single(el) { return { atoms: [{ el, p: [0, 0, 0] }], bonds: [] }; }

// ---- helpers ------------------------------------------------------------------------------------------------------
function comOf(atoms) { let m = 0; let c = [0, 0, 0]; for (const a of atoms) { const w = ELEM[a.el].mass; m += w; c = add(c, scale(a.p, w)); } return scale(c, 1 / m); }

/** Dipole vector (e*A) = sum q_i r_i about the centre of mass. Points from the negative towards the positive end (physics convention). */
export function dipoleVector(mol) { let d = [0, 0, 0]; for (const a of mol.atoms) d = add(d, scale(a.p, a.q)); return d; }
export const dipoleDebye = (mol) => len(dipoleVector(mol)) / DEBYE_IN_E_ANGSTROM;

/** Lone-pair directions (unit vectors, local frame) of an acceptor atom, derived from the geometry (VSEPR: tetrahedral electron-domain arrangement). */
function lonePairDirs(atoms, bonds, idx) {
  const nb = bonds.filter((b) => b[0] === idx || b[1] === idx).map((b) => (b[0] === idx ? b[1] : b[0]));
  const p0 = atoms[idx].p;
  const vs = nb.map((j) => norm(sub(atoms[j].p, p0)));
  if (nb.length === 0) return [];
  if (nb.length === 1) { // X-H (F in HF): three lone pairs on a cone, 109.5 deg from the bond
    const ax = scale(vs[0], -1); const t = norm(cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); const t2 = cross(ax, t);
    const cone = (180 - 109.47) * RAD; return [0, 1, 2].map((k) => { const ph = (k * 2 * Math.PI) / 3; return norm(add(scale(ax, Math.cos(cone)), add(scale(t, Math.sin(cone) * Math.cos(ph)), scale(t2, Math.sin(cone) * Math.sin(ph))))); });
  }
  if (nb.length === 2) { // bent (H2O): two lone pairs above/below the molecular plane, tetrahedral-like
    const u = norm(add(vs[0], vs[1])); const w = norm(cross(vs[0], vs[1])); const a = 54.74 * RAD;
    return [norm(add(scale(u, -Math.cos(a)), scale(w, Math.sin(a)))), norm(add(scale(u, -Math.cos(a)), scale(w, -Math.sin(a))))];
  }
  if (nb.length === 3) return [norm(scale(add(add(vs[0], vs[1]), vs[2]), -1))]; // pyramidal (NH3): one lone pair opposite the three bonds
  return [];
}

function finish(id, spec, geo, extra) {
  const com = comOf(geo.atoms);
  const atoms = geo.atoms.map((a, i) => ({ el: a.el, p: sub(a.p, com), q: extra.charges ? extra.charges[i] : 0, i }));
  const mol = {
    id, label: spec.label, name: spec.name, kind: spec.kind, atoms, bonds: geo.bonds,
    alpha: spec.alpha, muD: spec.muD ?? 0, geometry: spec.geometry, source: spec.source,
    category: spec.category, compareOnly: !!spec.compareOnly,
  };
  // donors: hydrogens bonded to N, O or F (the IB definition of hydrogen bonding)
  mol.donors = [];
  for (const [a, b] of geo.bonds) { for (const [d, h] of [[a, b], [b, a]]) if (atoms[h].el === "H" && ["N", "O", "F"].includes(atoms[d].el)) mol.donors.push({ d, h }); }
  // acceptors: N, O or F with lone pairs, only in the hydride molecules offered here (H2O, NH3, HF); see docs
  mol.acceptors = spec.acceptor != null ? [{ atom: spec.acceptor, lps: lonePairDirs(atoms, geo.bonds, spec.acceptor) }] : [];
  mol.dipole = dipoleVector(mol);
  mol.mu = len(mol.dipole) / DEBYE_IN_E_ANGSTROM;
  mol.polar = mol.mu > 0.05;
  // bounding radius of the vdW envelope about the origin
  mol.radius = Math.max(...atoms.map((a) => len(a.p) + ELEM[a.el].vdw));
  return mol;
}

/** Charges (e) that reproduce the target dipole `muD` for a molecule whose heavy atom carries -sum(others). `pattern[i]` = relative weight per atom. */
function fitCharges(geo, pattern, muD) {
  const com = comOf(geo.atoms);
  let d = [0, 0, 0]; geo.atoms.forEach((a, i) => { d = add(d, scale(sub(a.p, com), pattern[i])); });
  const k = (muD * DEBYE_IN_E_ANGSTROM) / len(d);
  return pattern.map((w) => w * k);
}

const defs = [];
const def = (id, spec, geo, charges) => defs.push([id, spec, geo, charges]);

// nonpolar (tray order: H2, N2, O2, Cl2, CH4, CO2, Ar, I2)
def("H2", { label: "H₂", name: "Hydrogen", kind: "diatomic", alpha: 0.787, category: "nonpolar", geometry: "linear, H–H 0.741 Å", source: "NIST CCCBDB; CRC" }, diatomic("H", "H", 0.741));
def("N2", { label: "N₂", name: "Nitrogen", kind: "diatomic", alpha: 1.74, category: "nonpolar", geometry: "linear, N≡N 1.098 Å", source: "NIST CCCBDB; CRC" }, (() => { const g = diatomic("N", "N", 1.098); g.bonds[0][2] = 3; return g; })());
def("O2", { label: "O₂", name: "Oxygen", kind: "diatomic", alpha: 1.58, category: "nonpolar", geometry: "linear, O=O 1.208 Å", source: "NIST CCCBDB; CRC" }, (() => { const g = diatomic("O", "O", 1.208); g.bonds[0][2] = 2; return g; })());
def("Cl2", { label: "Cl₂", name: "Chlorine", kind: "diatomic", alpha: 4.61, category: "nonpolar", geometry: "linear, Cl–Cl 1.988 Å", source: "NIST CCCBDB; CRC" }, diatomic("Cl", "Cl", 1.988));
def("CH4", { label: "CH₄", name: "Methane", kind: "tetrahedral", alpha: 2.59, category: "nonpolar", geometry: "tetrahedral, C–H 1.087 Å, H–C–H 109.5°", source: "NIST CCCBDB; CRC" }, tetrahedral("C", "H", 1.087));
def("CO2", { label: "CO₂", name: "Carbon dioxide", kind: "linear", alpha: 2.91, category: "nonpolar", geometry: "linear, C=O 1.160 Å, O=C=O 180°", source: "NIST CCCBDB; CRC; charges EPM2 (Harris & Yung 1995)" }, linear3("C", "O", 1.16, 2), [0.6512, -0.3256, -0.3256]);
def("Ar", { label: "Ar", name: "Argon", kind: "atom", alpha: 1.64, category: "nonpolar", geometry: "single atom (monatomic)", source: "CRC" }, single("Ar"));
def("I2", { label: "I₂", name: "Iodine", kind: "diatomic", alpha: 10.2, category: "nonpolar", geometry: "linear, I–I 2.666 Å", source: "NIST CCCBDB; CRC (value approximate)" }, diatomic("I", "I", 2.666));
// polar (tray order: HCl, HBr, SO2, H2O, NH3, HF)
def("HCl", { label: "HCl", name: "Hydrogen chloride", kind: "diatomic", alpha: 2.63, muD: 1.09, category: "polar", geometry: "linear, H–Cl 1.275 Å", source: "NIST CCCBDB; CRC" }, diatomic("H", "Cl", 1.275), "fit:1,-1");
def("HBr", { label: "HBr", name: "Hydrogen bromide", kind: "diatomic", alpha: 3.61, muD: 0.82, category: "polar", geometry: "linear, H–Br 1.414 Å", source: "NIST CCCBDB; CRC" }, diatomic("H", "Br", 1.414), "fit:1,-1");
def("SO2", { label: "SO₂", name: "Sulfur dioxide", kind: "bent", alpha: 3.89, muD: 1.63, category: "polar", geometry: "bent, S=O 1.431 Å, O–S–O 119.5°", source: "NIST CCCBDB; CRC" }, bent("S", "O", 1.431, 119.5, 2), "fit:2,-1,-1");
def("H2O", { label: "H₂O", name: "Water", kind: "bent", alpha: 1.45, muD: 1.855, category: "polar", acceptor: 0, geometry: "bent, O–H 0.957 Å, H–O–H 104.5°", source: "NIST CCCBDB; CRC" }, bent("O", "H", 0.9572, 104.52), "fit:-2,1,1");
def("NH3", { label: "NH₃", name: "Ammonia", kind: "pyramidal", alpha: 2.26, muD: 1.47, category: "polar", acceptor: 0, geometry: "trigonal pyramidal, N–H 1.012 Å, H–N–H 106.7°", source: "NIST CCCBDB; CRC" }, pyramidal("N", "H", 1.012, 106.7), "fit:-3,1,1,1");
def("HF", { label: "HF", name: "Hydrogen fluoride", kind: "diatomic", alpha: 0.51, muD: 1.826, category: "polar", acceptor: 1, geometry: "linear, H–F 0.917 Å", source: "NIST CCCBDB; CRC" }, diatomic("H", "F", 0.917), "fit:1,-1");
// comparison-only particles (Compare control): not in the tray
def("Ne", { label: "Ne", name: "Neon", kind: "atom", alpha: 0.396, category: "nonpolar", compareOnly: true, geometry: "single atom (monatomic)", source: "CRC" }, single("Ne"));
def("F2", { label: "F₂", name: "Fluorine", kind: "diatomic", alpha: 1.38, category: "nonpolar", compareOnly: true, geometry: "linear, F–F 1.412 Å", source: "NIST CCCBDB; CRC" }, diatomic("F", "F", 1.412));

export const MOLECULES = {};
for (const [id, spec, geo, ch] of defs) {
  let charges = null;
  if (Array.isArray(ch)) charges = ch;
  else if (typeof ch === "string") charges = fitCharges(geo, ch.slice(4).split(",").map(Number), spec.muD);
  MOLECULES[id] = finish(id, spec, geo, { charges });
}
export const TRAY_NONPOLAR = ["H2", "N2", "O2", "Cl2", "CH4", "CO2", "Ar", "I2"];
export const TRAY_POLAR = ["HCl", "HBr", "SO2", "H2O", "NH3", "HF"];
export const COMPARE_PAIRS = [["Ne", "Ar"], ["F2", "Cl2"], ["Cl2", "I2"]];
export const getMolecule = (id) => MOLECULES[id] ?? null;

// ---- geometry measurements (used by the data-validation tests) ---------------------------------------------------------
export const bondLength = (mol, a, b) => len(sub(mol.atoms[a].p, mol.atoms[b].p));
export function bondAngleDeg(mol, a, centre, b) {
  const u = sub(mol.atoms[a].p, mol.atoms[centre].p); const v = sub(mol.atoms[b].p, mol.atoms[centre].p);
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v))))) * 180) / Math.PI;
}
export const totalCharge = (mol) => mol.atoms.reduce((s, a) => s + a.q, 0);

// ---- pose helpers (a pose is { pos: [x,y,z] in A, quat: [x,y,z,w] }) -----------------------------------------------------
export const atomWorld = (mol, pose, i) => add(pose.pos, qRot(pose.quat, mol.atoms[i].p));
export const dipoleWorld = (mol, pose) => qRot(pose.quat, mol.dipole);
