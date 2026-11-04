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

/**
 * Shared hydration logic — the pinned-version-rendering guarantee: a
 * version-pinned item's content comes ONLY from its resolved
 * question_versions.content_snapshot, never from the live public.questions
 * row. Used by both getPaperItems() (single paper) and listSavedPapers()
 * (many papers, batched) so there is exactly one reconstruction rule,
 * not two that could quietly drift apart.
 */
function hydrateItems(items, versionsById) {
  return items.map((item) => {
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
}

/** Fetches question_versions content for a set of version ids in ONE
 * query, returned as an id-keyed lookup map. Shared by both hydration
 * call sites below. */
async function fetchVersionsById(versionIds) {
  if (versionIds.length === 0) return {};
  const { data: versions, error } = await supabase.from("question_versions").select("id, content_snapshot").in("id", versionIds);
  if (error) throw error;
  return Object.fromEntries(versions.map((v) => [v.id, v.content_snapshot]));
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

/**
 * Returns SAVED papers already hydrated with a `questions` array (and
 * therefore a correct `questions.length` / total-marks), not raw rows —
 * this is what My Papers actually renders. Exactly 3 queries total
 * regardless of how many papers exist (papers, all their items in one
 * call, all needed versions in one call) — no N+1.
 */
export async function listSavedPapers() {
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return [];
  const { data: papers, error } = await supabase
    .from("question_papers")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "saved")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (papers.length === 0) return [];

  const paperIds = papers.map((p) => p.id);
  const { data: allItems, error: itemsError } = await supabase
    .from("question_paper_items")
    .select("*")
    .in("paper_id", paperIds)
    .order("position", { ascending: true });
  if (itemsError) throw itemsError;

  const versionIds = [...new Set(allItems.filter((i) => i.question_version_id).map((i) => i.question_version_id))];
  const versionsById = await fetchVersionsById(versionIds);

  const itemsByPaper = {};
  for (const item of allItems) {
    (itemsByPaper[item.paper_id] ??= []).push(item);
  }

  return papers.map((p) => ({ ...p, questions: hydrateItems(itemsByPaper[p.id] ?? [], versionsById) }));
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
 * never sharing rows with the original. Returns the copy already
 * hydrated with its `questions` array, via the same shared hydration
 * path as everywhere else — not a raw row, since this return value is
 * pushed directly into myPapers state by the caller. */
export async function duplicatePaper(paperId) {
  const { paper, items } = await getPaperItems(paperId);
  const copy = await createPaper({ title: `${paper.title} (copy)`, paper: paper.paper, level: paper.level, status: "saved" });
  for (const item of items) {
    await addItem(copy.id, {
      position: item.position, questionVersionId: item.question_version_id,
      customQuestion: item.custom_question, marksOverride: item.marks_override,
    });
  }
  const hydrated = await getPaperItems(copy.id);
  return { ...copy, questions: hydrated.questions };
}

/** Raw item rows for a paper, in order — no content resolution yet. */
async function getRawItems(paperId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("question_paper_items").select("*").eq("paper_id", paperId).order("position", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Single-paper hydration — same guarantee, same shared reconstruction
 * rule as listSavedPapers() above (hydrateItems), just for one paper.
 */
export async function getPaperItems(paperId) {
  if (!supabase) return { paper: null, items: [], questions: [] };
  const { data: paper, error: paperError } = await supabase.from("question_papers").select("*").eq("id", paperId).single();
  if (paperError) throw paperError;

  const items = await getRawItems(paperId);
  const versionIds = items.filter((i) => i.question_version_id).map((i) => i.question_version_id);
  const versionsById = await fetchVersionsById(versionIds);
  const questions = hydrateItems(items, versionsById);

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
