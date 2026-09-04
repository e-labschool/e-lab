// Layer 2 — the resource registry: every interactive e-Lab plans to offer,
// live or not. This is the ONLY place a component/engine is associated with
// a chemistry resourceType and lifecycle status. Concept<->resource joins
// live in coverage-map.js, not here and not in the concept files.
//
// resourceType is a free-form label describing what KIND of tool this is
// (simulation, calculator, molecule-builder, ...) — deliberately broader
// than the 5 fixed interaction "categories" below, since not every concept
// needs a full simulation to be taught well.
//
// categories draws from the fixed set: simulate | visualize | explore | practice | teach

const resources = [
  {
    id: "electron-configuration-explorer",
    title: "Electron Configuration Explorer",
    resourceType: "simulation",
    categories: ["simulate","visualize","practice","teach"],
    status: "live", // live | in-development | planned
    description: "Build and inspect the ground-state electron configuration of any of the 118 elements, shell by shell and orbital by orbital.",
    conceptIds: ["emission-spectra","discrete-energy-levels","electron-shells","electron-subshells","atomic-orbitals","aufbau-principle","hunds-rule","pauli-exclusion-principle","electron-configuration","ion-electron-configuration","ionization-energy"],
    component: () => import("../engines/electron-configuration/ElectronConfigurationExplorer.jsx"),
  },
  {
    id: "particle-model-visualizer",
    title: "Particle Model Visualizer",
    resourceType: "visualizer",
    categories: ["visualize","explore"],
    status: "planned", // live | in-development | planned
    description: "An animated particle view comparing the arrangement and motion of particles in solids, liquids and gases.",
    conceptIds: ["states-of-matter","kinetic-molecular-theory","physical-vs-chemical-change"],
    component: null,
  },
  {
    id: "explore-matter-and-states",
    title: "Explore Matter & States",
    subtitle: "Teacher-led visual exploration",
    audience: "teacher",
    resourceType: "teacher-demonstration",
    categories: ["visualize","explore","teach"],
    status: "live", // live | in-development | planned
    description: "A full teacher-led walkthrough for the States of Matter classroom: test mass and volume experimentally, build the definition of matter, then explore solid/liquid/gas macroscopic behaviour and particle-level reasoning step by step on a projector.",
    conceptIds: ["states-of-matter","kinetic-molecular-theory"],
    component: () => import("../engines/explore-matter-and-states/ExploreMatterAndStates.jsx"),
  },
  {
    id: "mixture-separation-explorer",
    title: "Mixture Separation Explorer",
    resourceType: "guided-inquiry",
    categories: ["explore","teach"],
    status: "planned", // live | in-development | planned
    description: "An interactive walkthrough of choosing and applying a separation technique to a given mixture.",
    conceptIds: ["pure-substances-and-mixtures","separation-techniques"],
    component: null,
  },
  {
    id: "atomic-structure-model",
    title: "Atomic Structure Model",
    resourceType: "interactive-model",
    categories: ["visualize","explore","teach"],
    status: "planned", // live | in-development | planned
    description: "A manipulable nuclear-atom model showing protons, neutrons and electrons, and how isotopes differ.",
    conceptIds: ["subatomic-particles","atomic-number-and-mass-number","isotopes"],
    component: null,
  },
  {
    id: "mass-spectrometer-simulator",
    title: "Mass Spectrometer Simulator",
    resourceType: "simulation",
    categories: ["simulate","visualize"],
    status: "planned", // live | in-development | planned
    description: "Simulates ionization, deflection and detection to build a mass spectrum and calculate relative atomic mass.",
    conceptIds: ["relative-atomic-mass","mass-spectrometry"],
    component: null,
  },
  {
    id: "mole-calculator",
    title: "Mole Calculator",
    resourceType: "calculator",
    categories: ["practice"],
    status: "planned", // live | in-development | planned
    description: "A guided calculator connecting mass, moles, particle count and concentration for any substance.",
    conceptIds: ["the-mole-and-avogadro-constant","molar-mass","empirical-and-molecular-formula","percentage-composition-and-yield","solution-concentration"],
    component: null,
  },
  {
    id: "stoichiometry-equation-builder",
    title: "Stoichiometry Equation Builder",
    resourceType: "equation-builder",
    categories: ["practice","teach"],
    status: "planned", // live | in-development | planned
    description: "Balances equations and steps through mole-ratio calculations, including limiting reagent and atom economy.",
    conceptIds: ["stoichiometric-calculations","reaction-stoichiometry","limiting-reagent","atom-economy"],
    component: null,
  },
  {
    id: "ideal-gas-simulator",
    title: "Ideal Gas Simulator",
    resourceType: "simulation",
    categories: ["simulate","visualize"],
    status: "planned", // live | in-development | planned
    description: "Manipulate pressure, volume, temperature and amount for a modelled gas and compare against real-gas behaviour.",
    conceptIds: ["gas-laws","ideal-gas-equation","real-gas-deviations"],
    component: null,
  },
  {
    id: "ionic-lattice-builder",
    title: "Ionic Lattice Builder",
    resourceType: "molecule-builder",
    categories: ["simulate","visualize","teach"],
    status: "planned", // live | in-development | planned
    description: "Construct an ionic lattice from cations and anions and explore how structure explains bulk properties.",
    conceptIds: ["ion-formation","ionic-bonding","ionic-lattice-structure","properties-of-ionic-compounds"],
    component: null,
  },
  {
    id: "lewis-structure-builder",
    title: "Lewis Structure Builder",
    resourceType: "molecule-builder",
    categories: ["practice","teach"],
    status: "planned", // live | in-development | planned
    description: "Draw Lewis structures interactively, with feedback on bond order and valid resonance forms.",
    conceptIds: ["lewis-structures","bond-order","resonance"],
    component: null,
  },
  {
    id: "molecular-geometry-explorer",
    title: "Molecular Geometry Explorer",
    resourceType: "interactive-model",
    categories: ["simulate","visualize","teach"],
    status: "in-development", // live | in-development | planned
    description: "Predict and rotate 3D molecular shapes from electron-domain geometry, including hybridization.",
    conceptIds: ["vsepr-theory","molecular-geometry","hybridization"],
    component: null,
  },
  {
    id: "molecular-polarity-explorer",
    title: "Molecular Polarity Explorer",
    resourceType: "visualizer",
    categories: ["visualize","explore"],
    status: "planned", // live | in-development | planned
    description: "Visualizes bond dipoles combining (or cancelling) into overall molecular polarity, linked to intermolecular forces.",
    conceptIds: ["electronegativity","bond-polarity","molecular-polarity","intermolecular-forces","physical-properties-of-covalent-substances","covalent-network-structures"],
    component: null,
  },
  {
    id: "metallic-bonding-model",
    title: "Metallic Bonding Model",
    resourceType: "interactive-model",
    categories: ["visualize","teach"],
    status: "planned", // live | in-development | planned
    description: "A delocalized-electron-sea model explaining metallic properties and how alloying changes them.",
    conceptIds: ["metallic-bonding","alloys","properties-of-metals"],
    component: null,
  },
  {
    id: "bonding-continuum-comparison-tool",
    title: "Bonding Continuum Comparison Tool",
    resourceType: "comparison-tool",
    categories: ["explore","teach"],
    status: "planned", // live | in-development | planned
    description: "Places compounds along the ionic–covalent–metallic continuum and links position to material properties.",
    conceptIds: ["bonding-continuum","material-properties-from-bonding"],
    component: null,
  },
  {
    id: "periodic-trends-explorer",
    title: "Periodic Trends Explorer",
    resourceType: "graph-explorer",
    categories: ["visualize","explore","teach"],
    status: "in-development", // live | in-development | planned
    description: "Plots atomic radius, ionization energy and electronegativity across the periodic table to reveal trends.",
    conceptIds: ["periodic-table-organization","periodic-trends-atomic-radius","periodic-trends-ionization-energy","periodic-trends-electronegativity","group-trends-reactivity","transition-elements-properties"],
    component: null,
  },
  {
    id: "organic-nomenclature-builder",
    title: "Organic Nomenclature Builder",
    resourceType: "classification-tool",
    categories: ["practice","teach"],
    status: "planned", // live | in-development | planned
    description: "Builds and names organic structures, and classifies isomers by structural or stereo relationship.",
    conceptIds: ["functional-groups","homologous-series","naming-organic-compounds","structural-isomerism","stereoisomerism"],
    component: null,
  },
  {
    id: "energy-cycle-builder",
    title: "Energy Cycle Builder",
    resourceType: "equation-builder",
    categories: ["practice","teach"],
    status: "planned", // live | in-development | planned
    description: "Constructs Hess's law and Born-Haber cycles interactively from given enthalpy data.",
    conceptIds: ["enthalpy-change","calorimetry","standard-enthalpy-of-reaction","hess-law","born-haber-cycle","bond-enthalpy-calculations"],
    component: null,
  },
  {
    id: "fuels-comparison-tool",
    title: "Fuels Comparison Tool",
    resourceType: "comparison-tool",
    categories: ["explore"],
    status: "planned", // live | in-development | planned
    description: "Compares fuels by energy density, combustion products and environmental impact.",
    conceptIds: ["fuels-and-combustion","energy-density","environmental-impact-of-fuels"],
    component: null,
  },
  {
    id: "entropy-spontaneity-explorer",
    title: "Entropy and Spontaneity Explorer",
    resourceType: "prediction-activity",
    categories: ["explore","practice"],
    status: "planned", // live | in-development | planned
    description: "Predicts reaction spontaneity from enthalpy and entropy changes at varying temperature.",
    conceptIds: ["entropy","gibbs-free-energy","spontaneity-of-reactions"],
    component: null,
  },
  {
    id: "collision-theory-lab",
    title: "Collision Theory Lab",
    resourceType: "simulation",
    categories: ["simulate","visualize","explore","teach"],
    status: "in-development", // live | in-development | planned
    description: "A particle-collision simulation showing how concentration, temperature and catalysts affect successful collision rate.",
    conceptIds: ["collision-theory","factors-affecting-rate","rate-expressions","activation-energy","catalysis","reaction-mechanisms-and-rate"],
    component: null,
  },
  {
    id: "equilibrium-simulator",
    title: "Equilibrium Simulator",
    resourceType: "simulation",
    categories: ["simulate","visualize","explore"],
    status: "in-development", // live | in-development | planned
    description: "Models a reversible reaction reaching dynamic equilibrium and responding to Le Chatelier-style disturbances.",
    conceptIds: ["dynamic-equilibrium","equilibrium-constant","le-chateliers-principle","equilibrium-calculations"],
    component: null,
  },
  {
    id: "titration-lab",
    title: "Titration Lab",
    resourceType: "virtual-practical",
    categories: ["simulate","practice","teach"],
    status: "in-development", // live | in-development | planned
    description: "A virtual acid-base titration with a live pH curve, usable for practice or live demonstration.",
    conceptIds: ["acid-base-titrations","buffer-solutions"],
    component: null,
  },
  {
    id: "acid-base-explorer",
    title: "Acid-Base Explorer",
    resourceType: "visualizer",
    categories: ["visualize","explore"],
    status: "planned", // live | in-development | planned
    description: "Compares strong and weak acids/bases on the pH scale and links pH to hydrogen ion concentration.",
    conceptIds: ["acid-base-definitions","ph-scale","strong-and-weak-acids-bases"],
    component: null,
  },
  {
    id: "redox-electrochemistry-explorer",
    title: "Redox and Electrochemistry Explorer",
    resourceType: "interactive-model",
    categories: ["simulate","visualize","teach"],
    status: "planned", // live | in-development | planned
    description: "Builds electrochemical cells and electrolysis setups from half-equations and predicts cell potential.",
    conceptIds: ["oxidation-states","redox-half-equations","electrochemical-cells","electrolysis"],
    component: null,
  },
  {
    id: "mechanism-builder",
    title: "Reaction Mechanism Builder",
    resourceType: "mechanism-builder",
    categories: ["practice","teach"],
    status: "planned", // live | in-development | planned
    description: "Steps through curly-arrow mechanisms for substitution, addition and elimination reactions.",
    conceptIds: ["radical-substitution-mechanism","electrophiles-and-nucleophiles","reaction-mechanism-representation","nucleophilic-substitution-mechanism","addition-reactions","elimination-reactions"],
    component: null,
  },
  {
    id: "vsepr-explorer-3d",
    title: "VSEPR Explorer (3D)",
    resourceType: "simulation",
    categories: ["simulate","visualize","explore","teach"],
    status: "live", // live | in-development | planned
    description: "A genuine rotatable 3D model of every VSEPR electron-domain geometry (linear through octahedral), with real, independently-verified bond angles — drag to rotate, scroll to zoom.",
    conceptIds: ["vsepr-theory","molecular-geometry"],
    component: () => import("../engines/vsepr-explorer-3d/VSEPRExplorer3D.jsx"),
  },
];

export const resourcesById = Object.fromEntries(resources.map((r) => [r.id, r]));

export function getResource(id) {
  return resourcesById[id] ?? null;
}

export function getAllResources() {
  return resources;
}

export function getResourcesByStatus(status) {
  return resources.filter((r) => r.status === status);
}

export default resources;
