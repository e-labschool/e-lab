// Layer 1 — core concepts for the "gases" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const gasesConcepts = [
  {
    id: "gas-laws",
    subject: "chemistry",
    domain: "gases",
    title: "Gas Laws",
    description: "Relationships between pressure, volume, temperature and amount for a gas.",
    relatedConcepts: ["kinetic-molecular-theory","ideal-gas-equation"],
  },
  {
    id: "ideal-gas-equation",
    subject: "chemistry",
    domain: "gases",
    title: "Ideal Gas Equation",
    description: "A single equation combining the gas laws to relate pressure, volume, temperature and moles.",
    relatedConcepts: ["gas-laws","real-gas-deviations"],
  },
  {
    id: "real-gas-deviations",
    subject: "chemistry",
    domain: "gases",
    title: "Real Gas Deviations",
    description: "Conditions under which real gases depart from ideal behaviour.",
    relatedConcepts: ["ideal-gas-equation"],
  },
];

export default gasesConcepts;
