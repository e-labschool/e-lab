// Derives unit/topic titles DIRECTLY from the existing DP Chemistry
// curriculum map (src/data/curricula/dp-chemistry/2025.js) — the single
// authoritative source of syllabus structure in e-Lab. This module never
// hard-codes a unit or topic title itself; it reads them, so the question
// bank can never drift out of sync with the curriculum data, and no
// syllabus mapping is ever invented here.

import dpChemistry2025 from "../curricula/dp-chemistry/2025.js";

// Builds: [{ unitCode:"S1", unit:"Structure 1", unitTitle:"...", section:"Structure" }, ...]
export const UNITS = dpChemistry2025.sections.flatMap((section) =>
  section.topics.map((topic) => {
    const unitNumber = topic.id.split("-")[1]; // "structure-1" -> "1"
    return {
      unitCode: `${section.label[0]}${unitNumber}`,
      unit: `${section.label} ${unitNumber}`,
      unitTitle: topic.label,
      section: section.label,
    };
  })
);

// Builds: [{ topicCode:"Structure 1.1", topicTitle:"...", unit:"Structure 1", unitCode:"S1", subtopic:"1.1" }, ...]
export const TOPICS = dpChemistry2025.sections.flatMap((section) =>
  section.topics.flatMap((topic) => {
    const unitNumber = topic.id.split("-")[1];
    return topic.subtopics.map((subtopic) => {
      const subtopicNumber = subtopic.id.split("-")[1]; // "structure-1.1" -> "1.1"
      return {
        topicCode: `${section.label} ${subtopicNumber}`,
        topicTitle: subtopic.label,
        unit: `${section.label} ${unitNumber}`,
        unitCode: `${section.label[0]}${unitNumber}`,
        subtopic: subtopicNumber,
        section: section.label,
      };
    });
  })
);

export function getUnitMeta(unit) {
  return UNITS.find((u) => u.unit === unit) ?? null;
}

export function getTopicMeta(topicCode) {
  return TOPICS.find((t) => t.topicCode === topicCode) ?? null;
}

// "Structure", "1.3" -> "S1.3" (matches the EL-S1-3-### id convention)
export function buildUnitCode(section, subtopic) {
  const majorNumber = subtopic.split(".")[0];
  return `${section[0]}${majorNumber}`;
}
