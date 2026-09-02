// Dev-facing coverage audit utility. Not part of the public UI yet.
// Answers: which concepts have no resource mapped at all, and what's the
// overall coverage picture across the concept registry.
//
// Usage (e.g. in a scratch component, a test, or the browser console via
// `import { getUncoveredConcepts, getCoverageStats } from "./lib/coverage.js"`):
//
//   getCoverageStats()
//   -> { total: 102, live: 11, inDevelopment: 24, planned: 67, uncovered: 0 }
//
//   getUncoveredConcepts()
//   -> [] (empty array means 100% of concepts have at least a planned resource)

import { getAllConcepts } from "../data/concepts/index.js";
import { coverageMap } from "../data/coverage-map.js";

export function getUncoveredConcepts() {
  return getAllConcepts().filter((concept) => coverageMap[concept.id]?.coverageStatus === "uncovered");
}

export function getCoverageStats() {
  const concepts = getAllConcepts();
  const stats = { total: concepts.length, live: 0, inDevelopment: 0, planned: 0, uncovered: 0 };

  for (const concept of concepts) {
    const status = coverageMap[concept.id]?.coverageStatus ?? "uncovered";
    if (status === "live") stats.live += 1;
    else if (status === "in-development") stats.inDevelopment += 1;
    else if (status === "planned") stats.planned += 1;
    else stats.uncovered += 1;
  }

  return stats;
}

// Sanity check that every resource's conceptIds actually exist in the
// concept registry (catches typos when new resources are added).
export function validateCoverageMap() {
  const concepts = getAllConcepts();
  const conceptIds = new Set(concepts.map((c) => c.id));
  const problems = [];

  for (const conceptId of Object.keys(coverageMap)) {
    if (!conceptIds.has(conceptId)) {
      problems.push(`Resource references unknown concept ID: "${conceptId}"`);
    }
  }

  return problems;
}
