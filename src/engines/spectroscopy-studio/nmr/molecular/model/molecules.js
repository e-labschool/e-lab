// Molecule library for the molecular side of the NMR simulation. PURE DATA + a small builder (no React, no three).
//
// Each molecule is declared compactly (heavy atoms, bonds, root, environments, couplings) and expanded by buildMolecule():
//   * hydrogens are DERIVED from valences (C = 4, O = 2) so the H count can never disagree with the bonding;
//   * 3D coordinates are generated in geometry.js from the bonded graph (booklet bond lengths + standard geometries);
//   * the declared environments are checked against topology-derived symmetry classes (topology.js, tests);
//   * the declared couplings are checked against the H-C-C-H neighbour graph (topology.js, tests).
//
// EVERY chemical shift is REPRESENTATIVE / IDEALISED (not a measured spectrum). Provenance per environment:
//   basis "booklet"   : the value lies inside the row of IB Chemistry data booklet 2025, section 21 (typical 1H shifts), named in bookletRow
//   basis "reference" : a typical value from standard tables, because the booklet has no row for the environment or the value sits
//                       just outside the booklet row (the note says why). "verified" = checked against a source during development.
// Values the user's specification fixed (e.g. methane 0.2, ethanal 9.8) are marked specValue.
// A molecule whose values could not be supported would be omitted (none had to be).

export const ATOMIC = {
  H: { Z: 1, valence: 1, name: "Hydrogen", pauling: 2.2, color: "#e8eefc", vdw: 1.2 },
  C: { Z: 6, valence: 4, name: "Carbon", pauling: 2.55, color: "#8a93a8", vdw: 1.7 },
  O: { Z: 8, valence: 2, name: "Oxygen", pauling: 3.44, color: "#ef4a4a", vdw: 1.52 },
};

// Bond lengths in angstrom taken from the IB Chemistry data booklet 2025, section 11 (covalent or average covalent bond lengths, pm).
export const BOND_LENGTH_A = { "C-H": 1.08, "C-C": 1.54, "C-O": 1.43, "H-O": 0.97, "C=O": 1.22 };

export const OPERATING_NOTE = "Predicted/idealised spectrum — representative values; not an experimental spectrum.";

const DEFAULT_J = 7; // Hz: typical 3J(H-C-C-H) of a freely rotating alkyl fragment (typical range 6-8 Hz)
const J_NOTE = "Typical 3J(H–C–C–H) for a freely rotating alkyl fragment is 6–8 Hz; 7 Hz used as the representative value.";

const OH_NOTE = "Hydroxyl proton: exchangeable. Its shift (booklet 1.0–6.0) and linewidth change with concentration, solvent, temperature and traces of water; 2.6 is a placeholder representative value, not a measurement.";
const OH_EXCHANGE = "Rapid chemical exchange of the O–H proton averages out its coupling to neighbouring C–H protons in typical samples, so the O–H signal is a (broadened) singlet and the neighbouring C–H signals show no splitting from it. In very dry, pure samples or in some solvents (e.g. DMSO) this coupling can be observed, so do not generalise.";

const BK = {
  ch3: "CH3 (alkyl): 0.9–1.0",
  ch2r: "CH2–R: 1.3–1.4",
  chr2: "CHR2: 1.5",
  roco: "RO–C(=O)–CH2–: 2.0–2.5",
  rco: "R–C(=O)–CH2–: 2.2–2.7",
  roch2: "R–O–CH2–: 3.3–3.7",
  rcooch2: "R–C(=O)–O–CH2–: 3.7–4.8",
  roh: "R–O–H: 1.0–6.0",
  cho: "R–C(=O)–H: 9.4–10.0",
};

