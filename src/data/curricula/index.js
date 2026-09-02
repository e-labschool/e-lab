// Registry of every curriculum map e-Lab knows about.
// Adding a new curriculum (a new syllabus, a new version, a new programme)
// means adding one entry here — nothing else in the app changes.

import dpChemistry2025 from "./dp-chemistry/2025.js";

const curricula = [dpChemistry2025];

export function getAllCurricula() {
  return curricula;
}

export function getCurriculum(curriculumId, version) {
  return (
    curricula.find((c) => c.curriculum === curriculumId && (!version || c.version === version)) ?? null
  );
}

export function getCurriculumById(id) {
  return curricula.find((c) => c.id === id) ?? null;
}

export default curricula;
