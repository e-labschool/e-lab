// Layer 1 — core concepts for the "energetics" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const energeticsConcepts = [
  {
    id: "enthalpy-change",
    subject: "chemistry",
    domain: "energetics",
    title: "Enthalpy Change",
    description: "The heat energy transferred at constant pressure during a chemical or physical change.",
    relatedConcepts: ["calorimetry"],
  },
  {
    id: "calorimetry",
    subject: "chemistry",
    domain: "energetics",
    title: "Calorimetry",
    description: "Experimental measurement of heat transfer during a reaction.",
    relatedConcepts: ["enthalpy-change","standard-enthalpy-of-reaction"],
  },
  {
    id: "standard-enthalpy-of-reaction",
    subject: "chemistry",
    domain: "energetics",
    title: "Standard Enthalpy of Reaction",
    description: "Enthalpy change measured under defined standard conditions for comparison between reactions.",
    relatedConcepts: ["enthalpy-change","hess-law"],
  },
  {
    id: "hess-law",
    subject: "chemistry",
    domain: "energetics",
    title: "Hess's Law",
    description: "Enthalpy change depends only on initial and final states, allowing indirect routes to be summed.",
    relatedConcepts: ["standard-enthalpy-of-reaction","born-haber-cycle"],
  },
  {
    id: "born-haber-cycle",
    subject: "chemistry",
    domain: "energetics",
    title: "Born-Haber Cycle",
    description: "An energy cycle relating lattice enthalpy to other measurable enthalpy changes.",
    relatedConcepts: ["hess-law","bond-enthalpy-calculations"],
  },
  {
    id: "bond-enthalpy-calculations",
    subject: "chemistry",
    domain: "energetics",
    title: "Bond Enthalpy Calculations",
    description: "Estimating reaction enthalpy from the energy needed to break and form bonds.",
    relatedConcepts: ["hess-law"],
  },
  {
    id: "fuels-and-combustion",
    subject: "chemistry",
    domain: "energetics",
    title: "Fuels and Combustion",
    description: "Energy release from fuels and the chemistry of complete and incomplete combustion.",
    relatedConcepts: ["energy-density"],
  },
  {
    id: "energy-density",
    subject: "chemistry",
    domain: "energetics",
    title: "Energy Density",
    description: "Comparing fuels by energy released per unit mass or volume.",
    relatedConcepts: ["fuels-and-combustion","environmental-impact-of-fuels"],
  },
  {
    id: "environmental-impact-of-fuels",
    subject: "chemistry",
    domain: "energetics",
    title: "Environmental Impact of Fuels",
    description: "Consequences of fuel combustion products on climate and air quality.",
    relatedConcepts: ["energy-density"],
  },
  {
    id: "entropy",
    subject: "chemistry",
    domain: "energetics",
    title: "Entropy",
    description: "A measure of the dispersal of energy and matter within a system.",
    relatedConcepts: ["gibbs-free-energy"],
  },
  {
    id: "gibbs-free-energy",
    subject: "chemistry",
    domain: "energetics",
    title: "Gibbs Free Energy",
    description: "Combining enthalpy and entropy changes to predict whether a reaction is spontaneous.",
    relatedConcepts: ["entropy","spontaneity-of-reactions"],
  },
  {
    id: "spontaneity-of-reactions",
    subject: "chemistry",
    domain: "energetics",
    title: "Spontaneity of Reactions",
    description: "Using thermodynamic quantities to predict the feasibility of a reaction under given conditions.",
    relatedConcepts: ["gibbs-free-energy"],
  },
];

export default energeticsConcepts;
