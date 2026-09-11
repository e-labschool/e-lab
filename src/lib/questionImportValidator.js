import { LEVELS, PAPERS, SYLLABUS_SECTIONS, DIFFICULTIES, QUESTION_TYPES, STATUSES } from "../data/questions/schema.js";
import { getLearnTree } from "./learn-tree.js";
import { getAllConcepts } from "../data/concepts/index.js";
import { validateStimulus } from "./stimulusSchema.js";
import { normalizeStimulus } from "./normalizeStimulus.js";

// Reuses the app's real enum lists rather than a second, drifting copy.
// The DB's status check constraint also allows "archived" (schema.js's
// own STATUSES predates that and only lists draft/reviewed/published) —
// extended locally for import validation to match what the database
// will actually accept.
const IMPORT_STATUSES = [...STATUSES, "archived"];

/** Every real, existing e-Lab concept id, sourced from Learn's own tree —
 * never a second, hand-maintained concept list. */
export function getAllConceptIds() {
  const tree = getLearnTree();
  const syllabusIds = tree.sections.flatMap((s) => s.topics.flatMap((t) => t.subtopics.flatMap((sub) => sub.concepts.map((c) => c.id))));
  const legacyConceptIds = getAllConcepts().map((concept) => concept.id);
  return [...new Set([...legacyConceptIds, ...syllabusIds])];
}

const REQUIRED_STRING_FIELDS = [
  "id", "curriculumSection", "topicCode", "topicTitle", "unitCode", "unitTitle",
  "concept", "level", "paper", "questionType", "difficulty", "questionContent", "status",
];

/** Validates ONE question object. Returns an array of error strings — empty means valid. */
export function validateQuestion(q, { allConceptIds, idsInThisBatch }) {
  const errors = [];

  if (!q.id) errors.push("Missing question ID");
  else if (idsInThisBatch.filter((id) => id === q.id).length > 1) errors.push(`Duplicate ID within import: ${q.id}`);

  for (const field of REQUIRED_STRING_FIELDS) {
    if (field === "id") continue; // already checked above
    if (!q[field] || typeof q[field] !== "string") errors.push(`Missing or invalid ${field}`);
  }

  if (q.curriculumSection && !SYLLABUS_SECTIONS.includes(q.curriculumSection)) errors.push(`Invalid curriculum_section: ${q.curriculumSection}`);
  if (q.level && !LEVELS.includes(q.level)) errors.push(`Invalid level: ${q.level}`);
  if (q.paper && !PAPERS.includes(q.paper)) errors.push(`Invalid paper: ${q.paper}`);
  if (q.questionType && !QUESTION_TYPES.includes(q.questionType)) errors.push(`Invalid question_type: ${q.questionType}`);
  if (q.difficulty && !DIFFICULTIES.includes(q.difficulty)) errors.push(`Invalid difficulty: ${q.difficulty}`);
  if (q.status && !IMPORT_STATUSES.includes(q.status)) errors.push(`Invalid status: ${q.status}`);
  if (q.concept && !allConceptIds.includes(q.concept)) errors.push(`Invalid concept: "${q.concept}" is not a recognised e-Lab concept id`);

  if (!q.marks || typeof q.marks !== "number" || q.marks <= 0) errors.push("Marks must be a positive number");

  if (q.questionType === "MCQ") {
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push("MCQ has no options");
    if (!q.correctAnswerData?.value) errors.push("MCQ has no correct answer");
  }

  if (Array.isArray(q.parts) && q.parts.length > 0) {
    const partsTotal = q.parts.reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
    if (partsTotal !== q.marks) errors.push(`Multipart marks don't total parent marks (parts sum to ${partsTotal}, parent marks is ${q.marks})`);
  }

  if (!q.markscheme && q.questionType !== "MCQ") errors.push("Missing markscheme");

  // Reuses the EXACT same schema StimulusRenderer itself validates
  // against — a malformed visualData is rejected here, before the
  // question ever enters the canonical bank, rather than silently
  // importing and only surfacing as "Visual unavailable" in Assess later.
  if (q.visualData) {
    const normalized = normalizeStimulus(q.visualData);
    const { valid, missingField } = validateStimulus(normalized);
    if (!valid) errors.push(`Invalid visualData for ${normalized?.type}: missing or invalid "${missingField}"`);
  }
  if (!q.correctAnswerData && q.questionType === "MCQ") errors.push("Missing correct answer data");

  return errors;
}

/**
 * Validates a full batch: per-question structural/schema errors only.
 * NEW/UNCHANGED/UPDATE classification is NOT computed here anymore — it
 * requires comparing against secret fields (correct_answer_data,
 * markscheme, explanation) that this frontend code has no access to by
 * design. See classifyQuestionImport() in questionBankService.js, which
 * calls the server-side classify_question_import() RPC instead.
 */
export function validateBatch(questions) {
  const allConceptIds = getAllConceptIds();
  const idsInThisBatch = questions.map((q) => q.id).filter(Boolean);

  return questions.map((q) => {
    const errors = validateQuestion(q, { allConceptIds, idsInThisBatch });
    return { question: q, errors, isValid: errors.length === 0 };
  });
}
