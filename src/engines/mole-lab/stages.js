/** The six stages in navigation order.  `built` is false for stages that exist only as a labelled placeholder (phase 2). */
export const STAGES = Object.freeze([
  { id: 1, short: "Explore the Mole", title: "Explore the Mole", purpose: "One mole is a fixed count of entities. Use the formula to count the atoms or ions inside it." },
  { id: 2, short: "Mass ↔ Moles", title: "Mass ↔ Moles", purpose: "Connect mass, molar mass and amount of substance: n = m / M and m = nM." },
  { id: 3, short: "Concentration", title: "Concentration Laboratory", purpose: "Prepare, compare and dilute solutions." },
  { id: 4, short: "Gas Volume", title: "Gas Volume Laboratory", purpose: "Connect the amount of gas to its volume." },
  { id: 5, short: "Chemical Equations", title: "Chemical Equations", purpose: "Visualise mole ratios from balanced equations." },
  { id: 6, short: "Limiting Reagents", title: "Limiting Reagents", purpose: "Limiting and excess reactants and theoretical yield." },
]);
