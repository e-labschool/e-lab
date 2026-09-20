import FiltrationSimulation from "./FiltrationSimulation.jsx";

// method id -> simulation component. Only entries that exist here are
// ever shown as selectable in MethodSelector, regardless of what a
// mixture's data lists -- this is the single place a new method
// becomes real. Add EvaporationSimulation, CrystallizationSimulation,
// etc. here as each is actually built.
export const simulationRegistry = {
  filtration: FiltrationSimulation,
};
