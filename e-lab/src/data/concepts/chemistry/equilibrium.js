// Layer 1 — core concepts for the "equilibrium" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const equilibriumConcepts = [
  {
    id: "dynamic-equilibrium",
    subject: "chemistry",
    domain: "equilibrium",
    title: "Dynamic Equilibrium",
    description: "A state where forward and reverse reaction rates are equal, so concentrations stay constant.",
    relatedConcepts: ["equilibrium-constant"],
  },
  {
    id: "equilibrium-constant",
    subject: "chemistry",
    domain: "equilibrium",
    title: "Equilibrium Constant",
    description: "A value expressing the position of equilibrium in terms of product and reactant concentrations.",
    relatedConcepts: ["dynamic-equilibrium","equilibrium-calculations"],
  },
  {
    id: "le-chateliers-principle",
    subject: "chemistry",
    domain: "equilibrium",
    title: "Le Chatelier's Principle",
    description: "Predicting how an equilibrium shifts in response to a change in conditions.",
    relatedConcepts: ["dynamic-equilibrium","equilibrium-calculations"],
  },
  {
    id: "equilibrium-calculations",
    subject: "chemistry",
    domain: "equilibrium",
    title: "Equilibrium Calculations",
    description: "Using the equilibrium constant to calculate unknown concentrations at equilibrium.",
    relatedConcepts: ["equilibrium-constant","le-chateliers-principle"],
  },
];

export default equilibriumConcepts;
