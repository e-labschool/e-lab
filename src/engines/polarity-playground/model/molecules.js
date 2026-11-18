// The ten molecules of the Molecular Polarity tab, built from the VSEPR Explorer's own geometry (buildSlots: ideal / lone-pair
// compressed direction sets) and the shared covalent bond lengths (src/lib/lewis/geometry.js bondLength3D). No geometry is typed in
// here: every bond angle comes from the VSEPR model (H2O 104.5 deg, NH3 107 deg, SO2 119.5 deg ...), and the 3D coordinates are what the
// 3D dipole sums are computed from. Pure (no three, no React).
import { buildSlots, molecularGeometryName, electronDomainName, axeNotation } from "../../vsepr-explorer-3d/model/geometry.js";
import { bondLength3D } from "../../../lib/lewis/geometry.js";
import { PAULING, POLAR_BOND_MIN, EQUAL_TOL } from "../../shared-3d/electronCloud/electronegativity.js";
import { add, cross, dot, len, mul, sub, unit } from "../../shared-3d/electronCloud/vec3.js";

const L = (el, order = 1, count = 1) => Array.from({ length: count }, () => ({ el, order }));
/** Spec of every molecule: central atom (null for a diatomic), ligands, lone pairs on the central atom, and the teaching text. */
export const MOLECULE_SPECS = [
  { id: "h2", formula: "H₂", plain: "H2", name: "Hydrogen", diatomic: ["H", "H", 1], lone: 0, shape: "Linear (diatomic)",
    explain: "Two identical atoms share the electrons equally (ΔEN = 0). There are no partial charges and no bond dipole, so H₂ is a non-polar molecule." },
  { id: "hcl", formula: "HCl", plain: "HCl", name: "Hydrogen chloride", diatomic: ["H", "Cl", 1], lone: 0, shape: "Linear (diatomic)",
    explain: "Cl is more electronegative than H, so the shared electrons lie closer to Cl: H is δ+ and Cl is δ−. A single polar bond cannot cancel, so HCl is polar and its dipole points towards Cl." },
  { id: "co2", formula: "CO₂", plain: "CO2", name: "Carbon dioxide", central: "C", ligands: L("O", 2, 2), lone: 0,
    explain: "Each C=O bond is polar (O is δ−), but the molecule is linear: the two equal bond dipoles point in opposite directions and cancel. Net dipole moment = 0, so CO₂ is non-polar." },
  { id: "h2o", formula: "H₂O", plain: "H2O", name: "Water", central: "O", ligands: L("H", 1, 2), lone: 2,
    explain: "Two polar O–H bonds in a bent molecule (two lone pairs on O). The bond dipoles do not cancel: they add to a net dipole pointing towards the O side, so water is polar." },
  { id: "bf3", formula: "BF₃", plain: "BF3", name: "Boron trifluoride", central: "B", ligands: L("F", 1, 3), lone: 0,
    explain: "Three very polar B–F bonds, but the molecule is trigonal planar and symmetrical: the three equal dipoles 120° apart add up to zero. Net dipole moment = 0, so BF₃ is non-polar." },
  { id: "nh3", formula: "NH₃", plain: "NH3", name: "Ammonia", central: "N", ligands: L("H", 1, 3), lone: 1,
    explain: "Three polar N–H bonds in a trigonal pyramidal molecule (a lone pair on N). The dipoles all lean towards N on one side of the molecule, so they do not cancel: NH₃ is polar." },
  { id: "ch4", formula: "CH₄", plain: "CH4", name: "Methane", central: "C", ligands: L("H", 1, 4), lone: 0,
    explain: "C–H bonds are almost non-polar (ΔEN = 0.35, below the usual 0.4 cut-off), and the tetrahedral shape is symmetrical in any case. Net dipole moment = 0: CH₄ is non-polar." },
  { id: "ch3cl", formula: "CH₃Cl", plain: "CH3Cl", name: "Chloromethane", central: "C", ligands: [{ el: "H", order: 1 }, { el: "H", order: 1 }, { el: "H", order: 1 }, { el: "Cl", order: 1 }], lone: 0,
    explain: "Tetrahedral, but the four bonds are not all the same: the C–Cl bond is clearly polar while the C–H bonds are almost non-polar. Nothing cancels it, so the net dipole points generally towards Cl and CH₃Cl is polar." },
  { id: "ccl4", formula: "CCl₄", plain: "CCl4", name: "Tetrachloromethane", central: "C", ligands: L("Cl", 1, 4), lone: 0,
    explain: "Four polar C–Cl bonds, but the four identical dipoles are arranged symmetrically in a tetrahedron and add up to zero. Net dipole moment = 0, so CCl₄ is non-polar." },
  { id: "so2", formula: "SO₂", plain: "SO2", name: "Sulfur dioxide", central: "S", ligands: L("O", 2, 2), lone: 1,
    explain: "Two polar S=O bonds in a bent molecule (one lone pair on S, about 119.5°). The bond dipoles do not cancel, so SO₂ is polar, with its dipole pointing towards the O atoms' side." },
];
export const MOLECULE_IDS = MOLECULE_SPECS.map((s) => s.id);

