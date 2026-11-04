// Layer 1 — core concepts for the "stoichiometry" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const stoichiometryConcepts = [
  {
    id: "the-mole-and-avogadro-constant",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "The Mole and Avogadro's Constant",
    description: "Using the mole as a bridge between countable particles and measurable mass.",
    relatedConcepts: ["molar-mass"],
  },
  {
    id: "molar-mass",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "Molar Mass",
    description: "The mass of one mole of a substance, used to convert between mass and amount.",
    relatedConcepts: ["the-mole-and-avogadro-constant","empirical-and-molecular-formula"],
  },
  {
    id: "empirical-and-molecular-formula",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "Empirical and Molecular Formula",
    description: "Determining the simplest and true whole-number ratios of atoms in a compound.",
    relatedConcepts: ["molar-mass"],
  },
  {
    id: "stoichiometric-calculations",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "Stoichiometric Calculations",
    description: "Using balanced equations to relate quantities of reactants and products.",
    relatedConcepts: ["reaction-stoichiometry","limiting-reagent"],
  },
  {
    id: "percentage-composition-and-yield",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "Percentage Composition and Yield",
    description: "Quantifying the proportion of elements in a compound and the efficiency of a reaction.",
    relatedConcepts: ["stoichiometric-calculations"],
  },
  {
    id: "solution-concentration",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "Solution Concentration",
    description: "Expressing and calculating the amount of solute dissolved in a given volume of solution.",
    relatedConcepts: ["stoichiometric-calculations"],
  },
  {
    id: "reaction-stoichiometry",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "Reaction Stoichiometry",
    description: "Applying mole ratios from a balanced equation to real reacting quantities.",
    relatedConcepts: ["stoichiometric-calculations","limiting-reagent"],
  },
  {
    id: "limiting-reagent",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "Limiting Reagent",
    description: "Identifying which reactant is used up first and constrains the amount of product formed.",
    relatedConcepts: ["reaction-stoichiometry","atom-economy"],
  },
  {
    id: "atom-economy",
    subject: "chemistry",
    domain: "stoichiometry",
    title: "Atom Economy",
    description: "A measure of how efficiently reactant atoms are converted into desired product.",
    relatedConcepts: ["limiting-reagent","percentage-composition-and-yield"],
  },
];

export default stoichiometryConcepts;
