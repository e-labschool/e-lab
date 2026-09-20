import FiltrationSimulation from "./FiltrationSimulation.jsx";
import SedimentationSimulation from "./SedimentationSimulation.jsx";
import SeparatingFunnelSimulation from "./SeparatingFunnelSimulation.jsx";
import MagneticSeparationSimulation from "./MagneticSeparationSimulation.jsx";
import SievingSimulation from "./SievingSimulation.jsx";

// method id -> simulation component. Only entries that exist here are
// ever shown as selectable in MethodSelector, regardless of what a
// mixture's data lists -- this is the single place a new method
// becomes real. Add EvaporationSimulation, CrystallizationSimulation,
// etc. here as each is actually built in a later phase.
export const simulationRegistry = {
  filtration: FiltrationSimulation,
  sedimentationDecantation: SedimentationSimulation,
  separatingFunnel: SeparatingFunnelSimulation,
  magneticSeparation: MagneticSeparationSimulation,
  sieving: SievingSimulation,
};
