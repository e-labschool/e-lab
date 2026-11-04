// Layer 1 — core concepts for the "organic-chemistry" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const organicChemistryConcepts = [
  {
    id: "functional-groups",
    subject: "chemistry",
    domain: "organic-chemistry",
    title: "Functional Groups",
    description: "Reactive groups of atoms that give organic molecules their characteristic chemistry.",
    relatedConcepts: ["homologous-series"],
  },
  {
    id: "homologous-series",
    subject: "chemistry",
    domain: "organic-chemistry",
    title: "Homologous Series",
    description: "Families of organic compounds sharing a functional group and a general formula.",
    relatedConcepts: ["functional-groups","naming-organic-compounds"],
  },
  {
    id: "naming-organic-compounds",
    subject: "chemistry",
    domain: "organic-chemistry",
    title: "Naming Organic Compounds",
    description: "Systematic rules for naming organic molecules from their structure.",
    relatedConcepts: ["homologous-series","structural-isomerism"],
  },
  {
    id: "structural-isomerism",
    subject: "chemistry",
    domain: "organic-chemistry",
    title: "Structural Isomerism",
    description: "Compounds sharing a molecular formula but differing in atom connectivity.",
    relatedConcepts: ["naming-organic-compounds","stereoisomerism"],
  },
  {
    id: "stereoisomerism",
    subject: "chemistry",
    domain: "organic-chemistry",
    title: "Stereoisomerism",
    description: "Compounds with identical connectivity but different spatial arrangement of atoms.",
    relatedConcepts: ["structural-isomerism"],
  },
];

export default organicChemistryConcepts;
