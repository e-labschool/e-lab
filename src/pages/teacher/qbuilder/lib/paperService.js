import { supabase } from "../../../../lib/supabaseClient.js";

// Scoped entirely within the (lazy-loaded) Question Builder tree — same
// reasoning as supabaseQuestions.js: keeps this new code from being
// shared with anything eager elsewhere in the app.
//
// Core principle: a question_paper_items row NEVER stores full canonical
// question content. A Supabase-sourced question stores only
// question_version_id (resolved once, at add-time, to whatever is
// CURRENTLY the latest published version — then frozen). Everything
// else (legacy JS questions, teacher-authored questions) stores a full
// snapshot in custom_question, since neither has a canonical-versioned
// home of its own.

export async function resolveLatestVersionId(questionId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("question_versions")
    .select("id")
    .eq("question_id", questionId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function getDraftPaper() {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("question_papers")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSavedPapers() {
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from("question_papers")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "saved")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPaper({ title = "Untitled paper", paper = null, level = null, status = "draft" } = {}) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("You need to be signed in.");
  const { data, error } = await supabase
    .from("question_papers")
    .insert({ user_id: userId, title, paper, level, status })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePaperMeta(paperId, patch) {
  if (!supabase) return;
  const { error } = await supabase.from("question_papers").update(patch).eq("id", paperId);
  if (error) throw error;
}

export async function deletePaper(paperId) {
  if (!supabase) return;
  const { error } = await supabase.from("question_papers").delete().eq("id", paperId);
  if (error) throw error;
}

/** A real, independent copy — its own paper row and its own item rows,
 * never sharing rows with the original. */
export async function duplicatePaper(paperId) {
  const { paper, items } = await getPaperItems(paperId);
  const copy = await createPaper({ title: `${paper.title} (copy)`, paper: paper.paper, level: paper.level, status: "saved" });
  for (const item of items) {
    await addItem(copy.id, {
      position: item.position, questionVersionId: item.question_version_id,
      customQuestion: item.custom_question, marksOverride: item.marks_override,
    });
  }
  return copy;
}

/** Raw item rows for a paper, in order — no content resolution yet. */
async function getRawItems(paperId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("question_paper_items").select("*").eq("paper_id", paperId).order("position", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * The pinned-version-rendering guarantee: content for a version-pinned
 * item is read from question_versions.content_snapshot — the immutable
 * snapshot taken when that version was created — NEVER from the live
 * public.questions row. Editing the canonical question later cannot
 * change what a saved paper displays.
 */
export async function getPaperItems(paperId) {
  if (!supabase) return { paper: null, items: [], questions: [] };
  const { data: paper, error: paperError } = await supabase.from("question_papers").select("*").eq("id", paperId).single();
  if (paperError) throw paperError;

  const items = await getRawItems(paperId);
  const versionIds = items.filter((i) => i.question_version_id).map((i) => i.question_version_id);
  let versionsById = {};
  if (versionIds.length > 0) {
    const { data: versions, error: vErr } = await supabase.from("question_versions").select("id, content_snapshot").in("id", versionIds);
    if (vErr) throw vErr;
    versionsById = Object.fromEntries(versions.map((v) => [v.id, v.content_snapshot]));
  }

  const questions = items.map((item) => {
    if (item.question_version_id) {
      const snapshot = versionsById[item.question_version_id] ?? {};
      return {
        id: snapshot.id, topicCode: snapshot.topic_code, topicTitle: snapshot.topic_title,
        level: snapshot.level, paper: snapshot.paper, questionType: snapshot.question_type,
        difficulty: snapshot.difficulty, marks: item.marks_override ?? snapshot.marks,
        commandTerms: snapshot.command_terms ?? [], questionText: snapshot.question_content,
        stimulus: snapshot.visual_data, parts: snapshot.parts, options: snapshot.options,
        tags: snapshot.tags ?? [], correctAnswer: null, explanation: "",
        isSupabaseQuestion: true, paperItemId: item.id,
      };
    }
    // custom_question already IS a full renderable question object,
    // frozen at add-time — used as-is.
    return { ...item.custom_question, marks: item.marks_override ?? item.custom_question?.marks, paperItemId: item.id };
  });

  return { paper, items, questions };
}

export async function addItem(paperId, { position, questionVersionId = null, customQuestion = null, marksOverride = null }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase
    .from("question_paper_items")
    .insert({ paper_id: paperId, position, question_version_id: questionVersionId, custom_question: customQuestion, marks_override: marksOverride })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeItem(paperItemId) {
  if (!supabase) return;
  const { error } = await supabase.from("question_paper_items").delete().eq("id", paperItemId);
  if (error) throw error;
}

export async function updateItemMarksOverride(paperItemId, marksOverride) {
  if (!supabase) return;
  const { error } = await supabase.from("question_paper_items").update({ marks_override: marksOverride }).eq("id", paperItemId);
  if (error) throw error;
}

/** Persists a full reordering — same pattern as Class Planner's lesson blocks. */
export async function reorderItems(orderedPaperItemIds) {
  if (!supabase) return;
  await Promise.all(orderedPaperItemIds.map((id, i) => supabase.from("question_paper_items").update({ position: i }).eq("id", id)));
}