/** Rotation (3x3 as a function) taking unit vector a onto unit vector b by the shortest turn. */
function alignFn(a, b) {
  const c = dot(a, b);
  if (c > 1 - 1e-12) return (v) => v;
  let ax; let ang;
  if (c < -1 + 1e-12) { ax = Math.abs(a[0]) < 0.9 ? unit(cross(a, [1, 0, 0])) : unit(cross(a, [0, 1, 0])); ang = Math.PI; } else { ax = unit(cross(a, b)); ang = Math.acos(Math.max(-1, Math.min(1, c))); }
  const cs = Math.cos(ang); const sn = Math.sin(ang);
  return (v) => add(add(mul(v, cs), mul(cross(ax, v), sn)), mul(ax, dot(ax, v) * (1 - cs)));
}

function rawGeometry(spec) {
  if (spec.diatomic) {
    const [a, b, order] = spec.diatomic; const d = bondLength3D(a, b, order);
    return { atoms: [{ el: a, p: [-d / 2, 0, 0] }, { el: b, p: [d / 2, 0, 0] }], bonds: [[0, 1, order]], lonePairs: [], domains: { bonding: 1, lone: 0 } };
  }
  const nb = spec.ligands.length; const slots = buildSlots(nb, spec.lone); const atoms = [{ el: spec.central, p: [0, 0, 0] }]; const bonds = []; const lonePairs = [];
  let k = 0;
  slots.dirs.forEach((d, i) => {
    if (slots.roles[i] === "bond") { const lg = spec.ligands[k]; atoms.push({ el: lg.el, p: mul(unit(d), bondLength3D(spec.central, lg.el, lg.order)) }); bonds.push([0, k + 1, lg.order]); k += 1; } else lonePairs.push({ atom: 0, dir: unit(d) });
  });
  return { atoms, bonds, lonePairs, domains: { bonding: nb, lone: spec.lone } };
}

