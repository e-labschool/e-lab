// Per-concept learning content (learning intention, explanation, key idea,
// misconception, worked example). This is genuinely new prose content, not
// derived from anything else in the project — populated here for a
// representative concept from each major topic across Structure and
// Reactivity, proving the Learn architecture end-to-end. Concepts without
// an entry here still work: ConceptPage falls back to the concept's
// existing one-line `description` from src/data/concepts and shows a
// clear "full content coming soon" state rather than nothing or fake text.
// Extending coverage to the remaining concepts is future content-authoring
// work, not an architecture gap.
const conceptContent = {
  "states-of-matter": {
    learningIntention: "Describe solids, liquids and gases in terms of particle arrangement, movement and energy.",
    explanation: [
      "Matter exists in three common states — solid, liquid and gas — that differ in how closely particles are packed and how freely they move.",
      "In a solid, particles are held in fixed positions by strong attractive forces and only vibrate. In a liquid, particles are still close together but can move past one another, giving a liquid its ability to flow while keeping a fixed volume. In a gas, particles are far apart, move rapidly and independently, and have essentially no attraction holding them together — which is why a gas expands to fill any container.",
      "Changes of state (melting, freezing, boiling, condensing) happen when enough energy is added or removed to change how strongly particles interact, without changing what the particles themselves are.",
    ],
    keyIdea: "The three states differ in particle spacing, particle movement, and the strength of attraction between particles — not in the identity of the particles themselves.",
    misconception: "A common misconception is that particles themselves expand when heated. In fact, the particles stay the same size — it's the space between them, and how fast they move, that changes.",
  },
  "lewis-structures": {
    learningIntention: "Construct Lewis (electron dot) structures showing bonding pairs, lone pairs and formal charge.",
    explanation: [
      "A Lewis structure shows how valence electrons are arranged in a molecule or ion: as shared bonding pairs between atoms, and as lone (non-bonding) pairs on individual atoms.",
      "To build one, count the total valence electrons available, arrange atoms with the least electronegative (usually central) atom in the middle, form single bonds first, then distribute remaining electrons as lone pairs — typically completing an octet around each atom where possible (hydrogen only ever gets 2 electrons).",
      "Where a single bond alone can't satisfy every atom's octet, additional bonding pairs are formed (double or triple bonds) by moving a lone pair from one atom to become a second or third shared pair.",
    ],
    keyIdea: "Every valence electron in the structure must be accounted for — as a bonding pair or a lone pair — and (with some recognized exceptions) most atoms aim for a full octet.",
    misconception: "Students often forget to include lone pairs once bonds are drawn. A Lewis structure isn't finished until every valence electron — bonding and non-bonding — is placed somewhere.",
    workedExample: "CO₂: carbon (4 valence e⁻) is central, each oxygen (6 valence e⁻ each) needs 2 more electrons to complete its octet. A single bond to each O leaves both C and O short of an octet, so each C–O bond becomes a double bond (C=O), giving carbon 4 bonds total and each oxygen 2 lone pairs plus the double bond — every atom reaches an octet.",
  },
  "periodic-table-organization": {
    learningIntention: "Explain how the periodic table is organized into periods, groups and blocks by electron configuration.",
    explanation: [
      "Elements in the periodic table are arranged in order of increasing atomic number, organized into horizontal periods and vertical groups.",
      "A period corresponds to the highest main energy level (electron shell) occupied by an atom's electrons — moving across a period, electrons fill the same shell. A group contains elements with the same number of valence electrons, which is why elements in the same group show similar chemical behaviour.",
      "The table is also divided into s, p, d and f blocks, named for the sublevel type of the highest-energy electron being added — the block an element sits in directly reflects its electron configuration.",
    ],
    keyIdea: "Position in the periodic table is a direct readout of electron configuration: period = outer shell number, group = valence electron count, block = sublevel type.",
  },
  "enthalpy-change": {
    learningIntention: "Define enthalpy change and distinguish exothermic from endothermic reactions using energy profile diagrams.",
    explanation: [
      "Enthalpy (H) is a measure of the heat content of a system at constant pressure. Reactions transfer energy between the chemical system and its surroundings, and the enthalpy change, ΔH, is the difference in enthalpy between products and reactants.",
      "In an exothermic reaction, energy is released from the system to the surroundings (the surroundings warm up), and ΔH is negative — products have lower enthalpy than reactants. In an endothermic reaction, energy is absorbed from the surroundings (the surroundings cool down), and ΔH is positive — products have higher enthalpy than reactants.",
      "These are shown on an energy profile with potential energy on the y-axis and reaction coordinate on the x-axis: an exothermic profile ends lower than it starts, an endothermic profile ends higher.",
    ],
    keyIdea: "The sign of ΔH tells you the direction of energy transfer: negative means the system releases energy (exothermic), positive means it absorbs energy (endothermic).",
    misconception: "ΔH's sign is often confused with whether a reaction 'feels' hot or cold to a bystander — but the sign always describes the system's energy change, and an exothermic reaction is one where the system loses energy (even though the surroundings gain it and get hotter).",
  },
  "collision-theory": {
    learningIntention: "Explain reaction rate in terms of particle collisions, activation energy and orientation.",
    explanation: [
      "For a chemical reaction to occur, reactant particles must collide. But not every collision leads to a reaction — a collision is only successful if the particles collide with at least the activation energy (Ea), the minimum energy needed to break existing bonds and start forming new ones, and with a suitable orientation for the relevant atoms to interact.",
      "Anything that increases the frequency of collisions (higher concentration, higher pressure for gases, greater surface area for solids) or increases the fraction of particles with sufficient energy (higher temperature, a catalyst) increases the rate of successful collisions, and therefore the reaction rate.",
    ],
    keyIdea: "Reaction rate depends on the frequency of collisions AND the fraction of those collisions that are successful (sufficient energy + correct orientation) — increasing either increases rate.",
    misconception: "It's tempting to think any collision between reactant particles causes a reaction. In reality, most collisions are unsuccessful — only those with enough energy and the right orientation actually result in product formation.",
  },
  "dynamic-equilibrium": {
    learningIntention: "Describe dynamic equilibrium in a closed system in terms of forward and reverse reaction rates.",
    explanation: [
      "In a closed system, many reactions don't go to completion — instead, the forward and reverse reactions both continue to happen simultaneously. Dynamic equilibrium is reached when the rate of the forward reaction equals the rate of the reverse reaction.",
      "At this point, the concentrations of reactants and products remain constant over time — not because the reactions have stopped, but because they are occurring at exactly matching rates in both directions, so there's no further net change.",
    ],
    keyIdea: "Equilibrium is dynamic, not static: both reactions continue at the molecular level, but their equal rates mean concentrations stop changing at the macroscopic (measurable) level.",
    misconception: "A common misconception is that at equilibrium, reactant and product concentrations must be equal to each other. They don't — they simply each stay constant. Equilibrium can lie heavily toward products or reactants and still be a genuine dynamic equilibrium.",
  },
  "acid-base-definitions": {
    learningIntention: "Define acids and bases in terms of proton transfer (Brønsted–Lowry theory) and identify conjugate acid–base pairs.",
    explanation: [
      "According to Brønsted–Lowry theory, an acid is a proton (H⁺) donor and a base is a proton acceptor. When an acid donates a proton, what remains is its conjugate base; when a base accepts a proton, the result is its conjugate acid.",
      "Every acid–base reaction can be described as a proton transfer between a conjugate acid–base pair on each side of the equation. Some species (like water) are amphiprotic — able to act as either an acid or a base depending on what they're reacting with.",
    ],
    keyIdea: "An acid and its conjugate base (or a base and its conjugate acid) differ by exactly one proton, H⁺.",
    misconception: "Strong/weak (extent of ionization) and concentrated/dilute (amount of acid dissolved in a given volume) describe two completely different properties — a dilute solution of a strong acid can still be a strong acid, just at low concentration.",
  },
  "oxidation-states": {
    learningIntention: "Assign oxidation states to atoms in elements, compounds and ions using standard rules.",
    explanation: [
      "Oxidation state (or oxidation number) is a bookkeeping value assigned to an atom that reflects the charge it would have if all bonds to different elements were fully ionic.",
      "Standard rules apply: an atom in its elemental form has oxidation state 0; a simple monatomic ion has an oxidation state equal to its charge; oxygen is usually −2 (except in peroxides, where it's −1); hydrogen is usually +1 (except when bonded to a less electronegative element, e.g. metal hydrides, where it's −1); and the oxidation states in a neutral compound sum to zero, or in a polyatomic ion sum to the ion's overall charge.",
      "Tracking oxidation state changes across a reaction identifies oxidation (an increase in oxidation state, i.e. loss of electrons) and reduction (a decrease in oxidation state, i.e. gain of electrons).",
    ],
    keyIdea: "Oxidation states must sum to the overall charge of the species (0 for a neutral compound, the ion's charge for a polyatomic ion) — this constraint is what lets you solve for an unknown oxidation state.",
    workedExample: "In SO₄²⁻: oxygen is −2 (×4 = −8). The ion's overall charge is −2, so sulfur's oxidation state + (−8) = −2, giving sulfur an oxidation state of +6.",
  },
};

export function getConceptContent(conceptId) {
  return conceptContent[conceptId] ?? null;
}