/** @type {Array<object>} raw declarations; expanded by buildMolecule */
const DEFS = [
  {
    id: "methane", name: "Methane", formula: "CH₄", condensed: "CH₄", aliases: ["CH4"],
    heavy: [["C1", "C"]], bonds: [], root: "C1",
    structural: "    H\n    |\nH – C – H\n    |\n    H",
    environments: [
      { id: "a", label: "CH₄", heavy: ["C1"], delta: 0.2, range: [0.1, 0.4], basis: "reference", specValue: true, bookletRow: null,
        descriptor: "Four equivalent H on a carbon bonded only to hydrogen: very electron-rich, strongly shielded, very small δ.",
        note: "Specification value (about 0.2 ppm). The booklet has no row for CH4; its alkyl CH3 row (0.9–1.0) is higher. Methane is a gas and is normally measured dissolved in a deuterated solvent." },
    ],
    couplings: [],
    teacherNote: "Single environment, singlet. Equivalent protons do not split each other (the H–H coupling between H on the same carbon is real but has no visible effect when all four are equivalent).",
  },
  {
    id: "ethane", name: "Ethane", formula: "C₂H₆", condensed: "CH₃CH₃", aliases: ["C2H6"],
    heavy: [["C1", "C"], ["C2", "C"]], bonds: [["C1", "C2", 1]], root: "C1",
    structural: "    H   H\n    |   |\nH – C – C – H\n    |   |\n    H   H",
    environments: [
      { id: "a", label: "CH₃", heavy: ["C1", "C2"], delta: 0.9, range: [0.8, 1.0], basis: "booklet", specValue: true, bookletRow: BK.ch3,
        descriptor: "Two equivalent CH₃ groups (rapid rotation about the C–C bond): all six H are equivalent.",
        note: "Inside the booklet alkyl CH3 row (0.9–1.0). Specification value about 0.9 ppm." },
    ],
    couplings: [],
    teacherNote: "H on different carbons are three bonds apart (H–C–C–H) and DO couple, but because all six H are equivalent no splitting is observed: one singlet of area 6.",
  },
  {
    id: "propane", name: "Propane", formula: "C₃H₈", condensed: "CH₃CH₂CH₃", aliases: ["C3H8"],
    heavy: [["C1", "C"], ["C2", "C"], ["C3", "C"]], bonds: [["C1", "C2", 1], ["C2", "C3", 1]], root: "C1",
    structural: "    H   H   H\n    |   |   |\nH – C – C – C – H\n    |   |   |\n    H   H   H",
    environments: [
      { id: "a", label: "CH₂", heavy: ["C2"], delta: 1.3, range: [1.3, 1.4], basis: "booklet", bookletRow: BK.ch2r,
        descriptor: "The central CH₂ (2 H) between two CH₃ groups.", note: "Inside the booklet CH2–R row (1.3–1.4)." },
      { id: "b", label: "CH₃", heavy: ["C1", "C3"], delta: 0.9, range: [0.9, 1.0], basis: "booklet", bookletRow: BK.ch3,
        descriptor: "Two equivalent terminal CH₃ groups (6 H), each next to a CH₂.", note: "Inside the booklet CH3 row (0.9–1.0)." },
    ],
    couplings: [{ a: "a", b: "b", J: DEFAULT_J, type: "³J(H–C–C–H), vicinal", note: J_NOTE }],
    teacherNote: "CH₃: 2 neighbouring H -> triplet. CH₂: 6 equivalent neighbouring H (two CH₃) -> septet (n + 1 = 7); the outer lines (1:6:15:20:15:6:1) are very weak and are easily lost in a real spectrum.",
  },
  {
    id: "propanone", name: "Propanone", formula: "C₃H₆O", condensed: "CH₃COCH₃", aliases: ["acetone", "C3H6O", "dimethyl ketone"],
    heavy: [["C1", "C"], ["C2", "C"], ["O1", "O"], ["C3", "C"]],
    bonds: [["C1", "C2", 1], ["C2", "O1", 2], ["C2", "C3", 1]], root: "C2",
    structural: "    H   O   H\n    |   ‖   |\nH – C – C – C – H\n    |       |\n    H       H",
    environments: [
      { id: "a", label: "CH₃", heavy: ["C1", "C3"], delta: 2.1, range: [2.0, 2.3], basis: "reference", specValue: true, bookletRow: BK.rco,
        descriptor: "Two equivalent CH₃ groups, each next to the C=O group (6 H): deshielded by the carbonyl.",
        note: "Specification value about 2.1 ppm. Booklet R–C(=O)–CH2 row is 2.2–2.7 (a CH2 row); a CH3 next to C=O is commonly a little lower. Acetone in CDCl3 is reported at 2.17 ppm (Gottlieb et al., J. Org. Chem. 1997, 62, 7512; checked this session)." },
    ],
    couplings: [],
    teacherNote: "One environment, one singlet of area 6: the CH₃ groups are separated from each other by the C=O carbon (no H on it), so there are no vicinal H–H neighbours.",
  },
  {
    id: "ethanol", name: "Ethanol", formula: "C₂H₆O", condensed: "CH₃CH₂OH", aliases: ["C2H5OH", "ethyl alcohol"],
    heavy: [["C1", "C"], ["C2", "C"], ["O1", "O"]], bonds: [["C1", "C2", 1], ["C2", "O1", 1]], root: "C1",
    structural: "    H   H\n    |   |\nH – C – C – O – H\n    |   |\n    H   H",
    environments: [
      { id: "a", label: "CH₂", heavy: ["C2"], delta: 3.7, range: [3.3, 3.7], basis: "booklet", bookletRow: BK.roch2, verified: "3.72 (q) in CDCl3, Gottlieb et al. 1997",
        descriptor: "CH₂ bonded directly to the electronegative oxygen (2 H): deshielded.", note: "R–O–CH2 booklet row 3.3–3.7. Literature (CDCl3) 3.72 ppm, checked this session." },
      { id: "b", label: "OH", heavy: ["O1"], delta: 2.6, range: [1.0, 6.0], basis: "booklet", bookletRow: BK.roh, exchangeable: true, linewidthHz: 12, specValue: true,
        descriptor: "Hydroxyl proton (1 H): exchangeable, variable shift, broad.", note: OH_NOTE, exchangeNote: OH_EXCHANGE },
      { id: "c", label: "CH₃", heavy: ["C1"], delta: 1.2, range: [0.9, 1.3], basis: "reference", bookletRow: BK.ch3, verified: "1.25 (t) in CDCl3, Gottlieb et al. 1997",
        descriptor: "CH₃ (3 H) on the carbon next to the CH₂–O carbon: only slightly deshielded.",
        note: "Slightly above the booklet alkyl CH3 row (0.9–1.0) because the CH3 is β to oxygen. Literature (CDCl3) 1.25 ppm, checked this session." },
    ],
    couplings: [{ a: "c", b: "a", J: DEFAULT_J, type: "³J(H–C–C–H), vicinal", note: J_NOTE }],
    teacherNote: "CH₃ is a triplet (2 neighbouring H on CH₂), CH₂ a quartet (3 neighbouring H on CH₃). The OH is drawn as a broadened singlet and does not split the CH₂ because of exchange (typical conditions).",
  },
  {
    id: "ethyl-ethanoate", name: "Ethyl ethanoate", formula: "C₄H₈O₂", condensed: "CH₃COOCH₂CH₃", aliases: ["ethyl acetate", "C4H8O2"],
    heavy: [["C1", "C"], ["C2", "C"], ["O1", "O"], ["O2", "O"], ["C3", "C"], ["C4", "C"]],
    bonds: [["C1", "C2", 1], ["C2", "O1", 2], ["C2", "O2", 1], ["O2", "C3", 1], ["C3", "C4", 1]], root: "C1",
    torsions: { C3: { ref: "O1", phi: 0 } },
    structural: "    H   O       H   H\n    |   ‖       |   |\nH – C – C – O – C – C – H\n    |           |   |\n    H           H   H",
    environments: [
      { id: "a", label: "OCH₂", heavy: ["C3"], delta: 4.1, range: [3.7, 4.8], basis: "booklet", bookletRow: BK.rcooch2, verified: "4.12 (q) in CDCl3, Gottlieb et al. 1997",
        descriptor: "CH₂ bonded to the ester oxygen (2 H): strongly deshielded.", note: "R–C(=O)–O–CH2 booklet row 3.7–4.8. Literature (CDCl3) 4.12 ppm, checked this session." },
      { id: "b", label: "CH₃CO", heavy: ["C1"], delta: 2.0, range: [2.0, 2.5], basis: "booklet", bookletRow: BK.roco, verified: "2.05 (s) in CDCl3, Gottlieb et al. 1997",
        descriptor: "CH₃ on the carbonyl carbon (3 H): deshielded by C=O, no H on neighbouring atoms.",
        note: "Booklet RO–C(=O)–CH2 row is 2.0–2.5 (a CH2 row; applied to this CH3). Literature (CDCl3) 2.05 ppm, checked this session." },
      { id: "c", label: "CH₃", heavy: ["C4"], delta: 1.2, range: [0.9, 1.3], basis: "reference", bookletRow: BK.ch3, verified: "1.26 (t) in CDCl3, Gottlieb et al. 1997",
        descriptor: "CH₃ of the ethyl group (3 H): next to the OCH₂ carbon.",
        note: "Slightly above the booklet alkyl CH3 row (0.9–1.0): β to the ester oxygen. Literature (CDCl3) 1.26 ppm, checked this session." },
    ],
    couplings: [{ a: "c", b: "a", J: DEFAULT_J, type: "³J(H–C–C–H), vicinal", note: J_NOTE }],
    teacherNote: "The acetyl CH₃ has no H on the neighbouring atoms (carbonyl carbon) so it is a singlet. The ethyl group gives the classic quartet (OCH₂) + triplet (CH₃) pair. Ratio 3 : 2 : 3.",
  },
  {
    id: "propan-1-ol", name: "Propan-1-ol", formula: "C₃H₈O", condensed: "CH₃CH₂CH₂OH", aliases: ["1-propanol", "n-propanol", "C3H7OH"],
    heavy: [["C1", "C"], ["C2", "C"], ["C3", "C"], ["O1", "O"]], bonds: [["C1", "C2", 1], ["C2", "C3", 1], ["C3", "O1", 1]], root: "C1",
    structural: "    H   H   H\n    |   |   |\nH – C – C – C – O – H\n    |   |   |\n    H   H   H",
    environments: [
      { id: "a", label: "OCH₂", heavy: ["C3"], delta: 3.6, range: [3.3, 3.7], basis: "booklet", bookletRow: BK.roch2,
        descriptor: "CH₂ bonded to oxygen (2 H): deshielded.", note: "Inside the booklet R–O–CH2 row (3.3–3.7)." },
      { id: "b", label: "OH", heavy: ["O1"], delta: 2.6, range: [1.0, 6.0], basis: "booklet", bookletRow: BK.roh, exchangeable: true, linewidthHz: 12,
        descriptor: "Hydroxyl proton (1 H): exchangeable, variable shift, broad.", note: OH_NOTE, exchangeNote: OH_EXCHANGE },
      { id: "c", label: "CH₂", heavy: ["C2"], delta: 1.6, range: [1.3, 1.7], basis: "reference", bookletRow: BK.ch2r,
        descriptor: "Middle CH₂ (2 H) between the CH₃ and the CH₂–O group.",
        note: "Typical value for a CH2 β to oxygen; just above the booklet CH2–R row (1.3–1.4). Recalled typical value, not checked against a provided source." },
      { id: "d", label: "CH₃", heavy: ["C1"], delta: 0.9, range: [0.9, 1.0], basis: "booklet", bookletRow: BK.ch3,
        descriptor: "Terminal CH₃ (3 H), far from oxygen: the most shielded signal.", note: "Inside the booklet CH3 row (0.9–1.0)." },
    ],
    couplings: [
      { a: "d", b: "c", J: DEFAULT_J, type: "³J(H–C–C–H), vicinal", note: J_NOTE },
      { a: "c", b: "a", J: DEFAULT_J, type: "³J(H–C–C–H), vicinal", note: J_NOTE },
    ],
    teacherNote: "The middle CH₂ has two DIFFERENT neighbouring sets (3 H of CH₃ and 2 H of OCH₂). The simple n + 1 rule only applies when the neighbours are equivalent; with similar J to both sets the pattern is an apparent sextet (5 + 1 = 6 lines), shown here as a first-order approximation. When the two J values differ it becomes a more complex multiplet (e.g. a quartet of triplets).",
    firstOrderCaveat: { envId: "c", text: "First-order approximation: apparent sextet only because J(CH₃–CH₂) and J(CH₂–OCH₂) are both set to the same value." },
  },
  {
    id: "propan-2-ol", name: "Propan-2-ol", formula: "C₃H₈O", condensed: "(CH₃)₂CHOH", aliases: ["2-propanol", "isopropanol", "isopropyl alcohol", "C3H7OH"],
    heavy: [["C1", "C"], ["C2", "C"], ["C3", "C"], ["O1", "O"]], bonds: [["C1", "C2", 1], ["C2", "C3", 1], ["C2", "O1", 1]], root: "C2",
    structural: "    H   H   H\n    |   |   |\nH – C – C – C – H\n    |   |   |\n    H   O   H\n        |\n        H",
    environments: [
      { id: "a", label: "CH", heavy: ["C2"], delta: 4.0, range: [3.7, 4.2], basis: "reference", bookletRow: null, verified: "4.04 (septet, J = 6 Hz) in CDCl3, Gottlieb et al. 1997",
        descriptor: "The single CH (1 H) bonded to oxygen: deshielded.",
        note: "The booklet has no row for an O–CH methine (R–O–CH2 is 3.3–3.7). Literature (CDCl3) 4.04 ppm, checked this session." },
      { id: "b", label: "OH", heavy: ["O1"], delta: 2.6, range: [1.0, 6.0], basis: "booklet", bookletRow: BK.roh, exchangeable: true, linewidthHz: 12,
        descriptor: "Hydroxyl proton (1 H): exchangeable, variable shift, broad.", note: OH_NOTE, exchangeNote: OH_EXCHANGE },
      { id: "c", label: "CH₃", heavy: ["C1", "C3"], delta: 1.2, range: [0.9, 1.3], basis: "reference", bookletRow: BK.ch3, verified: "1.22 (d, J = 6 Hz) in CDCl3, Gottlieb et al. 1997",
        descriptor: "Two equivalent CH₃ groups (6 H) next to the CH–O carbon.",
        note: "Slightly above the booklet CH3 row (0.9–1.0): β to oxygen. Literature (CDCl3) 1.22 ppm, checked this session." },
    ],
    couplings: [{ a: "c", b: "a", J: 6, type: "³J(H–C–C–H), vicinal", note: "Reported J ≈ 6 Hz for propan-2-ol in CDCl3 (Gottlieb et al. 1997, checked this session); inside the typical 6–8 Hz range." }],
    teacherNote: "CH₃: one neighbouring H -> doublet (6 H). CH: six equivalent neighbouring H -> septet (n + 1 = 7). Ratio 6 : 1 : 1 (CH₃ : CH : OH). The OH is a broadened singlet (exchange).",
  },
  {
    id: "ethanal", name: "Ethanal", formula: "C₂H₄O", condensed: "CH₃CHO", aliases: ["acetaldehyde", "C2H4O"],
    heavy: [["C1", "C"], ["C2", "C"], ["O1", "O"]], bonds: [["C1", "C2", 1], ["C2", "O1", 2]], root: "C1",
    structural: "    H   O\n    |   ‖\nH – C – C – H\n    |\n    H",
    environments: [
      { id: "a", label: "CHO", heavy: ["C2"], delta: 9.8, range: [9.4, 10.0], basis: "booklet", specValue: true, bookletRow: BK.cho,
        descriptor: "Aldehyde H (1 H) on the carbonyl carbon: very strongly deshielded.", note: "Inside the booklet R–C(=O)–H row (9.4–10.0). Specification value about 9.8 ppm." },
      { id: "b", label: "CH₃", heavy: ["C1"], delta: 2.2, range: [2.2, 2.7], basis: "booklet", specValue: true, bookletRow: BK.rco,
        descriptor: "CH₃ (3 H) next to the C=O group: deshielded by the carbonyl.", note: "Booklet R–C(=O)–CH2 row 2.2–2.7 (a CH2 row; applied to this CH3). Specification value about 2.2 ppm." },
    ],
    couplings: [{ a: "a", b: "b", J: 2.9, type: "³J(H–C–C–H), vicinal (aldehyde H – CH₃)",
      note: "The aldehyde–methyl coupling is much smaller than a typical alkyl vicinal coupling (about 3 Hz). Value recalled from the literature for ethanal, not checked against a provided source; treat as representative." }],
    teacherNote: "CHO: 3 neighbouring H -> quartet. CH₃: 1 neighbouring H -> doublet. J is only about 3 Hz here (not the 6–8 Hz of a freely rotating alkyl chain), so the lines are close together.",
  },
];

