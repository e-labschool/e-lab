// Molecule definitions of the IR module: geometry, partial charges and the valence force field. PURE DATA + small builders.
//
// WHAT IS REAL AND WHAT IS A MODEL
//   * Geometries: standard equilibrium structures (HCl 1.2746 A, H2O 0.9572 A / 104.52 deg, CO2 1.160 A linear, CH4 1.087 A tetrahedral,
//     N2 1.0977 A); ethanol from the NMR module's generated conformer (booklet bond lengths, tetrahedral angles; not an optimised structure).
//   * Force constants: a few valence-force-field constants per molecule. For HCl, N2, H2O, CO2 and CH4 they are FITTED so that the harmonic
//     model reproduces the observed gas-phase FUNDAMENTALS (effective, "anharmonicity absorbed" constants, see scripts/fit-ir-force-field.mjs).
//     For ethanol they are typical group values tuned to the representative group frequencies: ethanol's eigenvectors are those of a
//     simplified force field, not of a quantum-chemical calculation.
//   * Partial charges: illustrative point charges (neutral molecule). HCl / H2O charges reproduce the experimental dipole moment (1.08 D, 1.85 D);
//     the others are generic. They are used ONLY to ask whether the dipole moment changes along a normal mode (a yes / no and a relative size).
//   * Literature wavenumbers (gas phase, representative; fundamentals): see the "ref" fields; the source strings are shown in the UI.
import { MOLECULE_BY_ID } from "../../nmr/molecular/model/molecules.js";
import { coordinatesFor } from "../../nmr/molecular/model/geometry.js";

export const ATOM_STYLE = { H: { color: "#e8eefc", radius: 0.3 }, C: { color: "#8a93a8", radius: 0.42 }, O: { color: "#ef4a4a", radius: 0.4 }, N: { color: "#5b8cff", radius: 0.4 }, Cl: { color: "#4ade80", radius: 0.5 } };

const SRC_NIST_DIATOMIC = "NIST Chemistry WebBook, constants of diatomic molecules (Huber and Herzberg): fundamental = we - 2 wexe";
const SRC_SHIMANOUCHI = "Shimanouchi, Tables of Molecular Vibrational Frequencies, Consolidated Vol. I (NSRDS-NBS 39), as tabulated in the NIST Chemistry WebBook";
const SRC_HERZBERG = "Herzberg, Molecular Spectra and Molecular Structure II: Infrared and Raman Spectra of Polyatomic Molecules";
export const GAS_NOTE = "gas phase, representative";

const tet = (r) => { const s = r / Math.sqrt(3); return [[s, s, s], [s, -s, -s], [-s, s, -s], [-s, -s, s]]; };

function hydrideDef(id, name, formula, atoms, coordinates, couplings, params, extra) {
  return { id, name, formula, atoms, coordinates, couplings, params, ...extra };
}

const h2oR = 0.9572; const h2oHalf = (104.52 * Math.PI) / 360;

