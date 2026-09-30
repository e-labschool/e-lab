// Single source of truth for which e-Lab simulation engines exist and
// their display label. Both the Learn CMS block picker
// (learnBlockRegistry.jsx re-exports this unchanged) and the shared
// simulation chrome (InteractiveFrame -> SimulationActions,
// SimulationStandalonePage, the /simulation/:simulationId route) read
// from this ONE object, so a new engine is registered in exactly one
// place and every consumer stays in sync automatically.
export const SIMULATION_REGISTRY = {
  "electron-configuration": { label: "Electron Configuration Explorer" },
  "vsepr-explorer-3d": { label: "VSEPR Explorer (3D)" },
  "explore-matter-and-states": { label: "Explore Matter & States" },
  "particle-model-visualizer": { label: "Particle Model Visualizer" },
  "phase-change-heating-curve": { label: "Phase Change & Heating Curve" },
  "ph-calculator-visualizer": { label: "pH Calculator & Visualizer" },
  "h-oh-balance": { label: "H+ - OH- Balance in Water" },
  "neutralization-particle-visualizer": { label: "Neutralization Particle Visualizer" },
  "equivalence-point": { label: "Equivalence Point" },
  "titration-ph-curve": { label: "pH Curve & Titration Visualizer" },
  "buffer-action-visualizer": { label: "Buffer Action Visualizer" },
  "chocolate-wrapping-rate": { label: "Chocolate Wrapping — Understanding Rate" },
  "collision-theory-visualizer": { label: "Collision Theory Visualizer" },
  "mixture-separation-explorer": { label: "Mixture Separation Explorer" },
  "build-an-atom": { label: "Build an Atom" },
  "wave-explorer": { label: "Wave Explorer" },
  "orbital-explorer": { label: "Orbital Explorer" },
  "atomic-spectra-lab": { label: "Atomic Spectra Lab" },
  "ionization-energy-explorer": { label: "Ionization Energy Explorer" },
};

// label -> id, built once. This is what lets InteractiveFrame resolve a
// `simulationId` for the "Open in New Tab" control WITHOUT every engine
// having to separately pass its own registry id down -- InteractiveFrame
// already receives `title` from every engine, and for each entry above
// that title is exactly this label (verified against every current
// engine's own <InteractiveFrame title="..."> call). If a future engine's
// title ever doesn't match its registry label, getSimulationIdForTitle
// simply returns null and "Open in New Tab" is omitted for it -- Full
// Screen (which needs no id) still works regardless.
const LABEL_TO_ID = Object.fromEntries(
  Object.entries(SIMULATION_REGISTRY).map(([id, meta]) => [meta.label, id])
);

export function getSimulationIdForTitle(title) {
  return LABEL_TO_ID[title] ?? null;
}
