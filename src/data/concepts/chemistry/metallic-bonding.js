// Layer 1 — core concepts for the "metallic-bonding" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const metallicBondingConcepts = [
  {
    id: "metallic-bonding",
    subject: "chemistry",
    domain: "metallic-bonding",
    title: "Metallic Bonding",
    description: "Attraction between a lattice of metal cations and a sea of delocalized electrons.",
    relatedConcepts: ["properties-of-metals"],
  },
  {
    id: "alloys",
    subject: "chemistry",
    domain: "metallic-bonding",
    title: "Alloys",
    description: "Mixtures of metals (or metals with other elements) engineered for particular properties.",
    relatedConcepts: ["metallic-bonding","properties-of-metals"],
  },
  {
    id: "properties-of-metals",
    subject: "chemistry",
    domain: "metallic-bonding",
    title: "Properties of Metals",
    description: "How delocalized electrons explain conductivity, malleability and other metallic properties.",
    relatedConcepts: ["metallic-bonding"],
  },
];

export default metallicBondingConcepts;
