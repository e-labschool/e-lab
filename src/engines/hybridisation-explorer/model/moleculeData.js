// Molecule Explorer data: PURE DATA describing each molecule's atoms (element, state, which orbitals mix), its bonds as pairs of
// named orbitals, the expected sigma / pi totals and the step-by-step explanation. Geometry (positions, orientations, hybrid
// directions, bond distances) is COMPUTED from this by moleculeLayout.js; nothing here is a coordinate.
//
// Orbital references: "h<i>" = the i-th hybrid of the atom (0-based, in the order the hybrids are generated), otherwise an atomic
// orbital id such as "2pz" or "1s". In an atom that is hybridised, electrons fill the hybrids singly first and pairs form from
// hybrid 0 upwards, so lone pairs sit in the LOWEST-index hybrids and bonds use the higher ones.
//
// Step fields: add (atoms shown from this step), hybridise (atoms whose atomic orbitals mix this step), form (bond ids formed this
// step), focus (atom shown in the optional energy-level diagram), emphasise (orbital refs to highlight), ring (benzene's
// delocalised pi region). Everything else (cumulative visibility, approach motion, sigma/pi counts) is derived.

const S = (text, o = {}) => ({ text, ...o });

export const MOLECULES = [
  {
    id: "H2", plain: "H2", latex: "H_{2}", name: "Hydrogen", expected: { sigma: 1, pi: 0 },
    atoms: { H1: { el: "H" }, H2: { el: "H" } }, root: "H1", rootDir: [1, 0, 0],
    bonds: [{ id: "HH", type: "sigma", a: ["H1", "1s"], b: ["H2", "1s"] }],
    steps: [
      S("Each hydrogen atom has one electron in a spherical 1s orbital.", { add: ["H1", "H2"], focus: "H1" }),
      S("The two 1s orbitals overlap end-on between the nuclei and their electrons pair: a σ (1s–1s) bond.", { form: ["HH"] }),
      S("H₂ has 1 σ bond and no π bonds.", { emphasise: [] }),
    ],
  },
  {
    id: "HF", plain: "HF", latex: "HF", name: "Hydrogen fluoride", expected: { sigma: 1, pi: 0 }, note: "Qualitative model: only the F 2pz orbital that points along the bond is shown overlapping; fluorine's other electrons are three lone pairs in 2s, 2px and 2py.",
    atoms: { F1: { el: "F" }, H1: { el: "H" } }, root: "F1",
    bonds: [{ id: "HF", type: "sigma", a: ["F1", "2pz"], b: ["H1", "1s"] }],
    steps: [
      S("Fluorine (2s² 2px² 2py² 2pz¹) has one unpaired electron, in 2pz; hydrogen has one in 1s.", { add: ["F1", "H1"], focus: "F1" }),
      S("The H 1s orbital overlaps end-on with the F 2pz orbital, which points along the bond axis: a σ (1s–2pz) bond.", { form: ["HF"] }),
      S("HF has 1 σ bond and no π bonds; the other F orbitals hold lone pairs (qualitative model).", {}),
    ],
  },
  {
    id: "CH4", plain: "CH4", latex: "CH_{4}", name: "Methane", expected: { sigma: 4, pi: 0 },
    atoms: { C1: { el: "C", kind: "excited", mix: ["2s", "2px", "2py", "2pz"] }, H1: { el: "H" }, H2: { el: "H" }, H3: { el: "H" }, H4: { el: "H" } }, root: "C1",
    bonds: [0, 1, 2, 3].map((i) => ({ id: `CH${i + 1}`, type: "sigma", a: ["C1", `h${i}`], b: [`H${i + 1}`, "1s"] })),
    steps: [
      S("Carbon 2s² 2p² → 2s¹ 2p³ (illustrative promotion), then 2s + 2px + 2py + 2pz mix to give four sp³ hybrid orbitals.", { add: ["C1"], hybridise: ["C1"], focus: "C1" }),
      S("The four sp³ hybrids point to the corners of a tetrahedron (109.5° apart); none of the 2p orbitals remains.", { emphasise: ["C1:*"] }),
      S("Each H 1s orbital overlaps end-on with an sp³ hybrid: four σ (sp³–1s) bonds.", { add: ["H1", "H2", "H3", "H4"], form: ["CH1", "CH2", "CH3", "CH4"] }),
      S("CH₄ has 4 σ bonds and no π bonds.", {}),
    ],
  },
  {
    id: "NH3", plain: "NH3", latex: "NH_{3}", name: "Ammonia", expected: { sigma: 3, pi: 0 }, note: "Simplified model: ideal sp³ angles are 109.5°; the real H–N–H angle is about 107° because the lone pair repels more strongly.",
    atoms: { N1: { el: "N", mix: ["2s", "2px", "2py", "2pz"] }, H1: { el: "H" }, H2: { el: "H" }, H3: { el: "H" } }, root: "N1",
    bonds: [1, 2, 3].map((i) => ({ id: `NH${i}`, type: "sigma", a: ["N1", `h${i}`], b: [`H${i}`, "1s"] })),
    steps: [
      S("Nitrogen (2s² 2p³, no promotion needed) mixes 2s + 2px + 2py + 2pz into four sp³ hybrid orbitals holding five electrons.", { add: ["N1"], hybridise: ["N1"], focus: "N1" }),
      S("One sp³ hybrid holds the lone pair; the other three each hold one unpaired electron.", { emphasise: ["N1:h0"] }),
      S("Three H 1s orbitals overlap with the singly occupied sp³ hybrids: three σ (sp³–1s) bonds.", { add: ["H1", "H2", "H3"], form: ["NH1", "NH2", "NH3"] }),
      S("NH₃ has 3 σ bonds, 0 π bonds and 1 lone pair (simplified model).", {}),
    ],
  },
  {
    id: "H2O", plain: "H2O", latex: "H_{2}O", name: "Water", expected: { sigma: 2, pi: 0 }, note: "Simplified model: ideal sp³ angles are 109.5°; the real H–O–H angle is about 104.5° because of the two lone pairs.",
    atoms: { O1: { el: "O", mix: ["2s", "2px", "2py", "2pz"] }, H1: { el: "H" }, H2: { el: "H" } }, root: "O1",
    bonds: [2, 3].map((i) => ({ id: `OH${i - 1}`, type: "sigma", a: ["O1", `h${i}`], b: [`H${i - 1}`, "1s"] })),
    steps: [
      S("Oxygen (2s² 2p⁴, no promotion needed) mixes 2s + 2px + 2py + 2pz into four sp³ hybrid orbitals holding six electrons.", { add: ["O1"], hybridise: ["O1"], focus: "O1" }),
      S("Two sp³ hybrids hold lone pairs; the other two each hold one unpaired electron.", { emphasise: ["O1:h0", "O1:h1"] }),
      S("Two H 1s orbitals overlap with the singly occupied sp³ hybrids: two σ (sp³–1s) bonds.", { add: ["H1", "H2"], form: ["OH1", "OH2"] }),
      S("H₂O has 2 σ bonds, 0 π bonds and 2 lone pairs (simplified model).", {}),
    ],
  },
  {
    id: "C2H6", plain: "C2H6", latex: "C_{2}H_{6}", name: "Ethane", expected: { sigma: 7, pi: 0 },
    atoms: { C1: { el: "C", kind: "excited", mix: ["2s", "2px", "2py", "2pz"] }, C2: { el: "C", kind: "excited", mix: ["2s", "2px", "2py", "2pz"] }, ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`H${i}`, { el: "H" }])) }, root: "C1",
    bonds: [
      { id: "CC", type: "sigma", a: ["C1", "h0"], b: ["C2", "h0"], staggered: true },
      ...[1, 2, 3].map((i) => ({ id: `C1H${i}`, type: "sigma", a: ["C1", `h${i}`], b: [`H${i}`, "1s"] })),
      ...[1, 2, 3].map((i) => ({ id: `C2H${i}`, type: "sigma", a: ["C2", `h${i}`], b: [`H${i + 3}`, "1s"] })),
    ],
    steps: [
      S("Each carbon is promoted to 2s¹ 2p³ (illustrative) and its 2s + three 2p orbitals mix into four sp³ hybrids.", { add: ["C1", "C2"], hybridise: ["C1", "C2"], focus: "C1" }),
      S("The two carbons approach and one sp³ hybrid from each overlaps end-on: the C–C σ (sp³–sp³) bond.", { form: ["CC"] }),
      S("Six H 1s orbitals overlap with the remaining sp³ hybrids: six C–H σ (sp³–1s) bonds.", { add: ["H1", "H2", "H3", "H4", "H5", "H6"], form: ["C1H1", "C1H2", "C1H3", "C2H1", "C2H2", "C2H3"] }),
      S("C₂H₆ has 7 σ bonds (1 C–C + 6 C–H) and no π bonds.", {}),
    ],
  },
  {
    id: "C2H4", plain: "C2H4", latex: "C_{2}H_{4}", name: "Ethene", expected: { sigma: 5, pi: 1 },
    atoms: { C1: { el: "C", kind: "excited", mix: ["2s", "2px", "2py"] }, C2: { el: "C", kind: "excited", mix: ["2s", "2px", "2py"] }, ...Object.fromEntries([1, 2, 3, 4].map((i) => [`H${i}`, { el: "H" }])) }, root: "C1",
    bonds: [
      { id: "CC-sigma", type: "sigma", a: ["C1", "h0"], b: ["C2", "h0"] },
      { id: "CC-pi", type: "pi", a: ["C1", "2pz"], b: ["C2", "2pz"] },
      ...[1, 2].map((i) => ({ id: `C1H${i}`, type: "sigma", a: ["C1", `h${i}`], b: [`H${i}`, "1s"] })),
      ...[1, 2].map((i) => ({ id: `C2H${i}`, type: "sigma", a: ["C2", `h${i}`], b: [`H${i + 2}`, "1s"] })),
    ],
    steps: [
      S("Each carbon: 2s² 2p² → 2s¹ 2p³ (illustrative promotion); 2s + 2px + 2py mix to give the sp² hybridisation model.", { add: ["C1", "C2"], hybridise: ["C1", "C2"], focus: "C1" }),
      S("Each carbon now has three sp² hybrid orbitals (120° apart, in one plane) and one unhybridised 2pz perpendicular to that plane.", { emphasise: ["C1:*", "C2:*"] }),
      S("The carbons approach and sp² hybrids overlap end-on along the C–C axis: the C–C σ (sp²–sp²) bond.", { form: ["CC-sigma"] }),
      S("The parallel 2pz orbitals overlap sideways, above and below the bond axis: the C–C π (2pz–2pz) bond.", { form: ["CC-pi"] }),
      S("Four H 1s orbitals overlap end-on with the remaining sp² hybrids: four C–H σ (sp²–1s) bonds.", { add: ["H1", "H2", "H3", "H4"], form: ["C1H1", "C1H2", "C2H1", "C2H2"] }),
      S("Complete C₂H₄: 5 σ bonds and 1 π bond (the C=C double bond is one σ plus one π).", {}),
    ],
  },
  {
    id: "C2H2", plain: "C2H2", latex: "C_{2}H_{2}", name: "Ethyne", expected: { sigma: 3, pi: 2 },
    atoms: { C1: { el: "C", kind: "excited", mix: ["2s", "2px"] }, C2: { el: "C", kind: "excited", mix: ["2s", "2px"] }, H1: { el: "H" }, H2: { el: "H" } }, root: "C1",
    bonds: [
      { id: "CC-sigma", type: "sigma", a: ["C1", "h0"], b: ["C2", "h1"] }, // C2's -x lobe faces C1: both p pairs then have equal phase orientation
      { id: "CC-pi-y", type: "pi", a: ["C1", "2py"], b: ["C2", "2py"] },
      { id: "CC-pi-z", type: "pi", a: ["C1", "2pz"], b: ["C2", "2pz"] },
      { id: "C1H", type: "sigma", a: ["C1", "h1"], b: ["H1", "1s"] },
      { id: "C2H", type: "sigma", a: ["C2", "h0"], b: ["H2", "1s"] },
    ],
    steps: [
      S("Each carbon: 2s² 2p² → 2s¹ 2p³ (illustrative promotion); 2s + 2px mix to give two sp hybrid orbitals at 180°.", { add: ["C1", "C2"], hybridise: ["C1", "C2"], focus: "C1" }),
      S("Each carbon keeps two unhybridised orbitals, 2py and 2pz, perpendicular to each other and to the sp axis.", { emphasise: ["C1:2py", "C1:2pz", "C2:2py", "C2:2pz"] }),
      S("One sp hybrid from each carbon overlaps end-on along the axis: the C–C σ (sp–sp) bond.", { form: ["CC-sigma"] }),
      S("The parallel 2py orbitals overlap sideways: the first C–C π (2py–2py) bond.", { form: ["CC-pi-y"] }),
      S("The parallel 2pz orbitals overlap sideways, perpendicular to the first π bond: the second π (2pz–2pz) bond.", { form: ["CC-pi-z"] }),
      S("Each remaining sp hybrid overlaps with an H 1s orbital: two C–H σ (sp–1s) bonds.", { add: ["H1", "H2"], form: ["C1H", "C2H"] }),
      S("Complete C₂H₂: 3 σ bonds and 2 π bonds (the C≡C triple bond is one σ plus two π).", {}),
    ],
  },
  {
    id: "H2CO", plain: "H2CO", latex: "H_{2}CO", name: "Methanal (formaldehyde)", expected: { sigma: 3, pi: 1 }, note: "Simplified model: oxygen is treated as sp² with two lone pairs in sp² hybrids.",
    atoms: { C1: { el: "C", kind: "excited", mix: ["2s", "2px", "2py"] }, O1: { el: "O", mix: ["2s", "2px", "2py"] }, H1: { el: "H" }, H2: { el: "H" } }, root: "C1",
    bonds: [
      { id: "CO-sigma", type: "sigma", a: ["C1", "h0"], b: ["O1", "h2"] },
      { id: "CO-pi", type: "pi", a: ["C1", "2pz"], b: ["O1", "2pz"] },
      { id: "CH1", type: "sigma", a: ["C1", "h1"], b: ["H1", "1s"] },
      { id: "CH2", type: "sigma", a: ["C1", "h2"], b: ["H2", "1s"] },
    ],
    steps: [
      S("Carbon (promoted to 2s¹ 2p³, illustrative) and oxygen both use 2s + 2px + 2py to form three sp² hybrids, leaving a 2pz each.", { add: ["C1", "O1"], hybridise: ["C1", "O1"], focus: "C1" }),
      S("Oxygen's sp² hybrids hold two lone pairs and one unpaired electron; its 2pz holds the other unpaired electron (simplified model).", { emphasise: ["O1:h0", "O1:h1", "O1:2pz"], focus: "O1" }),
      S("An sp² hybrid of each atom overlaps end-on: the C–O σ (sp²–sp²) bond.", { form: ["CO-sigma"] }),
      S("The parallel 2pz orbitals overlap sideways: the C–O π (2pz–2pz) bond.", { form: ["CO-pi"] }),
      S("Two H 1s orbitals overlap with the remaining carbon sp² hybrids: two C–H σ (sp²–1s) bonds.", { add: ["H1", "H2"], form: ["CH1", "CH2"] }),
      S("Complete H₂CO: 3 σ bonds and 1 π bond (C=O is one σ plus one π).", {}),
    ],
  },
  {
    id: "CO2", plain: "CO2", latex: "CO_{2}", name: "Carbon dioxide", expected: { sigma: 2, pi: 2 }, note: "Simplified textbook model: carbon is sp, each oxygen is sp² with two lone pairs; the two π systems are perpendicular (C 2pz–O 2pz, C 2py–O 2pz of the second oxygen).",
    atoms: { C1: { el: "C", kind: "excited", mix: ["2s", "2px"] }, O1: { el: "O", mix: ["2s", "2px", "2py"] }, O2: { el: "O", mix: ["2s", "2px", "2py"] } }, root: "C1",
    bonds: [
      { id: "CO1-sigma", type: "sigma", a: ["C1", "h0"], b: ["O1", "h2"] },
      { id: "CO2-sigma", type: "sigma", a: ["C1", "h1"], b: ["O2", "h2"] },
      { id: "CO1-pi", type: "pi", a: ["C1", "2pz"], b: ["O1", "2pz"] },
      { id: "CO2-pi", type: "pi", a: ["C1", "2py"], b: ["O2", "2pz"] },
    ],
    steps: [
      S("Carbon (promoted to 2s¹ 2p³, illustrative) mixes 2s + 2px into two sp hybrids; each oxygen mixes 2s + 2px + 2py into three sp² hybrids.", { add: ["C1", "O1", "O2"], hybridise: ["C1", "O1", "O2"], focus: "C1" }),
      S("Carbon keeps 2py and 2pz; each oxygen keeps one 2pz and holds two lone pairs in its sp² hybrids (simplified model).", { emphasise: ["C1:2py", "C1:2pz", "O1:2pz", "O2:2pz"] }),
      S("Each C sp hybrid overlaps end-on with an O sp² hybrid: two σ (sp–sp²) bonds in a line.", { form: ["CO1-sigma", "CO2-sigma"] }),
      S("Carbon's 2pz overlaps sideways with the first oxygen's 2pz: the first π bond.", { form: ["CO1-pi"] }),
      S("Carbon's 2py overlaps sideways with the second oxygen's p orbital, perpendicular to the first π bond: the second π bond.", { form: ["CO2-pi"] }),
      S("Complete CO₂: 2 σ and 2 π bonds; each C=O is one σ plus one π, and the two π systems are perpendicular.", {}),
    ],
  },
  {
    id: "C6H6", plain: "C6H6", latex: "C_{6}H_{6}", name: "Benzene", expected: { sigma: 12, pi: 0, delocalisedPi: { orbitals: 6, electrons: 6 } },
    ring: ["C1", "C2", "C3", "C4", "C5", "C6"], note: "The six 2pz electrons are delocalised over the whole ring; benzene is not drawn as alternating localised double bonds.",
    atoms: { ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`C${i}`, { el: "C", kind: "excited", mix: ["2s", "2px", "2py"] }])), ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`H${i}`, { el: "H" }])) }, root: "C1",
    bonds: [
      ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `CC${i}`, type: "sigma", a: [`C${i}`, "h1"], b: [`C${(i % 6) + 1}`, "h2"] })),
      ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `CH${i}`, type: "sigma", a: [`C${i}`, "h0"], b: [`H${i}`, "1s"] })),
    ],
    steps: [
      S("Each carbon: 2s² 2p² → 2s¹ 2p³ (illustrative promotion); 2s + 2px + 2py mix into three sp² hybrids, leaving a 2pz perpendicular to the ring plane.", { add: ["C1", "C2", "C3", "C4", "C5", "C6"], hybridise: ["C1", "C2", "C3", "C4", "C5", "C6"], focus: "C1" }),
      S("Neighbouring carbons overlap sp² hybrids end-on, forming the ring of six C–C σ (sp²–sp²) bonds.", { form: ["CC1", "CC2", "CC3", "CC4", "CC5", "CC6"] }),
      S("Six H 1s orbitals overlap with the outward sp² hybrids: six C–H σ (sp²–1s) bonds, so the σ framework has 12 σ bonds.", { add: ["H1", "H2", "H3", "H4", "H5", "H6"], form: ["CH1", "CH2", "CH3", "CH4", "CH5", "CH6"] }),
      S("The six parallel 2pz orbitals, one per carbon, stand perpendicular to the ring plane.", { emphasise: ["*:2pz"] }),
      S("They overlap continuously around the ring: one delocalised π system of six electrons, above and below the plane (not alternating double bonds).", { ring: true }),
      S("Complete C₆H₆: 12 σ bonds plus one delocalised π system (6 electrons over 6 carbons).", { ring: true }),
    ],
  },
];
export const MOLECULE_BY_ID = Object.fromEntries(MOLECULES.map((m) => [m.id, m]));
export const MOLECULE_IDS = MOLECULES.map((m) => m.id);
