import { supabase } from "./supabaseClient.js";

// Centralizes every Admin Question Bank DB call. Saving ALWAYS goes
// through save_question_with_secrets() — this file never does a direct
// insert/update on questions or question_secrets, per the architecture.

export async function listQuestions({ filters = {}, page = 1, pageSize = 25 } = {}) {
  if (!supabase) return { rows: [], totalCount: 0 };
  let query = supabase.from("questions").select("*", { count: "exact" });

  if (filters.topicCode) query = query.eq("topic_code", filters.topicCode);
  if (filters.concept) query = query.eq("concept", filters.concept);
  if (filters.level) query = query.eq("level", filters.level);
  if (filters.paper) query = query.eq("paper", filters.paper);
  if (filters.questionType) query = query.eq("question_type", filters.questionType);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    query = query.or(`id.ilike.%${q}%,question_content.ilike.%${q}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: data, totalCount: count ?? 0 };
}

export async function getQuestion(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("questions").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

/**
 * Reads the current secrets for an existing question through the secure
 * admin-only RPC — no direct SELECT on question_secrets exists anymore
 * (the live database revokes that table-level privilege entirely, even
 * for admins). Unlike the previous best-effort version, this THROWS on
 * failure rather than returning null — callers must treat a failed load
 * as blocking, never as "no secrets exist".
 */
export async function getAdminQuestionSecrets(questionId) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.rpc("get_admin_question_secrets", { p_question_id: questionId });
  if (error) throw error;
  return data?.[0] ?? null; // the RPC returns a set; a real question_secrets row is exactly one
}

/** The ONLY write path for questions + question_secrets, per the architecture. */
export async function saveQuestionWithSecrets(fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.rpc("save_question_with_secrets", {
    p_question_id: fields.id,
    p_curriculum_section: fields.curriculumSection,
    p_topic_code: fields.topicCode,
    p_topic_title: fields.topicTitle,
    p_unit_code: fields.unitCode,
    p_unit_title: fields.unitTitle,
    p_concept: fields.concept,
    p_level: fields.level,
    p_paper: fields.paper,
    p_question_type: fields.questionType,
    p_difficulty: fields.difficulty,
    p_marks: fields.marks,
    p_command_terms: fields.commandTerms,
    p_tags: fields.tags,
    p_question_content: fields.questionContent,
    p_visual_data: fields.visualData,
    p_parts: fields.parts,
    p_options: fields.options,
    p_estimated_minutes: fields.estimatedMinutes,
    p_data_booklet_required: fields.dataBookletRequired,
    p_calculator_required: fields.calculatorRequired,
    p_status: fields.status,
    p_correct_answer_data: fields.correctAnswerData,
    p_markscheme: fields.markscheme,
    p_explanation: fields.explanation,
  });
  if (error) throw error;
  return data;
}
