// Layer 1 — core concepts for the "materials" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const materialsConcepts = [
  {
    id: "bonding-continuum",
    subject: "chemistry",
    domain: "materials",
    title: "Bonding Continuum",
    description: "How ionic, covalent and metallic bonding represent idealized ends of a continuous spectrum.",
    relatedConcepts: ["ionic-bonding","covalent-network-structures","metallic-bonding"],
  },
  {
    id: "material-properties-from-bonding",
    subject: "chemistry",
    domain: "materials",
    title: "Material Properties from Bonding",
    description: "Predicting a material's macroscopic behaviour from its underlying bonding and structure.",
    relatedConcepts: ["bonding-continuum"],
  },
];

export default materialsConcepts;