/** HCl, H2O, CO2, CH4, N2: the small molecules with literature fundamentals. */
export const SMALL_DEFS = {
  hcl: hydrideDef("hcl", "Hydrogen chloride", "HCl",
    [{ el: "H", pos: [0, 0, 0], q: 0.18 }, { el: "Cl", pos: [0, 0, 1.2746], q: -0.18 }],
    [{ type: "stretch", atoms: [0, 1], param: "r" }], [], { r: 480.7158 },
    { dipoleD: 1.08, linear: true, ref: [{ id: "stretch", label: "H–Cl stretch", sym: "Σ⁺", wn: 2886, kind: "stretch", source: SRC_NIST_DIATOMIC }] }),
  h2o: hydrideDef("h2o", "Water", "H₂O",
    [{ el: "O", pos: [0, 0, 0], q: -0.66 }, { el: "H", pos: [h2oR * Math.sin(h2oHalf), 0, -h2oR * Math.cos(h2oHalf)], q: 0.33 }, { el: "H", pos: [-h2oR * Math.sin(h2oHalf), 0, -h2oR * Math.cos(h2oHalf)], q: 0.33 }],
    [{ type: "stretch", atoms: [0, 1], param: "r" }, { type: "stretch", atoms: [0, 2], param: "r" }, { type: "bend", atoms: [1, 0, 2], param: "a" }],
    [{ a: 0, b: 1, param: "rr" }], { r: 767.1153, rr: -9.387357, a: 0.6441081 },
    { dipoleD: 1.85, linear: false, ref: [
      { id: "bend", label: "Bending", sym: "A₁ (ν₂)", wn: 1595, kind: "bend", source: SRC_SHIMANOUCHI },
      { id: "sym", label: "Symmetric stretch", sym: "A₁ (ν₁)", wn: 3657, kind: "sym", source: SRC_SHIMANOUCHI },
      { id: "asym", label: "Asymmetric stretch", sym: "B₂ (ν₃)", wn: 3756, kind: "asym", source: SRC_SHIMANOUCHI },
    ] }),
  co2: hydrideDef("co2", "Carbon dioxide", "CO₂",
    [{ el: "O", pos: [0, 0, -1.16], q: -0.32 }, { el: "C", pos: [0, 0, 0], q: 0.64 }, { el: "O", pos: [0, 0, 1.16], q: -0.32 }],
    [{ type: "stretch", atoms: [0, 1], param: "r" }, { type: "stretch", atoms: [1, 2], param: "r" }, { type: "linbend", atoms: [0, 1, 2], axis: "x", param: "a" }, { type: "linbend", atoms: [0, 1, 2], axis: "y", param: "a" }],
    [{ a: 0, b: 1, param: "rr" }], { r: 1617.027, rr: 198.5346, a: 0.7694826 },
    { dipoleD: 0, linear: true, canonAtoms: [1, 0, 2], ref: [
      { id: "bend", label: "Bending (degenerate pair)", sym: "Πᵤ (ν₂)", wn: 667, kind: "bend", source: SRC_HERZBERG },
      { id: "sym", label: "Symmetric stretch", sym: "Σ⁺ᵍ (ν₁)", wn: 1388, kind: "sym", source: `${SRC_HERZBERG}; 1388 is the upper level of the Fermi dyad with 2ν₂ (Raman-active)`, note: "Raman-active only: observed by Raman scattering, not in the IR spectrum of the isolated molecule." },
      { id: "asym", label: "Asymmetric stretch", sym: "Σ⁺ᵤ (ν₃)", wn: 2349, kind: "asym", source: SRC_HERZBERG },
    ] }),
  ch4: hydrideDef("ch4", "Methane", "CH₄",
    [{ el: "C", pos: [0, 0, 0], q: -0.4 }, ...tet(1.087).map((p) => ({ el: "H", pos: p, q: 0.1 }))],
    methaneCoordinates(), methaneCouplings(), { r: 489.7546, rr: 5.16589, a: 0.5002092, aa: -0.02506087, ab: 0 },
    { dipoleD: 0, linear: false, canonAtoms: [1, 2, 3, 4, 0], ref: [
      { id: "t2bend", label: "Bending (T₂)", sym: "T₂ (ν₄)", wn: 1306, kind: "bend", source: SRC_SHIMANOUCHI },
      { id: "ebend", label: "Bending (E)", sym: "E (ν₂)", wn: 1534, kind: "bend", source: SRC_SHIMANOUCHI },
      { id: "sym", label: "Symmetric stretch", sym: "A₁ (ν₁)", wn: 2917, kind: "sym", source: SRC_SHIMANOUCHI },
      { id: "t2stretch", label: "Asymmetric stretch (T₂)", sym: "T₂ (ν₃)", wn: 3019, kind: "asym", source: SRC_SHIMANOUCHI },
    ] }),
  n2: hydrideDef("n2", "Nitrogen", "N₂",
    [{ el: "N", pos: [0, 0, -0.5489], q: 0 }, { el: "N", pos: [0, 0, 0.5489], q: 0 }],
    [{ type: "stretch", atoms: [0, 1], param: "r" }], [], { r: 2239.523 },
    { dipoleD: 0, linear: true, ref: [{ id: "stretch", label: "N≡N stretch", sym: "Σ⁺ᵍ", wn: 2330, kind: "stretch", source: `${SRC_NIST_DIATOMIC} (Raman-active only)`, note: "Homonuclear diatomic: no dipole, so the stretch is IR-inactive (Raman-active)." }] }),
};

