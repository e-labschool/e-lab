// Layer 1 — core concepts for the "ionic-bonding" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const ionicBondingConcepts = [
  {
    id: "ion-formation",
    subject: "chemistry",
    domain: "ionic-bonding",
    title: "Ion Formation",
    description: "How atoms gain or lose electrons to achieve a more stable electron configuration.",
    relatedConcepts: ["ion-electron-configuration","ionic-bonding"],
  },
  {
    id: "ionic-bonding",
    subject: "chemistry",
    domain: "ionic-bonding",
    title: "Ionic Bonding",
    description: "Electrostatic attraction between oppositely charged ions in a compound.",
    relatedConcepts: ["ion-formation","ionic-lattice-structure"],
  },
  {
    id: "ionic-lattice-structure",
    subject: "chemistry",
    domain: "ionic-bonding",
    title: "Ionic Lattice Structure",
    description: "The regular, extended arrangement of ions in an ionic solid.",
    relatedConcepts: ["ionic-bonding","properties-of-ionic-compounds"],
  },
  {
    id: "properties-of-ionic-compounds",
    subject: "chemistry",
    domain: "ionic-bonding",
    title: "Properties of Ionic Compounds",
    description: "How lattice structure explains melting point, conductivity and solubility trends.",
    relatedConcepts: ["ionic-lattice-structure"],
  },
];

export default ionicBondingConcepts;
