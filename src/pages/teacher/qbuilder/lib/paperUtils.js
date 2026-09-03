// Small pure helpers shared across the Question Bank, Paper Builder, and
// exports — kept separate from both data and UI so the same logic can't
// drift between components.

import { LEVELS, PAPERS, SYLLABUS_SECTIONS, DIFFICULTIES, QUESTION_TYPES, STATUSES } from "../../../../data/questions/schema.js";
import { UNITS, TOPICS } from "../../../../data/questions/unitMeta.js";

// Re-exported from the central schema (single source of truth) so existing
// imports throughout the Q Builder UI keep working unchanged.
export { LEVELS, PAPERS, SYLLABUS_SECTIONS, DIFFICULTIES, QUESTION_TYPES, STATUSES };

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
