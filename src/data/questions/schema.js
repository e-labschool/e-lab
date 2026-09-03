// The canonical e-Lab question schema, constants, ID convention, and
// validation. This is the ONE place question "shape" is defined — every
// topic file, the registry, and the Q Builder UI all import from here
// rather than re-declaring field lists.
//
// Field-naming note: this keeps the field names already used by the
// existing (working) Q Builder UI — syllabusSection/topic/subtopic,
// questionText, answer/markscheme, tags — and ADDS every field requested
// for the scaled-up bank (curriculum, syllabusVersion, unit, unitTitle,
// topicCode, topicTitle, commandTerms, estimatedMinutes, parts, options,
// correctAnswer, explanation, skills, dataBookletRequired,
// calculatorRequired, diagram/table/graph, status). Nothing conceptually
// requested is missing; a few fields are named to match what the UI
// components already read, to avoid a risky mass rename across the
// existing, working Q Builder. See the project report for the exact
// field-name mapping.

export const LEVELS = ["SL", "HL", "SL/HL"];
export const PAPERS = ["Paper 1A", "Paper 1B", "Paper 2"];
export const SYLLABUS_SECTIONS = ["Structure", "Reactivity"];
export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Challenge"];
export const QUESTION_TYPES = ["MCQ", "Calculation", "Short Response", "Extended Response", "Data-based"];
export const STATUSES = ["draft", "reviewed", "published"];
export const DEFAULT_VISIBLE_STATUSES = ["reviewed", "published"]; // shown by default; drafts hidden until explicitly requested

export const CURRICULUM = "IB DP Chemistry";
export const SYLLABUS_VERSION = "First assessment 2025";
export const SOURCE = "e-Lab Original";

export const COLLECTION_LABEL = "e-Lab Practice Questions";
export const COLLECTION_DISCLAIMER =
  "Original practice material aligned with the IB Diploma Chemistry curriculum. e-Lab is not affiliated with or endorsed by the International Baccalaureate Organization.";

/** EL-[UNITCODE]-[SUBTOPIC MAJOR]-[SEQUENCE], e.g. EL-S1-1-001, EL-R3-4-012. IDs are permanent once assigned. */
export function buildQuestionId(unitCode, subtopic, sequence) {
  const minor = subtopic.split(".")[1] ?? subtopic;
  return `EL-${unitCode}-${minor}-${String(sequence).padStart(3, "0")}`;
}

/** Sums part marks when a question has parts; otherwise returns its own marks field. */
export function getQuestionMarks(question) {
  if (Array.isArray(question.parts) && question.parts.length > 0) {
    return question.parts.reduce((sum, part) => sum + (Number(part.marks) || 0), 0);
  }
  return Number(question.marks) || 0;
}

/**
 * Validates a question against the requirements needed before it can be
 * published. Returns an array of problem strings — empty array means valid.
 * Never throws; callers decide what to do with the problems (log, block
 * publish, flag in a dev view, etc).
 */
export function validateQuestion(question) {
  const problems = [];
  const required = ["id", "topic", "subtopic", "level", "paper", "difficulty", "questionType", "questionText", "status"];
  for (const field of required) {
    if (question[field] === undefined || question[field] === null || question[field] === "") {
      problems.push(`Missing required field: ${field}`);
    }
  }

  const hasParts = Array.isArray(question.parts) && question.parts.length > 0;
  if (!hasParts && (question.marks === undefined || question.marks === null)) {
    problems.push("Missing marks (and no parts array to derive it from)");
  }
  if (!hasParts && !question.markscheme) {
    problems.push("Missing markscheme (and no parts array to derive it from)");
  }
  if (hasParts) {
    const summed = getQuestionMarks(question);
    if (question.marks !== undefined && question.marks !== null && Number(question.marks) !== summed) {
      problems.push(`Parent marks (${question.marks}) does not equal the sum of part marks (${summed})`);
    }
    question.parts.forEach((part, i) => {
      if (!part.questionText) problems.push(`Part ${i + 1}: missing questionText`);
      if (part.marks === undefined || part.marks === null) problems.push(`Part ${i + 1}: missing marks`);
      if (!part.markscheme) problems.push(`Part ${i + 1}: missing markscheme`);
    });
  }

  if (question.questionType === "MCQ") {
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      problems.push("MCQ requires exactly four options");
    }
    if (!question.correctAnswer) {
      problems.push("MCQ requires a correctAnswer");
    }
  }

  if (question.level && !LEVELS.includes(question.level)) {
    problems.push(`Invalid level: ${question.level}`);
  }
  if (question.paper && !PAPERS.includes(question.paper)) {
    problems.push(`Invalid paper: ${question.paper}`);
  }
  if (question.status && !STATUSES.includes(question.status)) {
    problems.push(`Invalid status: ${question.status}`);
  }

  return problems;
}

/**
 * Fills in derived/optional fields with safe defaults so older or
 * partially-specified question objects (e.g. teacher-created questions
 * from before this schema existed) still work everywhere the richer
 * fields are read. Never invents subject-matter content — only
 * structural defaults (empty arrays, null, false).
 */
export function normalizeQuestion(question) {
  return {
    curriculum: CURRICULUM,
    syllabusVersion: SYLLABUS_VERSION,
    commandTerms: [],
    estimatedMinutes: null,
    parts: null,
    options: null,
    correctAnswer: null,
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    diagram: null,
    table: null,
    graph: null,
    source: SOURCE,
    status: "published",
    isCustom: false,
    tags: [],
    ...question,
  };
}
