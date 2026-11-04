import { supabase } from "../../../../lib/supabaseClient.js";
import { SOURCE, SYLLABUS_VERSION } from "../../../../data/questions/schema.js";

// Deliberately its own file, scoped entirely within the (lazy-loaded)
// Question Builder tree — NOT part of questionBankService.js, which is
// also imported eagerly by Admin. Sharing a module across an eager entry
// point and this lazy tree caused Rollup to hoist ~785KB into the main
// bundle; isolating this here keeps that hoisting from happening again,
// regardless of what Admin's service file does independently.
//
// Fetches published Supabase questions and maps them into the EXACT
// shape Question Builder's existing UI/filters already expect (the same
// shape schema.js's normalizeQuestion() produces for legacy JS
// questions). Deliberately reads ONLY public.questions — never
// question_secrets — so no answer/markscheme/explanation data enters
// the normal browsing pool.
export async function getPublishedQuestionsForBuilder() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("questions").select("*").eq("status", "published");
  if (error) throw error;
  return data.map(mapSupabaseQuestionToLegacyShape);
}

function mapSupabaseQuestionToLegacyShape(row) {
  // subtopic ("1.1") and topicCode ("Structure 1.1") are reconstructed to
  // exactly match the real legacy convention — verified directly against
  // an actual legacy question file before writing this, not assumed —
  // so getCurriculumCode() and every existing filter continue to work
  // identically for a Supabase-sourced question.
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
    source: row.source ?? SOURCE,
    syllabusVersion: row.syllabus_version ?? SYLLABUS_VERSION,
    status: row.status,
    skills: [],
    diagram: null, table: null, graph: null,
    isCustom: false,
    isSupabaseQuestion: true, // marks origin — used later for version-pinning when added to a paper
  };
}
