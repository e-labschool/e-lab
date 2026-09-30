import { lazy } from "react";

// The one place a simulation's registry id is wired to its actual React
// component, lazy-loaded so an engine's code only ever downloads when a
// student actually reaches it. Shared by LearnBlockRenderer.jsx (inline
// Learn-page rendering) AND SimulationStandalonePage.jsx (the
// /simulation/:simulationId "Open in New Tab" destination) so both stay
// in sync from a single list -- adding a new engine means adding one line
// here, nothing else.
export const SIMULATION_COMPONENTS = {
  "electron-configuration": lazy(() => import("../engines/electron-configuration/ElectronConfigurationExplorer.jsx")),
  "vsepr-explorer-3d": lazy(() => import("../engines/vsepr-explorer-3d/VSEPRExplorer3D.jsx")),
  "explore-matter-and-states": lazy(() => import("../engines/explore-matter-and-states/ExploreMatterAndStates.jsx")),
  "particle-model-visualizer": lazy(() => import("../engines/particle-model-visualizer/ParticleModelVisualizer.jsx")),
  "phase-change-heating-curve": lazy(() => import("../engines/phase-change-heating-curve/PhaseChangeHeatingCurve.jsx")),
  "ph-calculator-visualizer": lazy(() => import("../engines/ph-calculator-visualizer/PHCalculatorVisualizer.jsx")),
  "h-oh-balance": lazy(() => import("../engines/h-oh-balance/HOHBalance.jsx")),
  "neutralization-particle-visualizer": lazy(() => import("../engines/neutralization-particle-visualizer/NeutralizationParticleVisualizer.jsx")),
  "equivalence-point": lazy(() => import("../engines/equivalence-point/EquivalencePoint.jsx")),
  "titration-ph-curve": lazy(() => import("../engines/titration-ph-curve/TitrationPHCurve.jsx")),
  "buffer-action-visualizer": lazy(() => import("../engines/buffer-action-visualizer/BufferActionVisualizer.jsx")),
  "chocolate-wrapping-rate": lazy(() => import("../engines/chocolate-wrapping-rate/ChocolateWrappingRate.jsx")),
  "collision-theory-visualizer": lazy(() => import("../engines/collision-theory-visualizer/CollisionTheoryVisualizer.jsx")),
  "mixture-separation-explorer": lazy(() => import("../engines/mixture-separation-explorer/MixtureSeparationExplorer.jsx")),
  "build-an-atom": lazy(() => import("../engines/build-an-atom/BuildAtomSimulation.jsx")),
  "wave-explorer": lazy(() => import("../engines/wave-explorer/WaveExplorerSimulation.jsx")),
  "orbital-explorer": lazy(() => import("../engines/orbital-explorer/OrbitalExplorerSimulation.jsx")),
  "atomic-spectra-lab": lazy(() => import("../engines/atomic-spectra/AtomicSpectraSimulation.jsx")),
  "ionization-energy-explorer": lazy(() => import("../engines/ionization-energy-explorer/IonizationEnergyExplorer.jsx")),
};
