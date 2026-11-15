import { getLiveSimulations } from "./simulationCatalogue.js";

// Which e-Lab simulation engines exist and
// their display label. Both the Learn CMS block picker
// (learnBlockRegistry.jsx re-exports this unchanged) and the shared
// simulation chrome (InteractiveFrame -> SimulationActions,
// SimulationStandalonePage, the /simulation/:simulationId route) read
// from this ONE object, so a new engine is registered in exactly one
// place and every consumer stays in sync automatically.
//
// The id -> label map is now DERIVED from the live entries of the single
// simulation catalogue (simulationCatalogue.js), which also carries the
// per-simulation description, topic, syllabus codes, tier and thumbnail.
// The export shape ({ [id]: { label } }) and key order are unchanged, so
// every existing consumer keeps working.
export const SIMULATION_REGISTRY = Object.fromEntries(
  getLiveSimulations().map((entry) => [entry.id, { label: entry.label }])
);

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
