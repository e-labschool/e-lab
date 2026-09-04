// Small pure helpers shared across the Question Bank, Paper Builder, and
// exports — kept separate from both data and UI so the same logic can't
// drift between components.

import { LEVELS, PAPERS, SYLLABUS_SECTIONS, DIFFICULTIES, QUESTION_TYPES, STATUSES } from "../../../../data/questions/schema.js";
import { UNITS, TOPICS } from "../../../../data/questions/unitMeta.js";

// Re-exported from the central schema (single source of truth) so existing
// imports throughout the Q Builder UI keep working unchanged.
export { LEVELS, PAPERS, SYLLABUS_SECTIONS, DIFFICULTIES, QUESTION_TYPES, STATUSES };

// The Question Builder filter panel intentionally exposes a SMALL,
// teacher-facing set of type categories rather than every internal
// questionType value verbatim — "Visual / Diagram" isn't a questionType at
// all in the schema, it's derived from whether a question carries a
// non-text stimulus, so it needs its own matcher rather than a straight
// field comparison. Existing internal types map onto this set 1:1 or
// many:1 (Calculation is its own schema value; everything else maps
// through here so a future new internal type doesn't silently vanish from
// every filter option without a conscious mapping decision).
export const QUESTION_TYPE_GROUPS = [
  { id: "mcq", label: "MCQ", match: (q) => q.questionType === "MCQ" },
  { id: "data-based", label: "Data-based", match: (q) => q.questionType === "Data-based" },
  { id: "calculation", label: "Calculation", match: (q) => q.questionType === "Calculation" },
  { id: "short-response", label: "Short response", match: (q) => q.questionType === "Short Response" },
  { id: "extended-response", label: "Extended response", match: (q) => q.questionType === "Extended Response" },
  { id: "visual", label: "Visual / Diagram", match: (q) => Boolean(q.stimulus) && q.stimulus.type !== "text" },
];

export const QUESTION_TYPE_MATCHERS = QUESTION_TYPE_GROUPS.reduce((acc, g) => {
  acc[g.id] = g.match;
  return acc;
}, {});


// Derived from unitMeta.js (itself derived from the curriculum data) rather
// than hand-maintained here, so this can never drift from the syllabus map.
export const TOPICS_BY_SECTION = SYLLABUS_SECTIONS.reduce((acc, section) => {
  acc[section] = UNITS.filter((u) => u.section === section).map((u) => u.unit);
  return acc;
}, {});
export const SUBTOPICS_BY_TOPIC = UNITS.reduce((acc, u) => {
  acc[u.unit] = TOPICS.filter((t) => t.unit === u.unit).map((t) => t.subtopic);
  return acc;
}, {});

export function calcTotalMarks(questions) {
  return questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
}

export function generateCustomId(baseId) {
  const suffix = Date.now().toString(36).toUpperCase();
  return `CUSTOM-${baseId ? `${baseId}-` : ""}${suffix}`;
}

export function generatePaperId() {
  return `PAPER-${Date.now().toString(36).toUpperCase()}`;
}

export function formatDateStamp(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Derives a compact curriculum code (e.g. "S1.3", "R3.2") straight from the
// question's own syllabusSection + subtopic fields — never hard-coded per
// question. subtopic values already embed the topic number (e.g. "1.3" for
// Structure 1's third subtopic), so this is just section-initial + subtopic.
export function getCurriculumCode(question) {
  const sectionLetter = question.syllabusSection?.[0] ?? "?";
  return `${sectionLetter}${question.subtopic ?? ""}`;
}

// All curriculum codes that exist across the syllabus map — used to
// populate the compact subtopic filter. Derived from unitMeta.js.
export function getAllCurriculumCodes() {
  return TOPICS.map((t) => `${t.section[0]}${t.subtopic}`);
}
