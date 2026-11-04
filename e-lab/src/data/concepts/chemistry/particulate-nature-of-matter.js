// Layer 1 — core concepts for the "particulate-nature-of-matter" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const particulateNatureOfMatterConcepts = [
  {
    id: "states-of-matter",
    subject: "chemistry",
    domain: "particulate-nature-of-matter",
    title: "States of Matter",
    description: "How particle arrangement and energy distinguish solids, liquids and gases.",
    relatedConcepts: ["kinetic-molecular-theory"],
  },
  {
    id: "kinetic-molecular-theory",
    subject: "chemistry",
    domain: "particulate-nature-of-matter",
    title: "Kinetic Molecular Theory",
    description: "A model explaining bulk properties of matter in terms of constantly moving particles.",
    relatedConcepts: ["states-of-matter","gas-laws"],
  },
  {
    id: "physical-vs-chemical-change",
    subject: "chemistry",
    domain: "particulate-nature-of-matter",
    title: "Physical vs Chemical Change",
    description: "Distinguishing changes that alter arrangement of particles from changes that form new substances.",
    relatedConcepts: [],
  },
  {
    id: "pure-substances-and-mixtures",
    subject: "chemistry",
    domain: "particulate-nature-of-matter",
    title: "Pure Substances and Mixtures",
    description: "Classifying matter by composition and the particle-level difference between mixtures and pure substances.",
    relatedConcepts: ["separation-techniques"],
  },
  {
    id: "separation-techniques",
    subject: "chemistry",
    domain: "particulate-nature-of-matter",
    title: "Separation Techniques",
    description: "Physical methods for separating mixtures based on differences in particle properties.",
    relatedConcepts: ["pure-substances-and-mixtures"],
  },
];

export default particulateNatureOfMatterConcepts;
