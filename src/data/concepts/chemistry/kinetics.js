// Layer 1 — core concepts for the "kinetics" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const kineticsConcepts = [
  {
    id: "collision-theory",
    subject: "chemistry",
    domain: "kinetics",
    title: "Collision Theory",
    description: "Reactions occur when particles collide with sufficient energy and correct orientation.",
    relatedConcepts: ["activation-energy","factors-affecting-rate"],
  },
  {
    id: "factors-affecting-rate",
    subject: "chemistry",
    domain: "kinetics",
    title: "Factors Affecting Rate",
    description: "How concentration, temperature, surface area and catalysts influence reaction rate.",
    relatedConcepts: ["collision-theory","catalysis"],
  },
  {
    id: "rate-expressions",
    subject: "chemistry",
    domain: "kinetics",
    title: "Rate Expressions",
    description: "Mathematical relationships between reactant concentration and reaction rate.",
    relatedConcepts: ["factors-affecting-rate"],
  },
  {
    id: "activation-energy",
    subject: "chemistry",
    domain: "kinetics",
    title: "Activation Energy",
    description: "The minimum energy colliding particles need for a reaction to occur.",
    relatedConcepts: ["collision-theory","catalysis"],
  },
  {
    id: "catalysis",
    subject: "chemistry",
    domain: "kinetics",
    title: "Catalysis",
    description: "How catalysts speed up reactions by providing an alternative, lower-energy pathway.",
    relatedConcepts: ["activation-energy","reaction-mechanisms-and-rate"],
  },
  {
    id: "reaction-mechanisms-and-rate",
    subject: "chemistry",
    domain: "kinetics",
    title: "Reaction Mechanisms and Rate",
    description: "How a multi-step mechanism's slowest step governs the overall reaction rate.",
    relatedConcepts: ["catalysis","rate-expressions"],
  },
];

export default kineticsConcepts;
