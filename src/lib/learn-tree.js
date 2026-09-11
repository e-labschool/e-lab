// Builds the Learn sidebar's tree directly from buildRoadmap() (the same
// resolver /explore and the old Learn page already used) — this is not a
// second curriculum database. It only adds DISPLAY codes like "S1.1.1",
// derived purely from each concept's position within its subtopic's
// existing conceptIds ordering (already the single source of truth in
// src/data/curricula/dp-chemistry/2025.js). No concept is added, removed,
// or renumbered independently of that ordering — if that file's concept
// list for a subtopic changes, these codes shift accordingly and nothing
// here needs to change.
import { buildRoadmap } from "./curriculum-resolver.js";
import { getLessonSubsections } from "../data/lessons/index.js";

let cachedTree = null;

export function getLearnTree() {
  if (cachedTree) return cachedTree;

  const roadmap = buildRoadmap("dp-chemistry", "2025");
  if (!roadmap) return null;

  let totalConcepts = 0;
  const conceptIndex = new Map(); // conceptId -> { concept, section, topic, subtopic, code, flatIndex }
  const flatOrder = [];

  const sections = roadmap.sections.map((section) => {
    const sectionShort = section.label; // "Structure" | "Reactivity"
    const topics = section.topics.map((topic) => {
      const unitNumber = topic.id.split("-")[1]; // "structure-1" -> "1"
      const unitCode = `${sectionShort[0]}${unitNumber}`; // "S1", "R2"
      const subtopics = topic.subtopics.map((subtopic) => {
        const subtopicNumber = subtopic.id.split("-")[1]; // "structure-1.1" -> "1.1"
        const subtopicCode = `${sectionShort[0]}${subtopicNumber}`; // "S1.1"
        // A subtopic with a full e-Lab lesson sequence (see
        // src/data/lessons) uses its lesson subsections as the navigable
        // items instead of the raw conceptIds list — everything below
        // (codes, progress, sidebar, adjacent-nav) works identically
        // either way, since both shapes provide { id, title }.
        const sourceItems = getLessonSubsections(subtopic.id) ?? subtopic.concepts;
        const concepts = sourceItems.map((concept, i) => {
          const code = `${subtopicCode}.${i + 1}`; // "S1.1.1"
          totalConcepts += 1;
          const entry = { concept, code, sectionLabel: sectionShort, topicLabel: topic.label, subtopicLabel: subtopic.label, subtopicCode, subtopicId: subtopic.id };
          conceptIndex.set(concept.id, entry);
          flatOrder.push(concept.id);
          return { ...concept, code };
        });
        return { id: subtopic.id, code: subtopicCode, label: subtopic.label, concepts };
      });
      return { id: topic.id, code: unitCode, label: topic.label, subtopics };
    });
    return { id: section.id, label: sectionShort, description: section.description, topics };
  });

  cachedTree = { sections, totalConcepts, conceptIndex, flatOrder };
  return cachedTree;
}

/** Full context (section/topic/subtopic labels + display code) for one concept, or null. */
export function getConceptContext(conceptId) {
  const tree = getLearnTree();
  return tree?.conceptIndex.get(conceptId) ?? null;
}

/** The concept immediately before/after this one in curriculum order, or null at the ends. */
export function getAdjacentConcepts(conceptId) {
  const tree = getLearnTree();
  if (!tree) return { previous: null, next: null };
  const idx = tree.flatOrder.indexOf(conceptId);
  if (idx === -1) return { previous: null, next: null };
  const previousId = idx > 0 ? tree.flatOrder[idx - 1] : null;
  const nextId = idx < tree.flatOrder.length - 1 ? tree.flatOrder[idx + 1] : null;
  return {
    previous: previousId ? tree.conceptIndex.get(previousId) : null,
    next: nextId ? tree.conceptIndex.get(nextId) : null,
  };
}

/** All concept IDs belonging to one topic (e.g. all of "structure-1"), for milestone/progress rollups. */
export function getConceptIdsForTopic(topicId) {
  const tree = getLearnTree();
  if (!tree) return [];
  for (const section of tree.sections) {
    const topic = section.topics.find((t) => t.id === topicId);
    if (topic) return topic.subtopics.flatMap((s) => s.concepts.map((c) => c.id));
  }
  return [];
}

/**
 * Best-effort "Learn This Concept" link target for a Question Bank
 * question — questions are tagged to a subtopic (e.g. "Structure 1.2"),
 * not a single specific concept, so this resolves to the FIRST concept
 * within that subtopic rather than inventing a precise mapping the data
 * doesn't support. Disclosed as an approximation, not exact.
 */
export function getFirstConceptIdForSubtopicCode(subtopicCode) {
  const tree = getLearnTree();
  if (!tree || !subtopicCode) return null;
  for (const section of tree.sections) {
    for (const topic of section.topics) {
      const subtopic = topic.subtopics.find((s) => s.code === subtopicCode);
      if (subtopic?.concepts.length) return subtopic.concepts[0].id;
    }
  }
  return null;
}

/** Aggregate completed/total counts for an arbitrary list of concept IDs — used for topic/section rollups and milestones. Lives here (a plain data module) rather than in ProgressContext.jsx (a React provider) so pure logic never depends on a .jsx file. */
export function summarizeProgress(progress, conceptIds) {
  let completed = 0, inProgress = 0;
  for (const id of conceptIds) {
    const status = progress[id]?.status;
    if (status === "completed") completed += 1;
    else if (status === "in_progress") inProgress += 1;
  }
  return { completed, inProgress, total: conceptIds.length };
}
