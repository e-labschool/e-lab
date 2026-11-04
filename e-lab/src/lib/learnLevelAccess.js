import { getSyllabusPointLevel } from "../data/curricula/dp-chemistry/syllabus-points-2025.js";

export function normalizeStudentLevel(level) {
  return String(level || "SL").trim().toUpperCase() === "HL" ? "HL" : "SL";
}

// IB DP HL includes the shared/SL course content plus AHL content.
// Therefore an HL student can see every published Learn lesson; an SL
// student must never see a lesson explicitly marked HL-only.
export function canStudentAccessLessonLevel(studentLevel, lessonLevel) {
  const learner = normalizeStudentLevel(studentLevel);
  const lesson = String(lessonLevel || "SL/HL").trim().toUpperCase();
  if (learner === "HL") return true;
  return lesson !== "HL";
}

// Block audience is intentionally only "both" or "hl". There is no
// "SL-only" block because HL learners must also receive all SL content.
export function canStudentAccessBlock(studentLevel, block) {
  const learner = normalizeStudentLevel(studentLevel);
  if (learner === "HL") return true;
  const audience = String(block?.content?.audience || "both").toLowerCase();
  return audience !== "hl";
}

export function filterBlocksForStudent(blocks, studentLevel) {
  return (blocks || []).filter((block) => canStudentAccessBlock(studentLevel, block));
}

export function filterSyllabusCodesForStudent(codes, studentLevel) {
  const learner = normalizeStudentLevel(studentLevel);
  const normalized = [...new Set((Array.isArray(codes) ? codes : [codes]).filter(Boolean).map((code) => String(code).trim().toUpperCase()))];
  if (learner === "HL") return normalized;
  return normalized.filter((code) => getSyllabusPointLevel(code) !== "HL");
}

export function orderFieldForStudentLevel(studentLevel) {
  return normalizeStudentLevel(studentLevel) === "HL" ? "display_order_hl" : "display_order_sl";
}

export function lessonOrderValue(lesson, studentLevel) {
  const field = orderFieldForStudentLevel(studentLevel);
  return lesson?.[field] ?? lesson?.display_order ?? 0;
}

export function canStudentAccessResourceLevel(studentLevel, resourceLevel) {
  const learner = normalizeStudentLevel(studentLevel);
  if (learner === "HL") return true;
  const level = String(resourceLevel || "").trim().toUpperCase();
  return !level || level === "SL" || level === "SL/HL" || level === "SL & HL" || level === "BOTH";
}

export function canStudentAccessQuestionLevel(studentLevel, questionLevel) {
  return canStudentAccessLessonLevel(studentLevel, questionLevel || "SL/HL");
}