export const ENV_COLORS = ["#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#4ade80", "#f472b6"];
export const ENV_LETTERS = ["a", "b", "c", "d", "e", "f"];
export const ENV_DASHES = ["", "6 3", "2 3", "8 3 2 3", "10 4", "1 4"]; // non-colour cue for spectrum traces
export const ENV_SHAPES = ["circle", "square", "diamond", "triangle", "hexagon", "star"];

const bondKey = (e1, e2, order) => {
  const [x, y] = [e1, e2].sort();
  return order === 2 ? `${x}=${y}` : `${x}-${y}`;
};

/** Expand one declaration into the full model. Throws on any inconsistency so a bad declaration can never ship silently. */
export function buildMolecule(def) {
  const heavyIdx = new Map();
  const atoms = def.heavy.map(([key, el], i) => { heavyIdx.set(key, i); return { idx: i, key, el, hydrogens: [], neighbours: [], isHydrogen: false }; });
  const bonds = [];
  for (const [ka, kb, order] of def.bonds) {
    const a = heavyIdx.get(ka); const b = heavyIdx.get(kb);
    if (a === undefined || b === undefined) throw new Error(`${def.id}: unknown atom in bond ${ka}-${kb}`);
    bonds.push({ a, b, order, key: bondKey(atoms[a].el, atoms[b].el, order) });
  }
  const used = new Array(atoms.length).fill(0);
  for (const b of bonds) { used[b.a] += b.order; used[b.b] += b.order; }
  let hn = 0;
  const nHeavy = atoms.length;
  for (let i = 0; i < nHeavy; i += 1) {
    const nH = ATOMIC[atoms[i].el].valence - used[i];
    if (nH < 0) throw new Error(`${def.id}: valence exceeded on ${atoms[i].key}`);
    for (let k = 0; k < nH; k += 1) {
      hn += 1; const idx = atoms.length;
      atoms.push({ idx, key: `H${hn}`, el: "H", parent: i, isHydrogen: true, hydrogens: [], neighbours: [] });
      atoms[i].hydrogens.push(idx);
      bonds.push({ a: i, b: idx, order: 1, key: bondKey(atoms[i].el, "H", 1) });
    }
  }
  for (const b of bonds) { atoms[b.a].neighbours.push(b.b); atoms[b.b].neighbours.push(b.a); }
  const environments = def.environments.map((e, i) => {
    const hs = [];
    for (const k of e.heavy) { const hi = heavyIdx.get(k); if (hi === undefined) throw new Error(`${def.id}: env ${e.id} unknown atom ${k}`); hs.push(...atoms[hi].hydrogens); }
    hs.sort((x, y) => x - y);
    return {
      ...e, index: i, atoms: hs, count: hs.length, color: ENV_COLORS[i % ENV_COLORS.length], letter: ENV_LETTERS[i % ENV_LETTERS.length],
      dash: ENV_DASHES[i % ENV_DASHES.length], shape: ENV_SHAPES[i % ENV_SHAPES.length], representative: true,
      exchangeable: Boolean(e.exchangeable), linewidthHz: e.linewidthHz ?? null,
      heavyAtoms: e.heavy.map((k) => heavyIdx.get(k)),
    };
  });
  const envOfAtom = new Array(atoms.length).fill(null);
  for (const e of environments) for (const h of e.atoms) envOfAtom[h] = e.id;
  const covered = atoms.filter((a) => a.isHydrogen).every((a) => envOfAtom[a.idx]);
  if (!covered) throw new Error(`${def.id}: a hydrogen belongs to no declared environment`);
  for (const a of atoms) if (a.isHydrogen) { /* ok */ } else if (a.hydrogens.length) a.env = envOfAtom[a.hydrogens[0]];
  return {
    id: def.id, name: def.name, formula: def.formula, condensed: def.condensed, aliases: def.aliases ?? [], structural: def.structural,
    atoms, bonds, environments, envOfAtom, root: heavyIdx.get(def.root), rootKey: def.root, torsionDefs: def.torsions ?? {},
    heavyIndexByKey: Object.fromEntries(heavyIdx),
    couplings: def.couplings.map((c) => ({ ...c })), teacherNote: def.teacherNote, firstOrderCaveat: def.firstOrderCaveat ?? null,
    declaredHeavyKeys: def.heavy.map(([k]) => k),
  };
}

