import { supabase } from "./supabaseClient.js";
import { getQuestionById } from "../data/questions/index.js";

// Neutral shared service under src/lib/ — deliberately NOT under
// pages/teacher/qbuilder/, and NOT imported by Question Builder. Question
// Builder has its own equivalent (lib/supabaseQuestions.js,
// lib/paperService.js) which is left untouched, per instruction. Some
// logic here is intentionally duplicated rather than shared with Q
// Builder's files, since coupling Assess to Teacher-specific modules was
// explicitly ruled out.

/**
 * Published Supabase questions, mapped into the same renderable shape
 * legacy JS questions already use (topicCode/subtopic/questionText/etc),
 * so curateChallenge()'s existing eligibility/matching logic works
 * unchanged against either source. Reads ONLY public.questions — never
 * question_secrets — so no answer/markscheme/explanation data enters the
 * pool a student's browser ever receives.
 */
export async function getPublishedCanonicalQuestions() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("questions").select("*").eq("status", "published");
  if (error) throw error;
  return data.map(mapToRenderableQuestion);
}

function mapToRenderableQuestion(row) {
  // subtopic/topicCode reconstructed to match the real legacy convention
  // exactly (verified against actual legacy question data previously,
  // not re-derived here) — same rule as Q Builder's independent mapper.
  const subtopic = row.topic_code.replace(/^[A-Z]/, "");
  const topicCode = row.unit_title + subtopic.substring(subtopic.indexOf("."));

  return {
    id: row.id,
    syllabusSection: row.curriculum_section,
    topic: row.unit_title,
    subtopic,
    topicCode,
    level: row.level,
    paper: row.paper,
    questionType: row.question_type,
    difficulty: row.difficulty,
    marks: row.marks,
    commandTerms: row.command_terms ?? [],
    questionText: row.question_content,
    stimulus: row.visual_data,
    parts: row.parts,
    options: row.options,
    correctAnswer: null, // never fetched here — lives in question_secrets
    explanation: "", // never fetched here — lives in question_secrets
    tags: row.tags ?? [],
    estimatedMinutes: row.estimated_minutes,
    dataBookletRequired: row.data_booklet_required,
    calculatorRequired: row.calculator_required,
    source: row.source,
    syllabusVersion: row.syllabus_version,
    status: row.status,
    skills: [],
    diagram: null, table: null, graph: null,
    isCustom: false,
    isSupabaseQuestion: true, // marks origin — used for version pinning at challenge-creation time
  };
}

/**
 * Batch-resolves the CURRENT latest published version id for every given
 * question id in ONE query, regardless of how many are requested — never
 * one query per question. Returns a { [questionId]: versionId } map;
 * a question id with no resolvable version is simply absent from the
 * result, so callers can detect and fail on a missing entry explicitly
 * rather than silently treating it as legacy.
 */
export async function resolveLatestVersionIds(questionIds) {
  if (!supabase || questionIds.length === 0) return {};
  const uniqueIds = [...new Set(questionIds)];
  const { data, error } = await supabase
    .from("question_versions")
    .select("question_id, id, version_number")
    .in("question_id", uniqueIds)
    .order("version_number", { ascending: false });
  if (error) throw error;

  const result = {};
  for (const row of data) {
    // Rows arrive ordered by version_number descending, so the FIRST
    // occurrence per question_id is guaranteed to be its latest version —
    // subsequent rows for the same id are older versions, skipped.
    if (!(row.question_id in result)) result[row.question_id] = row.id;
  }
  return result;
}

/**
 * The merged question pool Assess selects from: legacy JS questions plus
 * published Supabase questions, with Supabase taking precedence on ID
 * collision — the same rule already used in Question Builder, applied
 * independently here since Assess must not import Question Builder code.
 */
export function mergeWithSupabasePrecedence(legacyQuestions, supabaseQuestions) {
  const supabaseIds = new Set(supabaseQuestions.map((q) => q.id));
  return [...legacyQuestions.filter((q) => !supabaseIds.has(q.id)), ...supabaseQuestions];
}

/**
 * Hydrates challenge_questions rows for STUDENT-FACING display —
 * ChallengeSession and ChallengeReport both use this instead of looking
 * a question up by plain question_id, since a legacy-JS id lookup can
 * silently diverge from the exact content that was securely pinned and
 * marked at submission time.
 *
 * Rule, per row:
 *   question_version_id IS NOT NULL -> content comes ONLY from that
 *     exact question_versions.content_snapshot (never the live
 *     public.questions row, never the legacy JS bank, even if the ids match).
 *   question_version_id IS NULL -> genuine legacy row, existing
 *     getQuestionById() compatibility path, unchanged.
 *
 * Batches ALL needed version snapshots in ONE query regardless of how
 * many pinned rows are in the challenge — never one request per question.
 * Reads only content_snapshot — never question_version_secrets, never
 * correct_answer_data/markscheme/explanation.
 *
 * Returns a Map keyed by challenge_questions.id (the row id, stable and
 * unique even if the same question_id somehow appeared twice), so
 * callers never need to re-derive matching logic themselves.
 */
export async function hydrateChallengeQuestions(rows) {
  const versionIds = [...new Set(rows.filter((r) => r.question_version_id).map((r) => r.question_version_id))];
  let snapshotsById = {};
  if (versionIds.length > 0 && supabase) {
    const { data, error } = await supabase.from("question_versions").select("id, content_snapshot").in("id", versionIds);
    if (error) throw error;
    snapshotsById = Object.fromEntries(data.map((v) => [v.id, v.content_snapshot]));
  }

  const result = new Map();
  for (const row of rows) {
    if (row.question_version_id) {
      const snapshot = snapshotsById[row.question_version_id];
      result.set(row.id, snapshot ? mapToRenderableQuestion(snapshot) : null);
    } else {
      result.set(row.id, getQuestionById(row.question_id));
    }
  }
  return result;
}

/**
 * Post-submission secure review content for a canonical challenge — a
 * thin wrapper around the get_review_content RPC, which itself only
 * returns data for a challenge the caller owns and that is genuinely
 * submitted (returns nothing otherwise, by the RPC's own design). Never
 * queries question_version_secrets directly — this is the only path.
 */
export async function getCanonicalReviewContent(challengeId) {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_review_content", { p_challenge_id: challengeId });
  if (error) throw error;
  return data ?? [];
}
