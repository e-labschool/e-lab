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
    .order("display_order", { ascending: true }).order("id", { ascending: true });
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
  const results = await Promise.all(orderedBlockIds.map((id, i) => supabase.from("learn_blocks").update({ position: i }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// ============================================================
// Learn media — Admin uploads only; published URLs are public content.
// ============================================================

const LEARN_MEDIA_BUCKET = "learn-media";
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function validateLearnMediaFile(file, kind) {
  if (!file) return "Choose a file first.";
  const allowed = kind === "image" ? IMAGE_TYPES : VIDEO_TYPES;
  const maxBytes = kind === "image" ? 8 * 1024 * 1024 : 100 * 1024 * 1024;
  if (!allowed.has(file.type)) return kind === "image" ? "Use PNG, JPG, WEBP or GIF." : "Use MP4, WEBM or MOV.";
  if (file.size > maxBytes) return kind === "image" ? "Image must be 8 MB or smaller." : "Video must be 100 MB or smaller.";
  return null;
}

export async function uploadLearnMedia(pageId, blockId, file, kind) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const validationError = validateLearnMediaFile(file, kind);
  if (validationError) throw new Error(validationError);
  const ext = (file.name.split(".").pop() || (kind === "image" ? "jpg" : "mp4")).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const path = `lessons/${pageId}/${blockId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(LEARN_MEDIA_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(LEARN_MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, fileName: file.name, mimeType: file.type };
}

// ============================================================
// Admin: Check Your Understanding — canonical + manual items
// ============================================================

export async function listCheckQuestions(pageId) {
  if (!supabase) return [];
  const [{ data: canonical, error: canonicalError }, { data: manual, error: manualError }] = await Promise.all([
    supabase.from("learn_check_questions").select("*").eq("page_id", pageId).order("position", { ascending: true }),
    supabase.from("learn_manual_questions").select("*").eq("page_id", pageId).order("position", { ascending: true }),
  ]);
  // Backward compatibility while the incremental manual-question migration has not been run yet.
  if (canonicalError) throw canonicalError;
  if (manualError && !["42P01", "PGRST205"].includes(manualError.code) && !String(manualError.message || "").includes("learn_manual_questions")) throw manualError;

  const canonicalItems = (canonical ?? []).map((row) => ({ ...row, source_type: "canonical", item_id: row.id }));
  const manualItems = (manual ?? []).map((row) => ({ ...row, source_type: "manual", item_id: row.id }));
  return [...canonicalItems, ...manualItems].sort((a, b) => (a.position - b.position) || String(a.id).localeCompare(String(b.id)));
}

export async function addCheckQuestion(pageId, { questionId, questionVersionId, position }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase
    .from("learn_check_questions")
    .insert({ page_id: pageId, question_id: questionId, question_version_id: questionVersionId, position })
    .select()
    .single();
  if (error) throw error;
  return { ...data, source_type: "canonical", item_id: data.id };
}

export async function addManualCheckQuestion(pageId, question, position) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const payload = {
    page_id: pageId,
    question_type: question.questionType,
    question_text: question.questionText.trim(),
    options: question.questionType === "mcq" ? question.options : [],
    position,
  };
  const { data, error } = await supabase.rpc("admin_save_learn_manual_question", {
    p_question_id: null,
    p_page_id: pageId,
    p_question: payload,
    p_correct_answer_data: question.correctAnswerData,
    p_explanation: question.explanation?.trim() || null,
  });
  if (error) throw error;
  return { ...data, source_type: "manual", item_id: data.id };
}

export async function getAdminManualCheckSecret(rowId) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.rpc("get_admin_learn_manual_question_secret", { p_question_id: rowId });
  if (error) throw error;
  return data ?? null;
}

export async function updateManualCheckQuestion(rowId, pageId, question) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.rpc("admin_save_learn_manual_question", {
    p_question_id: rowId,
    p_page_id: pageId,
    p_question: {
      page_id: pageId,
      question_type: question.questionType,
      question_text: question.questionText.trim(),
      options: question.questionType === "mcq" ? question.options : [],
    },
    p_correct_answer_data: question.correctAnswerData,
    p_explanation: question.explanation?.trim() || null,
  });
  if (error) throw error;
  return { ...data, source_type: "manual", item_id: data.id };
}

export async function removeCheckQuestion(item) {
  if (!supabase) return;
  const table = item.source_type === "manual" ? "learn_manual_questions" : "learn_check_questions";
  const { error } = await supabase.from(table).delete().eq("id", item.id);
  if (error) throw error;
}

export async function reorderCheckQuestions(items) {
  if (!supabase) return;
  const results = await Promise.all(items.map((item, i) => {
    const table = item.source_type === "manual" ? "learn_manual_questions" : "learn_check_questions";
    return supabase.from(table).update({ position: i }).eq("id", item.id);
  }));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// ============================================================
// Student: reading published content
// ============================================================

/** Lightweight metadata ONLY — for the sidebar. Never fetches blocks. */
export async function listPublishedLessonMeta() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learn_pages")
    .select("id, parent_topic, lesson_code, title, level, display_order")
    .eq("status", "published")
    .order("display_order", { ascending: true }).order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getPublishedLesson(pageId) {
  if (!supabase) return null;
  const [{ data: page, error: pageError }, blocks, checkItems] = await Promise.all([
    supabase.from("learn_pages").select("*").eq("id", pageId).eq("status", "published").single(),
    listVisibleBlocks(pageId),
    getPublishedLearnCheckItems(pageId),
  ]);
  if (pageError) throw pageError;
  return { page, blocks, checkQuestions: checkItems };
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

export async function getPublishedLearnCheckItems(pageId) {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_learn_check_items", { p_page_id: pageId });
  if (error) {
    // Before the incremental migration, preserve the old UI rather than crashing.
    if (error.code === "42883" || String(error.message || "").includes("get_learn_check_items")) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.item_id,
    item_id: row.item_id,
    source_type: row.source_type,
    question_id: row.question_id,
    position: row.position,
    question: row.question_content,
  }));
}

/** Secure, stateless Learn marking. The server identifies canonical/manual
 * source by the verified item assignment; no answer secrets are fetched by
 * the browser before submission. */
export async function submitLearnCheckAnswers(pageId, items) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.rpc("mark_learn_check_answers", {
    p_page_id: pageId,
    p_items: items.map((i) => ({
      item_id: i.itemId,
      source_type: i.sourceType,
      question_id: i.questionId ?? null,
      student_answer: i.studentAnswer,
    })),
  });
  if (error) throw error;
  return data ?? [];
}
