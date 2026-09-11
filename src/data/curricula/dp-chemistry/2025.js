// Layer 3 — curriculum map. This file is the ONLY place "Structure"/"Reactivity"
// labels and subtopic codes like "structure-1.3" exist anywhere in e-Lab.
// It references concept IDs defined in src/data/concepts — it never defines
// chemistry content itself, and no interactive/engine ever imports this file.

const dpChemistry2025 = {
  id: "dp-chemistry-2025",
  curriculum: "dp-chemistry",
  version: "2025",
  label: "DP Chemistry — First Assessment 2025",
  subject: "chemistry",
  sections: [
    {
      id: "structure",
      label: "Structure",
      description: "Models of the particulate nature of matter, bonding and structure, and classification of matter.",
      topics: [
        {
          id: "structure-1",
          label: "Models of the particulate nature of matter",
          subtopics: [
            { id: "structure-1.1", label: "Introduction to the particulate nature of matter", conceptIds: ["states-of-matter", "kinetic-molecular-theory", "physical-vs-chemical-change", "pure-substances-and-mixtures", "separation-techniques"] },
            { id: "structure-1.2", label: "The nuclear atom", conceptIds: ["subatomic-particles", "atomic-number-and-mass-number", "isotopes", "relative-atomic-mass", "mass-spectrometry"] },
            { id: "structure-1.3", label: "Electron configurations", conceptIds: ["emission-spectra", "discrete-energy-levels", "electron-shells", "electron-subshells", "atomic-orbitals", "aufbau-principle", "hunds-rule", "pauli-exclusion-principle", "electron-configuration", "ion-electron-configuration", "ionization-energy"] },
            { id: "structure-1.4", label: "Counting particles by mass: The mole", conceptIds: ["the-mole-and-avogadro-constant", "molar-mass", "empirical-and-molecular-formula", "stoichiometric-calculations", "percentage-composition-and-yield", "solution-concentration"] },
            { id: "structure-1.5", label: "Ideal gases", conceptIds: ["gas-laws", "ideal-gas-equation", "real-gas-deviations"] },
          ],
        },
        {
          id: "structure-2",
          label: "Models of bonding and structure",
          subtopics: [
            { id: "structure-2.1", label: "The ionic model", conceptIds: ["ion-formation", "ionic-bonding", "ionic-lattice-structure", "properties-of-ionic-compounds"] },
            { id: "structure-2.2", label: "The covalent model", conceptIds: ["lewis-structures", "bond-order", "resonance", "vsepr-theory", "molecular-geometry", "electronegativity", "bond-polarity", "molecular-polarity", "covalent-network-structures", "intermolecular-forces", "physical-properties-of-covalent-substances", "hybridization"] },
            { id: "structure-2.3", label: "The metallic model", conceptIds: ["metallic-bonding", "alloys", "properties-of-metals"] },
            { id: "structure-2.4", label: "From models to materials", conceptIds: ["bonding-continuum", "material-properties-from-bonding"] },
          ],
        },
        {
          id: "structure-3",
          label: "Classification of matter",
          subtopics: [
            { id: "structure-3.1", label: "The periodic table: Classification of elements", conceptIds: ["periodic-table-organization", "periodic-trends-atomic-radius", "periodic-trends-ionization-energy", "periodic-trends-electronegativity", "group-trends-reactivity", "transition-elements-properties"] },
            { id: "structure-3.2", label: "Functional groups: Classification of organic compounds", conceptIds: ["functional-groups", "homologous-series", "naming-organic-compounds", "structural-isomerism", "stereoisomerism"] },
          ],
        },
      ],
    },
    {
      id: "reactivity",
      label: "Reactivity",
      description: "What drives chemical reactions, how much/how fast/how far they proceed, and their mechanisms.",
      topics: [
        {
          id: "reactivity-1",
          label: "What drives chemical reactions?",
          subtopics: [
            { id: "reactivity-1.1", label: "Measuring enthalpy changes", conceptIds: ["enthalpy-change", "calorimetry", "standard-enthalpy-of-reaction"] },
            { id: "reactivity-1.2", label: "Energy cycles in reactions", conceptIds: ["hess-law", "born-haber-cycle", "bond-enthalpy-calculations"] },
            { id: "reactivity-1.3", label: "Energy from fuels", conceptIds: ["fuels-and-combustion", "energy-density", "environmental-impact-of-fuels"] },
            { id: "reactivity-1.4", label: "Entropy and spontaneity", conceptIds: ["entropy", "gibbs-free-energy", "spontaneity-of-reactions"] },
          ],
        },
        {
          id: "reactivity-2",
          label: "How much, how fast and how far?",
          subtopics: [
            { id: "reactivity-2.1", label: "Amount of chemical change", conceptIds: ["reaction-stoichiometry", "limiting-reagent", "atom-economy"] },
            { id: "reactivity-2.2", label: "Rate of chemical change", conceptIds: ["collision-theory", "factors-affecting-rate", "rate-expressions", "activation-energy", "catalysis", "reaction-mechanisms-and-rate"] },
            { id: "reactivity-2.3", label: "Extent of chemical change", conceptIds: ["dynamic-equilibrium", "equilibrium-constant", "le-chateliers-principle", "equilibrium-calculations"] },
          ],
        },
        {
          id: "reactivity-3",
          label: "Mechanisms of chemical change",
          subtopics: [
            { id: "reactivity-3.1", label: "Proton transfer reactions", conceptIds: ["acid-base-definitions", "ph-scale", "strong-and-weak-acids-bases", "acid-base-titrations", "buffer-solutions"] },
            { id: "reactivity-3.2", label: "Electron transfer reactions", conceptIds: ["oxidation-states", "redox-half-equations", "electrochemical-cells", "electrolysis"] },
            { id: "reactivity-3.3", label: "Electron sharing reactions", conceptIds: ["radical-substitution-mechanism", "electrophiles-and-nucleophiles", "reaction-mechanism-representation"] },
            { id: "reactivity-3.4", label: "Electron-pair sharing reactions", conceptIds: ["nucleophilic-substitution-mechanism", "addition-reactions", "elimination-reactions"] },
          ],
        },
      ],
    },
  ],
};

export default dpChemistry2025;