function methaneCoordinates() {
  const c = []; for (let i = 1; i <= 4; i += 1) c.push({ type: "stretch", atoms: [0, i], param: "r" });
  for (let i = 1; i <= 4; i += 1) for (let j = i + 1; j <= 4; j += 1) c.push({ type: "bend", atoms: [i, 0, j], param: "a" });
  return c;
}
function methaneCouplings() {
  const cp = []; const stretchIdx = (i) => i - 1;
  for (let i = 1; i <= 4; i += 1) for (let j = i + 1; j <= 4; j += 1) cp.push({ a: stretchIdx(i), b: stretchIdx(j), param: "rr" });
  const bends = []; for (let i = 1; i <= 4; i += 1) for (let j = i + 1; j <= 4; j += 1) bends.push([i, j]);
  bends.forEach(([i, j], p) => bends.forEach(([k, l], q) => {
    if (q <= p) return; const shared = [i, j].filter((x) => [k, l].includes(x)).length;
    cp.push({ a: 4 + p, b: 4 + q, param: shared === 1 ? "aa" : "ab" });
  }));
  return cp;
}

// ---------- ethanol (graph-based valence force field, 9 atoms, 21 vibrations) ----------
const ETHANOL_CHARGE = { C1: -0.05, C2: 0.12, O1: -0.6, HO: 0.38, HC1: 0.03, HC2: 0.03 };
const ETH_STRETCH = (mol, a, b) => {
  const e = [mol.atoms[a].el, mol.atoms[b].el].sort().join("");
  if (e === "HO") return "rOH"; if (e === "CO") return "rCO"; if (e === "CC") return "rCC";
  const c = mol.atoms[a].el === "C" ? a : b; return mol.atoms[c].key === "C1" ? "rCHm" : "rCHe";
};
export function graphForceFieldDef(mol, { id, charges, params, extra }) {
  const xyz = coordinatesFor(mol);
  const atoms = mol.atoms.map((a, i) => ({ el: a.el, pos: xyz[i], q: charges(a, i) }));
  const coordinates = [];
  for (const b of mol.bonds) coordinates.push({ type: "stretch", atoms: [b.a, b.b], param: ETH_STRETCH(mol, b.a, b.b), tag: `${mol.atoms[b.a].key}-${mol.atoms[b.b].key}` });
  for (const c of mol.atoms) {
    const nb = c.neighbours; for (let p = 0; p < nb.length; p += 1) for (let q = p + 1; q < nb.length; q += 1) {
      const centre = c.idx; const key = [mol.atoms[nb[p]].el, mol.atoms[nb[q]].el].sort().join("") + c.el;
      let param; if (key === "HHC") param = "aHCH"; else if (key === "CHC") param = "aCCH"; else if (key === "HOC") param = "aOCH"; else if (key === "COC") param = "aCCO"; else if (key === "CHO") param = "aCOH"; else throw new Error(`angle ${key}`);
      coordinates.push({ type: "bend", atoms: [nb[p], centre, nb[q]], param, centre: c.key });
    }
  }
  return { id, name: mol.name, formula: mol.formula, atoms, coordinates, couplings: [], params, molecule: mol, linear: false, ...extra };
}

const ethanolMol = MOLECULE_BY_ID.ethanol;
function ethanolDef() {
  const ho = ethanolMol.atoms.find((a) => a.isHydrogen && ethanolMol.atoms[a.parent].el === "O");
  const hm = ethanolMol.atoms.find((a) => a.isHydrogen && ethanolMol.atoms[a.parent].key === "C1");
  const d = graphForceFieldDef(ethanolMol, {
    id: "ethanol",
    charges: (a) => (a.isHydrogen ? (ethanolMol.atoms[a.parent].el === "O" ? ETHANOL_CHARGE.HO : ETHANOL_CHARGE.HC1) : ETHANOL_CHARGE[a.key]),
    params: { rOH: 747.7, rCO: 684.2, rCC: 447, rCHm: 477, rCHe: 473.3, aHCH: 0.5251, aCCH: 0.62, aOCH: 0.7, aCCO: 1.0, aCOH: 0.7, tOH: 0.02, tCH3: 0.02 },
    extra: {},
  });
  const C1 = ethanolMol.atoms.findIndex((a) => a.key === "C1"); const C2 = ethanolMol.atoms.findIndex((a) => a.key === "C2"); const O1 = ethanolMol.atoms.findIndex((a) => a.key === "O1");
  // two torsions (O-H about C-O, CH3 about C-C) so that no vibration is left without a restoring force
  d.coordinates.push({ type: "dihedral", atoms: [ho.idx, O1, C2, C1], param: "tOH", tag: "torsion O–H" });
  d.coordinates.push({ type: "dihedral", atoms: [hm.idx, C1, C2, O1], param: "tCH3", tag: "torsion CH3" });
  return d;
}
export const ETHANOL_DEF = ethanolDef();

export const ALL_DEFS = { ...SMALL_DEFS, ethanol: ETHANOL_DEF };
