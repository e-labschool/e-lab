// Layer 1 — core concepts for the "periodicity" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const periodicityConcepts = [
  {
    id: "periodic-table-organization",
    subject: "chemistry",
    domain: "periodicity",
    title: "Periodic Table Organization",
    description: "How elements are arranged by atomic number into periods and groups of related properties.",
    relatedConcepts: ["electron-configuration"],
  },
  {
    id: "periodic-trends-atomic-radius",
    subject: "chemistry",
    domain: "periodicity",
    title: "Periodic Trends: Atomic Radius",
    description: "How atomic size changes across periods and down groups, and why.",
    relatedConcepts: ["periodic-table-organization"],
  },
  {
    id: "periodic-trends-ionization-energy",
    subject: "chemistry",
    domain: "periodicity",
    title: "Periodic Trends: Ionization Energy",
    description: "Explaining group and period trends in the energy needed to remove an electron.",
    relatedConcepts: ["ionization-energy","periodic-table-organization"],
  },
  {
    id: "periodic-trends-electronegativity",
    subject: "chemistry",
    domain: "periodicity",
    title: "Periodic Trends: Electronegativity",
    description: "How electronegativity varies across the periodic table and why.",
    relatedConcepts: ["electronegativity","periodic-table-organization"],
  },
  {
    id: "group-trends-reactivity",
    subject: "chemistry",
    domain: "periodicity",
    title: "Group Trends in Reactivity",
    description: "Explaining how reactivity changes down groups of metals and non-metals.",
    relatedConcepts: ["periodic-table-organization"],
  },
  {
    id: "transition-elements-properties",
    subject: "chemistry",
    domain: "periodicity",
    title: "Transition Element Properties",
    description: "Characteristic properties of d-block elements including variable oxidation states and coloured compounds.",
    relatedConcepts: ["periodic-table-organization"],
  },
];

export default periodicityConcepts;
