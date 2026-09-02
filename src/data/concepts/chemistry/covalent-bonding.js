// Layer 1 — core concepts for the "covalent-bonding" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const covalentBondingConcepts = [
  {
    id: "lewis-structures",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Lewis Structures",
    description: "Diagrams showing how valence electrons are shared or arranged between bonded atoms.",
    relatedConcepts: ["bond-order","vsepr-theory"],
  },
  {
    id: "bond-order",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Bond Order",
    description: "The number of shared electron pairs between two atoms, and its effect on bond length and strength.",
    relatedConcepts: ["lewis-structures","resonance"],
  },
  {
    id: "resonance",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Resonance",
    description: "Delocalization of electrons represented by averaging two or more valid Lewis structures.",
    relatedConcepts: ["bond-order","lewis-structures"],
  },
  {
    id: "vsepr-theory",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "VSEPR Theory",
    description: "Predicting molecular shape from the repulsion between electron domains around a central atom.",
    relatedConcepts: ["lewis-structures","molecular-geometry"],
  },
  {
    id: "molecular-geometry",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Molecular Geometry",
    description: "The three-dimensional shape of a molecule and how it arises from electron domain arrangement.",
    relatedConcepts: ["vsepr-theory","molecular-polarity"],
  },
  {
    id: "electronegativity",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Electronegativity",
    description: "An atom's tendency to attract shared electrons in a covalent bond.",
    relatedConcepts: ["bond-polarity","periodic-trends-electronegativity"],
  },
  {
    id: "bond-polarity",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Bond Polarity",
    description: "Unequal sharing of electrons between atoms of different electronegativity.",
    relatedConcepts: ["electronegativity","molecular-polarity"],
  },
  {
    id: "molecular-polarity",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Molecular Polarity",
    description: "Whether individual bond dipoles cancel or combine to give a molecule an overall dipole.",
    relatedConcepts: ["bond-polarity","molecular-geometry","intermolecular-forces"],
  },
  {
    id: "covalent-network-structures",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Covalent Network Structures",
    description: "Giant covalent lattices where every atom is linked by strong covalent bonds.",
    relatedConcepts: ["physical-properties-of-covalent-substances"],
  },
  {
    id: "intermolecular-forces",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Intermolecular Forces",
    description: "Attractive forces between molecules that determine boiling point, solubility and other physical properties.",
    relatedConcepts: ["molecular-polarity","physical-properties-of-covalent-substances"],
  },
  {
    id: "physical-properties-of-covalent-substances",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Physical Properties of Covalent Substances",
    description: "How bonding and intermolecular forces together explain melting point, volatility and conductivity.",
    relatedConcepts: ["intermolecular-forces","covalent-network-structures"],
  },
  {
    id: "hybridization",
    subject: "chemistry",
    domain: "covalent-bonding",
    title: "Hybridization",
    description: "Mixing of atomic orbitals to form new orbitals suited to a molecule's observed geometry.",
    relatedConcepts: ["molecular-geometry","vsepr-theory"],
  },
];

export default covalentBondingConcepts;
