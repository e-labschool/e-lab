// Lightweight, concept-specific Check Yourself questions — deliberately a
// separate, smaller format from the full Question Bank (src/data/questions),
// since formal Paper 1/2-style questions are too long for an immediate
// formative check after a single concept. 2-3 short items per concept,
// original e-Lab content. Populated for the same representative concept
// set as concept-content.js; CheckYourself.jsx shows a graceful
// "not available yet" state for any concept without an entry here.
const conceptChecks = {
  "states-of-matter": [
    {
      id: "som-1", type: "mcq",
      prompt: "In which state are particles held in fixed positions, only vibrating?",
      options: ["Solid", "Liquid", "Gas", "Plasma"],
      correctAnswer: "Solid",
      explanation: "In a solid, strong attractive forces lock particles into fixed positions — they can vibrate but not move past one another.",
    },
    {
      id: "som-2", type: "mcq",
      prompt: "What happens to individual particles when a solid melts?",
      options: ["They get physically larger", "They gain enough energy to move past one another", "They lose mass", "They stop moving entirely"],
      correctAnswer: "They gain enough energy to move past one another",
      explanation: "Melting doesn't change the particles themselves — it gives them enough energy to overcome some of the forces holding them in fixed positions, so they can flow.",
    },
    {
      id: "som-3", type: "true-false",
      prompt: "True or false: a gas has no fixed shape or volume.",
      correctAnswer: true,
      explanation: "Gas particles move independently with negligible attraction between them, so a gas expands to fill and take the shape of any container.",
    },
  ],
  "lewis-structures": [
    {
      id: "ls-1", type: "mcq",
      prompt: "How many lone pairs does the central carbon atom have in a correctly drawn CO₂ Lewis structure?",
      options: ["0", "1", "2", "4"],
      correctAnswer: "0",
      explanation: "Carbon forms two double bonds (to each oxygen) in CO₂, using all 4 of its valence electrons in bonding — it has no lone pairs.",
    },
    {
      id: "ls-2", type: "mcq",
      prompt: "In a Lewis structure, a shared pair of electrons between two atoms represents:",
      options: ["A lone pair", "An ionic bond", "A covalent bond", "A radical"],
      correctAnswer: "A covalent bond",
      explanation: "A covalent bond is exactly a shared pair of electrons between two atoms, shown as a line or a pair of dots between them.",
    },
    {
      id: "ls-3", type: "true-false",
      prompt: "True or false: hydrogen atoms can have a full octet of 8 electrons in a Lewis structure.",
      correctAnswer: false,
      explanation: "Hydrogen only has one orbital available (1s), so it can hold a maximum of 2 electrons — never a full octet of 8.",
    },
  ],
  "periodic-table-organization": [
    {
      id: "pto-1", type: "mcq",
      prompt: "Elements in the same group of the periodic table have the same number of:",
      options: ["Protons", "Neutrons", "Valence electrons", "Electron shells"],
      correctAnswer: "Valence electrons",
      explanation: "Group membership is defined by valence electron count, which is why elements in a group share similar chemical behaviour.",
    },
    {
      id: "pto-2", type: "mcq",
      prompt: "An element's period number tells you:",
      options: ["Its atomic mass", "Its highest occupied main energy level (shell)", "Its number of protons", "Its block"],
      correctAnswer: "Its highest occupied main energy level (shell)",
      explanation: "Moving across a period, electrons are added to the same outer shell — the period number equals that shell's number.",
    },
  ],
  "enthalpy-change": [
    {
      id: "ec-1", type: "mcq",
      prompt: "In an exothermic reaction, the sign of ΔH is:",
      options: ["Positive", "Negative", "Zero", "Undefined"],
      correctAnswer: "Negative",
      explanation: "Exothermic reactions release energy from the system, so products end up at lower enthalpy than reactants, giving a negative ΔH.",
    },
    {
      id: "ec-2", type: "mcq",
      prompt: "On an energy profile for an endothermic reaction, the products are drawn:",
      options: ["Below the reactants", "Above the reactants", "At the same level as the reactants", "Off the graph"],
      correctAnswer: "Above the reactants",
      explanation: "Endothermic reactions absorb energy, so the system ends with higher potential energy — products sit above reactants on the profile.",
    },
    {
      id: "ec-3", type: "true-false",
      prompt: "True or false: in an exothermic reaction, the surroundings get colder.",
      correctAnswer: false,
      explanation: "The system releases energy TO the surroundings in an exothermic reaction, so the surroundings warm up, not cool down.",
    },
  ],
  "collision-theory": [
    {
      id: "ct-1", type: "mcq",
      prompt: "A collision between reactant particles results in a reaction only if:",
      options: ["The particles are the same size", "The collision has sufficient energy and correct orientation", "The temperature is above 0°C", "A catalyst is present"],
      correctAnswer: "The collision has sufficient energy and correct orientation",
      explanation: "Both conditions are required — energy at least equal to Ea, AND a suitable orientation for the reacting atoms to interact.",
    },
    {
      id: "ct-2", type: "mcq",
      prompt: "Increasing temperature increases reaction rate mainly because:",
      options: ["Particles become larger", "A greater fraction of particles have energy ≥ Ea", "Activation energy decreases", "Concentration increases"],
      correctAnswer: "A greater fraction of particles have energy ≥ Ea",
      explanation: "Higher temperature shifts the energy distribution so more particles have at least the activation energy, increasing successful-collision frequency.",
    },
  ],
  "dynamic-equilibrium": [
    {
      id: "de-1", type: "true-false",
      prompt: "True or false: at dynamic equilibrium, the forward and reverse reactions have both completely stopped.",
      correctAnswer: false,
      explanation: "Both reactions continue at equilibrium — they just proceed at equal rates, so there's no further NET change in concentrations.",
    },
    {
      id: "de-2", type: "mcq",
      prompt: "At equilibrium, reactant and product concentrations:",
      options: ["Must be exactly equal", "Remain constant, but not necessarily equal", "Both increase together", "Are always zero"],
      correctAnswer: "Remain constant, but not necessarily equal",
      explanation: "Constant does not mean equal — equilibrium can lie heavily toward products or reactants while both concentrations stay steady.",
    },
  ],
  "acid-base-definitions": [
    {
      id: "abd-1", type: "mcq",
      prompt: "According to Brønsted–Lowry theory, a base is defined as a:",
      options: ["Proton donor", "Proton acceptor", "Electron donor", "Electron acceptor"],
      correctAnswer: "Proton acceptor",
      explanation: "Brønsted–Lowry bases accept a proton (H⁺); the species that donates the proton is the acid.",
    },
    {
      id: "abd-2", type: "true-false",
      prompt: "True or false: a dilute solution of a strong acid is automatically a weak acid.",
      correctAnswer: false,
      explanation: "Strong/weak describes the extent of ionization, while concentrated/dilute describes the amount dissolved — a dilute solution of a strong acid is still a strong acid, just at low concentration.",
    },
  ],
  "oxidation-states": [
    {
      id: "os-1", type: "numeric",
      prompt: "What is the oxidation state of sulfur in SO₄²⁻?",
      correctAnswer: "+6",
      explanation: "Oxygen is −2 (×4 = −8). The ion's overall charge is −2, so sulfur must be +6 for the total to sum to −2.",
    },
    {
      id: "os-2", type: "mcq",
      prompt: "In H₂O₂ (hydrogen peroxide), the oxidation state of oxygen is:",
      options: ["−2", "−1", "0", "+1"],
      correctAnswer: "−1",
      explanation: "Peroxides are the standard exception to oxygen's usual −2 oxidation state — in a peroxide, oxygen is −1.",
    },
  ],
  "s1-1-matter": [
    {
      id: "s11m-1", type: "mcq",
      prompt: "Which statement best describes matter?",
      options: ["Anything that can be seen", "Anything that has mass and occupies space", "Only solids and liquids"],
      correctAnswer: "Anything that has mass and occupies space",
      explanation: "Matter includes solids, liquids and gases. Matter has mass and occupies space.",
    },
    {
      id: "s11m-2", type: "mcq",
      prompt: "Why do chemists use particle models?",
      options: ["To represent behaviour at scales difficult to observe directly", "Because matter contains no particles", "Because models are exact photographs of particles"],
      correctAnswer: "To represent behaviour at scales difficult to observe directly",
      explanation: "Models help chemists represent, explain and predict behaviour that cannot always be observed directly.",
    },
  ],
  "s1-1-elements-compounds-mixtures": [
    {
      id: "s11ecm-1", type: "mcq",
      prompt: "Salt water can contain different amounts of salt. Salt water is best classified as a:",
      options: ["Element", "Compound", "Mixture"],
      correctAnswer: "Mixture",
      explanation: "Salt water has no fixed ratio of salt to water — that's a defining feature of a mixture, not a compound.",
    },
    {
      id: "s11ecm-2", type: "true-false",
      prompt: "True or false: O\u2082 must be a compound because it contains two atoms.",
      correctAnswer: false,
      explanation: "Both atoms are oxygen. Compounds contain different elements chemically bonded together.",
    },
    {
      id: "s11ecm-3", type: "mcq",
      prompt: "H\u2082O contains hydrogen and oxygen chemically bonded in a 2:1 ratio. H\u2082O is:",
      options: ["An element", "A compound", "A mixture"],
      correctAnswer: "A compound",
      explanation: "Different elements (H and O), chemically bonded, in a fixed ratio — that's exactly the definition of a compound.",
    },
  ],
};

export function getConceptChecks(conceptId) {
  return conceptChecks[conceptId] ?? null;
}
