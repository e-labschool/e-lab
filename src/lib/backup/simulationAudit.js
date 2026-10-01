// Complete Disaster Recovery — simulation audit (spec §3-8).
//
// A Learn content block with block_type "simulation" only ever stores a
// REFERENCE/PLACEMENT — `content.simulationId` (see
// src/data/learnBlockRegistry.jsx's "simulation" entry and
// src/components/learn/LearnBlockRenderer.jsx's "simulation" case, both
// audited directly rather than assumed). The actual simulation
// IMPLEMENTATION lives in application source, under src/engines/<name>/,
// wired to its registry id in src/data/simulationEngineComponents.js
// (SIMULATION_COMPONENTS) and labeled in src/data/simulationRegistry.js
// (SIMULATION_REGISTRY) — both audited directly, not assumed. Every
// simulation's supporting dataset (element/isotope/spectral/ionization
// data, etc.) was audited under src/engines/<name>/data/ and src/data/
// chemistry/ — every one found is a plain source-controlled .js file,
// never a Supabase table or Storage object, so datasets are a
// SOURCE-CONTROLLED DEPENDENCY protected by Git, not something this
// backup needs to duplicate (spec §8: "Do not duplicate source-
// controlled files into the ZIP unless there is a clear recovery
// reason" — there is none here).
//
// This module builds the three-way cross-check spec §5/§7 asks for:
// REFERENCES (from backed-up Learn content) vs IMPLEMENTATION (from the
// application's own simulation registry) vs DATASETS (source-controlled,
// reported for completeness, never packaged).
import { SIMULATION_REGISTRY } from "../../data/simulationRegistry.js";
import { SIMULATION_COMPONENTS } from "../../data/simulationEngineComponents.js";

/**
 * @param {object} contentBackup - the object returned by exportElabContent()
 *   (has .data.learn_pages and .data.learn_blocks, the raw table rows).
 * @returns {{
 *   referencedBlocks: number,
 *   uniqueSimulations: number,
 *   verifiedImplementations: number,
 *   missingImplementations: number,
 *   registrySize: number,
 *   unreferencedInRegistry: string[],
 *   items: Array<{simulationId, pages, pageTitles, referencedBlocks, implementationLocation, datasets, status}>
 * }}
 */
export function auditSimulations(contentBackup) {
  const blocks = contentBackup?.data?.learn_blocks || [];
  const pages = contentBackup?.data?.learn_pages || [];
  const pageById = new Map(pages.map((p) => [p.id, p]));

  const simBlocks = blocks.filter((b) => b.block_type === "simulation");

  // Group every referencing block by the simulationId it names. A block
  // whose content.simulationId is unset (the CMS's own empty default,
  // "Select a simulation" never chosen) is not a real reference and is
  // excluded, same as the CMS itself treats it (learnBlockRegistry.jsx
  // defaultContent: { simulationId: "" }).
  const bySimId = new Map();
  for (const b of simBlocks) {
    const simId = b.content?.simulationId;
    if (!simId) continue;
    if (!bySimId.has(simId)) bySimId.set(simId, []);
    const page = pageById.get(b.page_id);
    bySimId.get(simId).push({ blockId: b.id, pageId: b.page_id, pageTitle: page?.title ?? null });
  }

  const implementedIds = new Set(Object.keys(SIMULATION_COMPONENTS));

  const items = [];
  let verified = 0;
  let missing = 0;
  for (const [simId, refs] of bySimId.entries()) {
    const hasImplementation = implementedIds.has(simId);
    const status = hasImplementation ? "verified" : "missing";
    if (hasImplementation) verified += 1;
    else missing += 1;
    items.push({
      simulationId: simId,
      registeredLabel: SIMULATION_REGISTRY[simId]?.label ?? null,
      pages: [...new Set(refs.map((r) => r.pageId))],
      pageTitles: [...new Set(refs.map((r) => r.pageTitle).filter(Boolean))],
      referencedBlocks: refs.length,
      implementationLocation: hasImplementation
        ? `src/engines/ (lazy-loaded component registered in src/data/simulationEngineComponents.js — protected by the Git repository, not this backup)`
        : null,
      datasets: "Any supporting dataset for this simulation lives in its own src/engines/<name>/data/ directory (or src/data/chemistry/) as source-controlled .js files, protected by the Git repository.",
      status,
    });
  }

  const unreferencedInRegistry = [...implementedIds].filter((id) => !bySimId.has(id));

  return {
    referencedBlocks: simBlocks.length,
    uniqueSimulations: bySimId.size,
    verifiedImplementations: verified,
    missingImplementations: missing,
    registrySize: implementedIds.size,
    unreferencedInRegistry,
    items,
  };
}