/** Qualitative bond dipoles (chemistry convention): for each bond with a polar enough delta-EN a vector from the delta+ atom to the delta- atom. */
export function bondDipolesOf(mol) {
  return mol.bonds.map(([i, j, order]) => {
    const ei = PAULING[mol.atoms[i].el]; const ej = PAULING[mol.atoms[j].el]; const dEN = Math.abs(ei - ej);
    const equal = dEN < EQUAL_TOL; const polar = dEN >= POLAR_BOND_MIN;
    const minus = equal ? null : ei > ej ? i : j; const plus = equal ? null : minus === i ? j : i;
    const dir = polar ? unit(sub(mol.atoms[minus].p, mol.atoms[plus].p)) : [0, 0, 0];
    const magnitude = polar ? dEN : 0; // QUALITATIVE: relative size from delta-EN, in "EN units"; not a measured dipole moment
    return { bond: [i, j], order, plus, minus, dEN, equal, polar, magnitude, dir, vector: mul(dir, magnitude), kind: equal ? "non-polar" : polar ? "polar" : "slightly polar (treated as non-polar)" };
  });
}
/** Net dipole = the TRUE 3D vector sum of the bond dipoles. { vector, magnitude, cancels, hasPolarBonds, direction }. */
export const CANCEL_TOL = 1e-9;
export function netDipoleOf(dipoles) {
  let v = [0, 0, 0]; for (const d of dipoles) v = add(v, d.vector);
  const magnitude = len(v); const hasPolarBonds = dipoles.some((d) => d.polar);
  return { vector: v, magnitude, hasPolarBonds, cancels: hasPolarBonds && magnitude < CANCEL_TOL, polar: magnitude >= CANCEL_TOL, direction: magnitude >= CANCEL_TOL ? mul(v, 1 / magnitude) : [0, 0, 0] };
}
/** Signed partial-charge class of every atom from its polar bonds: +1 delta+, -1 delta-, 0 none. */
export function partialSigns(mol, dipoles = bondDipolesOf(mol)) {
  const s = mol.atoms.map(() => 0);
  for (const d of dipoles) { if (!d.polar) continue; s[d.plus] += d.magnitude; s[d.minus] -= d.magnitude; }
  return s.map((v) => (Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : -1));
}
/** Angles (degrees) between every pair of bonds at the central atom. */
export function bondAngles(mol) {
  const out = [];
  for (let a = 0; a < mol.bonds.length; a += 1) for (let b = a + 1; b < mol.bonds.length; b += 1) {
    const [a0, a1] = mol.bonds[a]; const [b0, b1] = mol.bonds[b]; if (a0 !== b0) continue;
    const u = unit(sub(mol.atoms[a1].p, mol.atoms[a0].p)); const v = unit(sub(mol.atoms[b1].p, mol.atoms[b0].p));
    out.push({ atoms: [a1, a0, b1], deg: (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI });
  }
  return out;
}

const cache = new Map();
/** Fully built molecule { id, formula, name, atoms, bonds, lonePairs, dipoles, net, signs, geometry, domainGeometry, axe, angles, explain }. */
export function getMolecule(id) {
  if (cache.has(id)) return cache.get(id);
  const spec = MOLECULE_SPECS.find((s) => s.id === id); if (!spec) return null;
  const raw = rawGeometry(spec);
  const mol0 = { ...raw };
  const dip0 = bondDipolesOf(mol0); const net0 = netDipoleOf(dip0);
  // present the molecule upright: the net dipole (if any) points up (+y), so the delta- side is on top; symmetric molecules keep their natural frame
  // (a linear triatomic is laid along x, a trigonal-planar one lies in the screen plane)
  let rot = (v) => v;
  if (net0.polar && !spec.diatomic) rot = alignFn(net0.direction, [0, 1, 0]);
  else if (!spec.diatomic && raw.atoms.length === 3 && spec.lone === 0) rot = alignFn(unit(sub(raw.atoms[1].p, raw.atoms[0].p)), [1, 0, 0]);
  const atoms = raw.atoms.map((a) => ({ el: a.el, p: rot(a.p).map((x) => (Math.abs(x) < 1e-12 ? 0 : x)) }));
  const lonePairs = raw.lonePairs.map((lp) => ({ ...lp, dir: rot(lp.dir) }));
  const mol = { id, formula: spec.formula, plain: spec.plain, name: spec.name, atoms, bonds: raw.bonds, lonePairs, central: spec.diatomic ? null : 0 };
  mol.dipoles = bondDipolesOf(mol); mol.net = netDipoleOf(mol.dipoles); mol.signs = partialSigns(mol, mol.dipoles);
  const b = raw.domains.bonding; const l = raw.domains.lone;
  mol.geometry = spec.shape ?? molecularGeometryName(b, l); mol.domainGeometry = spec.diatomic ? "—" : electronDomainName(b + l); mol.axe = spec.diatomic ? null : axeNotation(b, l);
  mol.angles = bondAngles(mol); mol.explain = spec.explain; mol.centre = spec.diatomic ? [0, 0, 0] : [0, 0, 0];
  mol.radius = Math.max(...atoms.map((a) => len(a.p))) + 0.5;
  cache.set(id, mol); return mol;
}
export const ALL_MOLECULES = () => MOLECULE_IDS.map(getMolecule);
