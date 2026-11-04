import FiltrationSimulation from "./FiltrationSimulation.jsx";
import FiltrationSimulationAssets from "./FiltrationSimulationAssets.jsx";
import SedimentationSimulation from "./SedimentationSimulation.jsx";
import SeparatingFunnelSimulation from "./SeparatingFunnelSimulation.jsx";
import MagneticSeparationSimulation from "./MagneticSeparationSimulation.jsx";
import SievingSimulation from "./SievingSimulation.jsx";

// method id -> simulation component. Only entries that exist here are
// ever shown as selectable in MethodSelector, regardless of what a
// mixture's data lists -- this is the single place a new method
// becomes real. Add EvaporationSimulation, CrystallizationSimulation,
// etc. here as each is actually built in a later phase.
//
// "filtration" now points at the new asset-driven reference
// implementation (FiltrationSimulationAssets). The original SVG version
// (FiltrationSimulation) is deliberately kept, unregistered, in this
// same folder as a working reference/fallback -- not deleted, per
// instruction, and easy to swap back in by changing the line below.
export const simulationRegistry = {
  filtration: FiltrationSimulationAssets,
  sedimentationDecantation: SedimentationSimulation,
  separatingFunnel: SeparatingFunnelSimulation,
  magneticSeparation: MagneticSeparationSimulation,
  sieving: SievingSimulation,
};

// Kept importable but unused above -- silences no-op tooling concerns
// about an intentionally-unregistered reference implementation.
export { FiltrationSimulation as FiltrationSimulationSVGReference };

