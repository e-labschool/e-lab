// Layer 1 — core concepts for the "redox" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const redoxConcepts = [
  {
    id: "oxidation-states",
    subject: "chemistry",
    domain: "redox",
    title: "Oxidation States",
    description: "A bookkeeping system for tracking electron transfer in reactions.",
    relatedConcepts: ["redox-half-equations"],
  },
  {
    id: "redox-half-equations",
    subject: "chemistry",
    domain: "redox",
    title: "Redox Half-Equations",
    description: "Splitting a redox reaction into separate oxidation and reduction processes.",
    relatedConcepts: ["oxidation-states","electrochemical-cells"],
  },
  {
    id: "electrochemical-cells",
    subject: "chemistry",
    domain: "redox",
    title: "Electrochemical Cells",
    description: "Using spontaneous redox reactions to generate an electric current.",
    relatedConcepts: ["redox-half-equations","electrolysis"],
  },
  {
    id: "electrolysis",
    subject: "chemistry",
    domain: "redox",
    title: "Electrolysis",
    description: "Using electrical energy to drive a non-spontaneous redox reaction.",
    relatedConcepts: ["electrochemical-cells"],
  },
];

export default redoxConcepts;
