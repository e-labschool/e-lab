// Layer 1 — core concepts for the "acids-and-bases" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const acidsAndBasesConcepts = [
  {
    id: "acid-base-definitions",
    subject: "chemistry",
    domain: "acids-and-bases",
    title: "Acid-Base Definitions",
    description: "Models describing acids and bases in terms of proton or electron pair transfer.",
    relatedConcepts: ["ph-scale"],
  },
  {
    id: "ph-scale",
    subject: "chemistry",
    domain: "acids-and-bases",
    title: "pH Scale",
    description: "A logarithmic scale expressing the concentration of hydrogen ions in solution.",
    relatedConcepts: ["acid-base-definitions","strong-and-weak-acids-bases"],
  },
  {
    id: "strong-and-weak-acids-bases",
    subject: "chemistry",
    domain: "acids-and-bases",
    title: "Strong and Weak Acids and Bases",
    description: "Distinguishing degree of ionization from concentration when classifying acids and bases.",
    relatedConcepts: ["ph-scale","acid-base-titrations"],
  },
  {
    id: "acid-base-titrations",
    subject: "chemistry",
    domain: "acids-and-bases",
    title: "Acid-Base Titrations",
    description: "Using controlled neutralization to determine unknown concentrations.",
    relatedConcepts: ["strong-and-weak-acids-bases","buffer-solutions"],
  },
  {
    id: "buffer-solutions",
    subject: "chemistry",
    domain: "acids-and-bases",
    title: "Buffer Solutions",
    description: "Solutions that resist changes in pH when small amounts of acid or base are added.",
    relatedConcepts: ["acid-base-titrations"],
  },
];

export default acidsAndBasesConcepts;
