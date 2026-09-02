// Layer 1 — core concepts for the "atomic-structure" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const atomicStructureConcepts = [
  {
    id: "subatomic-particles",
    subject: "chemistry",
    domain: "atomic-structure",
    title: "Subatomic Particles",
    description: "The relative mass, charge and location of protons, neutrons and electrons.",
    relatedConcepts: ["atomic-number-and-mass-number"],
  },
  {
    id: "atomic-number-and-mass-number",
    subject: "chemistry",
    domain: "atomic-structure",
    title: "Atomic Number and Mass Number",
    description: "How proton and nucleon counts define and identify an element.",
    relatedConcepts: ["subatomic-particles","isotopes"],
  },
  {
    id: "isotopes",
    subject: "chemistry",
    domain: "atomic-structure",
    title: "Isotopes",
    description: "Atoms of the same element with different neutron numbers, and their effect on physical properties.",
    relatedConcepts: ["atomic-number-and-mass-number","relative-atomic-mass"],
  },
  {
    id: "relative-atomic-mass",
    subject: "chemistry",
    domain: "atomic-structure",
    title: "Relative Atomic Mass",
    description: "A weighted average of isotopic masses based on natural abundance.",
    relatedConcepts: ["isotopes","mass-spectrometry"],
  },
  {
    id: "mass-spectrometry",
    subject: "chemistry",
    domain: "atomic-structure",
    title: "Mass Spectrometry",
    description: "Using deflection of charged particles to determine isotopic composition and relative mass.",
    relatedConcepts: ["relative-atomic-mass"],
  },
];

export default atomicStructureConcepts;
