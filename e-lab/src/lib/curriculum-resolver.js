// The single join point between Layer 3 (curricula) and Layer 1 (concepts).
// Every UI component that needs to render "this subtopic covers these
// concepts" or "this concept appears in these curricula" goes through here
// rather than reading data/curricula and data/concepts directly and joining
// them itself — keeping that logic in exactly one place.

import { getCurriculum, getAllCurricula } from "../data/curricula/index.js";
import { getConcept } from "../data/concepts/index.js";

/** Find a subtopic object by ID within a curriculum map. */
function findSubtopic(curriculumMap, subtopicId) {
  for (const section of curriculumMap.sections) {
    for (const topic of section.topics) {
      const subtopic = topic.subtopics.find((s) => s.id === subtopicId);
      if (subtopic) return { section, topic, subtopic };
    }
  }
  return null;
}

/** Resolve the concept objects (not just IDs) mapped to a given subtopic. */
export function getConceptsForSubtopic(curriculumId, version, subtopicId) {
  const curriculumMap = getCurriculum(curriculumId, version);
  if (!curriculumMap) return [];
  const found = findSubtopic(curriculumMap, subtopicId);
  if (!found) return [];
  return found.subtopic.conceptIds.map((id) => getConcept(id)).filter(Boolean);
}

/** For a concept, find every curriculum location it appears in, across every curriculum. */
export function getCurriculumLocationsForConcept(conceptId) {
  const locations = [];
  for (const curriculumMap of getAllCurricula()) {
    for (const section of curriculumMap.sections) {
      for (const topic of section.topics) {
        for (const subtopic of topic.subtopics) {
          if (subtopic.conceptIds.includes(conceptId)) {
            locations.push({
              curriculum: curriculumMap.curriculum,
              version: curriculumMap.version,
              curriculumLabel: curriculumMap.label,
              sectionLabel: section.label,
              topicLabel: topic.label,
              subtopicId: subtopic.id,
              subtopicLabel: subtopic.label,
            });
          }
        }
      }
    }
  }
  return locations;
}

/** Build the full roadmap tree for a curriculum, with concept titles resolved for display. */
export function buildRoadmap(curriculumId, version) {
  const curriculumMap = getCurriculum(curriculumId, version);
  if (!curriculumMap) return null;

  return {
    id: curriculumMap.id,
    label: curriculumMap.label,
    subject: curriculumMap.subject,
    sections: curriculumMap.sections.map((section) => ({
      id: section.id,
      label: section.label,
      description: section.description,
      topics: section.topics.map((topic) => ({
        id: topic.id,
        label: topic.label,
        subtopics: topic.subtopics.map((subtopic) => ({
          id: subtopic.id,
          label: subtopic.label,
          concepts: subtopic.conceptIds.map((id) => getConcept(id)).filter(Boolean),
        })),
      })),
    })),
  };
}

/** Locate a subtopic's parent section/topic labels (breadcrumb-style), given its ID. */
export function getSubtopicContext(curriculumId, version, subtopicId) {
  const curriculumMap = getCurriculum(curriculumId, version);
  if (!curriculumMap) return null;
  const found = findSubtopic(curriculumMap, subtopicId);
  if (!found) return null;
  return {
    curriculumLabel: curriculumMap.label,
    sectionLabel: found.section.label,
    topicLabel: found.topic.label,
    subtopicLabel: found.subtopic.label,
  };
}
