// The concept<->resource coverage map: "for every chemistry concept, what
// e-Lab resource helps teach or learn it?" This is derived from the resource
// registry (each resource already lists its conceptIds) rather than hand
// duplicated, so the two data files can never drift out of sync.

import { getAllResources } from "./resources-registry.js";
import { getAllConcepts } from "./concepts/index.js";

const STATUS_RANK = { live: 3, "in-development": 2, planned: 1 };

function bestStatus(statuses) {
  return statuses.reduce((best, s) => (STATUS_RANK[s] > STATUS_RANK[best] ? s : best), "planned");
}

// Build conceptId -> { conceptId, resourceIds[], coverageStatus }
function buildCoverageMap() {
  const resources = getAllResources();
  const map = {};

  for (const concept of getAllConcepts()) {
    map[concept.id] = { conceptId: concept.id, resourceIds: [], coverageStatus: null };
  }

  for (const resource of resources) {
    for (const conceptId of resource.conceptIds) {
      if (!map[conceptId]) {
        // A resource references a concept ID that doesn't exist — surfaced in dev via validateCoverageMap().
        map[conceptId] = { conceptId, resourceIds: [], coverageStatus: null };
      }
      map[conceptId].resourceIds.push(resource.id);
    }
  }

  for (const entry of Object.values(map)) {
    entry.coverageStatus =
      entry.resourceIds.length === 0
        ? "uncovered"
        : bestStatus(entry.resourceIds.map((id) => resources.find((r) => r.id === id)?.status ?? "planned"));
  }

  return map;
}

export const coverageMap = buildCoverageMap();

export function getCoverageForConcept(conceptId) {
  return coverageMap[conceptId] ?? { conceptId, resourceIds: [], coverageStatus: "uncovered" };
}

export function getResourcesForConcept(conceptId) {
  const entry = coverageMap[conceptId];
  if (!entry) return [];
  const { getResource } = requireResourcesRegistry();
  return entry.resourceIds.map((id) => getResource(id)).filter(Boolean);
}

// Small indirection to avoid a circular import at module-eval time.
function requireResourcesRegistry() {
  // eslint-disable-next-line global-require
  return { getResource: (id) => getAllResources().find((r) => r.id === id) ?? null };
}

export default coverageMap;