export const MOLECULES = DEFS.map(buildMolecule);
export const MOLECULE_BY_ID = Object.fromEntries(MOLECULES.map((m) => [m.id, m]));
export const DEFAULT_MOLECULE_ID = "ethanol";
export const getMolecule = (id) => MOLECULE_BY_ID[id] ?? MOLECULE_BY_ID[DEFAULT_MOLECULE_ID];
export const getEnvironment = (mol, envId) => mol.environments.find((e) => e.id === envId) ?? null;
export const totalHydrogens = (mol) => mol.atoms.filter((a) => a.isHydrogen).length;
export const hydrogenIndices = (mol) => mol.atoms.filter((a) => a.isHydrogen).map((a) => a.idx);

export function moleculeFormulaCounts(mol) {
  const c = {}; for (const a of mol.atoms) c[a.el] = (c[a.el] ?? 0) + 1; return c;
}

/** Search used by the molecule picker: name, formula, condensed formula and aliases (case/space-insensitive). */
export function searchMolecules(query) {
  const q = String(query ?? "").toLowerCase().replace(/[\s_]+/g, "").replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  if (!q) return MOLECULES;
  const norm = (s) => s.toLowerCase().replace(/[\s_]+/g, "").replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  return MOLECULES.filter((m) => [m.name, m.formula, m.condensed, ...m.aliases].some((s) => norm(s).includes(q)));
}
