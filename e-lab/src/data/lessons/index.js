// The lesson registry: for subtopics that have a full e-Lab lesson
// sequence (simple explanation -> analogy -> visual -> scientific
// explanation -> interactive -> Check Yourself), this is the ONLY place
// that content lives. It EXTENDS the existing curriculum/concept system
// rather than duplicating it: learn-tree.js checks this registry first
// when building a subtopic's navigable items, and falls back to the
// subtopic's normal conceptIds-derived concepts when no lesson entry
// exists — so every subtopic without custom lesson content keeps working
// exactly as it did before, unchanged.
//
// A lesson subsection's `id` becomes the concept-equivalent ID used
// throughout the rest of the app (routing, progress, Check Yourself,
// sidebar) — the same way a real concept ID is used elsewhere. These IDs
// are the "e-Lab learning subheadings" explicitly called out as distinct
// from official IB syllabus numbering.
import structure11 from "./structure-1-1.js";

const LESSONS_BY_SUBTOPIC = {
  "structure-1.1": structure11,
};

/** Minimal { id, title, description } list for a subtopic, or null if this subtopic has no custom lesson content. */
export function getLessonSubsections(subtopicId) {
  const lesson = LESSONS_BY_SUBTOPIC[subtopicId];
  if (!lesson) return null;
  return lesson.sections.map((s) => ({ id: s.id, title: s.title, description: s.shortDescription ?? "" }));
}

/** Full lesson content for one subsection ID, or null. */
export function getLessonSubsection(id) {
  for (const lesson of Object.values(LESSONS_BY_SUBTOPIC)) {
    const section = lesson.sections.find((s) => s.id === id);
    if (section) return section;
  }
  return null;
}

/** The subtopic-level completion content (shown after the last subsection), or null. */
export function getLessonCompletion(subtopicId) {
  return LESSONS_BY_SUBTOPIC[subtopicId]?.completion ?? null;
}
