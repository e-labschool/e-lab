import { supabase } from "./supabaseClient.js";

// ============================================================
// Admin: lesson (learn_pages) CRUD
// ============================================================

export async function listLessonsForTopic(parentTopic) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learn_pages")
    .select("*")
    .eq("parent_topic", parentTopic)
    .order("display_order", { ascending: true }).order("id", { ascending: true }); // id as a stable tiebreaker
  if (error) throw error;
  return data;
}

export async function getLesson(pageId) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("learn_pages").select("*").eq("id", pageId).single();
  if (error) throw error;
  return data;
}

export async function createLesson(fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("learn_pages")
    .insert({
      parent_topic: fields.parentTopic, lesson_code: fields.lessonCode, title: fields.title,
      level: fields.level, display_order: fields.displayOrder ?? 0, status: "draft",
      created_by: userData?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLesson(pageId, fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase
    .from("learn_pages")
    .update({
      parent_topic: fields.parentTopic, lesson_code: fields.lessonCode, title: fields.title,
      level: fields.level, display_order: fields.displayOrder,
    })
    .eq("id", pageId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveLessonAsDraft(pageId) {
  if (!supabase) return;
  const { error } = await supabase.from("learn_pages").update({ status: "draft" }).eq("id", pageId);
  if (error) throw error;
}

export async function publishLesson(pageId) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.rpc("publish_learn_page", { p_page_id: pageId });
  if (error) throw error;
  return data;
}

export async function deleteLesson(pageId) {
  if (!supabase) return;
  const { error } = await supabase.from("learn_pages").delete().eq("id", pageId);
  if (error) throw error;
}

// ============================================================
// Admin: block CRUD
// ============================================================

export async function listBlocks(pageId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("learn_blocks").select("*").eq("page_id", pageId).order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createBlock(pageId, { blockType, content, position }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase
    .from("learn_blocks")
    .insert({ page_id: pageId, block_type: blockType, content, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBlock(blockId, patch) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.from("learn_blocks").update(patch).eq("id", blockId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBlock(blockId) {
  if (!supabase) return;
  const { error } = await supabase.from("learn_blocks").delete().eq("id", blockId);
  if (error) throw error;
}

export async function reorderBlocks(orderedBlockIds) {
  if (!supabase) return;
  await Promise.all(orderedBlockIds.map((id, i) => supabase.from("learn_blocks").update({ position: i }).eq("id", id)));
}

// ============================================================
// Admin: Check Your Understanding question selection
// ============================================================

export async function listCheckQuestions(pageId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("learn_check_questions").select("*").eq("page_id", pageId).order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addCheckQuestion(pageId, { questionId, questionVersionId, position }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase
    .from("learn_check_questions")
    .insert({ page_id: pageId, question_id: questionId, question_version_id: questionVersionId, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeCheckQuestion(rowId) {
  if (!supabase) return;
  const { error } = await supabase.from("learn_check_questions").delete().eq("id", rowId);
  if (error) throw error;
}

export async function reorderCheckQuestions(orderedRowIds) {
  if (!supabase) return;
  await Promise.all(orderedRowIds.map((id, i) => supabase.from("learn_check_questions").update({ position: i }).eq("id", id)));
}

// ============================================================
// Student: reading published content
// ============================================================

/** Lightweight metadata ONLY (id/parent_topic/lesson_code/title/order) —
 * for the sidebar. Never fetches blocks. */
export async function listPublishedLessonMeta() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learn_pages")
    .select("id, parent_topic, lesson_code, title, level, display_order")
    .eq("status", "published")
    .order("display_order", { ascending: true }).order("id", { ascending: true }); // id as a stable tiebreaker
  if (error) throw error;
  return data;
}

export async function getPublishedLesson(pageId) {
  if (!supabase) return null;
  const [{ data: page, error: pageError }, blocks, checkQuestions] = await Promise.all([
    supabase.from("learn_pages").select("*").eq("id", pageId).eq("status", "published").single(),
    listVisibleBlocks(pageId),
    listCheckQuestions(pageId),
  ]);
  if (pageError) throw pageError;
  return { page, blocks, checkQuestions };
}

async function listVisibleBlocks(pageId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learn_blocks")
    .select("*")
    .eq("page_id", pageId)
    .eq("visible", true)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

/** Submits Check Your Understanding answers for immediate, secure
 * feedback — never touches student_challenges/Progress. The RPC itself
 * verifies the page is published and that each question is genuinely
 * assigned to it, using the ASSIGNED version for marking — a client
 * cannot target an arbitrary question/version. */
export async function submitLearnCheckAnswers(pageId, items) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.rpc("mark_learn_check_answers", {
    p_page_id: pageId,
    p_items: items.map((i) => ({ question_id: i.questionId, student_answer: i.studentAnswer })),
  });
  if (error) throw error;
  return data;
}
