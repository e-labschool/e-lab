import { supabase } from "./supabaseClient.js";

// Centralizes every Class Planner DB call, same pattern as every other
// service in this project. Both tables already have RLS scoping every
// call to the signed-in teacher's own rows — nothing here needs to filter
// by user_id manually beyond what's convenient for inserts.

export async function listClassPlans() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("class_plans").select("*").neq("status", "archived").order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getClassPlan(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("class_plans").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createClassPlan({ title, classGroup, topicCode, level, durationMinutes, plannedDate }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("You need to be signed in to create a class plan.");

  const { data, error } = await supabase
    .from("class_plans")
    .insert({ user_id: userId, title, class_group: classGroup || null, topic_code: topicCode || null, level: level || null, duration_minutes: durationMinutes, planned_date: plannedDate || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClassPlan(id, fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.from("class_plans").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** "Duplicate" — a real, independent copy: its own plan row and its own
 * copies of every lesson block, never sharing rows with the original. */
export async function duplicateClassPlan(id) {
  const original = await getClassPlan(id);
  const blocks = await listLessonBlocks(id);
  const copy = await createClassPlan({
    title: `${original.title} (Copy)`, classGroup: original.class_group, topicCode: original.topic_code,
    level: original.level, durationMinutes: original.duration_minutes, plannedDate: null,
  });
  for (const b of blocks) {
    await addLessonBlock(copy.id, {
      position: b.position, blockType: b.block_type, title: b.title, content: b.content,
      durationMinutes: b.duration_minutes, sourceType: b.source_type, sourceRef: b.source_ref,
      teacherNotes: b.teacher_notes, studentFacing: b.student_facing,
    });
  }
  return copy;
}

export async function archiveClassPlan(id) {
  return updateClassPlan(id, { status: "archived" });
}

export async function listLessonBlocks(classPlanId) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("lesson_blocks").select("*").eq("class_plan_id", classPlanId).order("position", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Adds a lesson block as an independent, editable COPY — content is
 * stored directly on this row, never a live reference. Editing it later
 * can never mutate the Teach/Question Bank/Resource it came from, since
 * there is no relational link back, only an informational source_ref.
 */
export async function addLessonBlock(classPlanId, { position, blockType, title, content, durationMinutes, sourceType = "custom", sourceRef = null, teacherNotes = null, studentFacing = true }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  const { data, error } = await supabase
    .from("lesson_blocks")
    .insert({ class_plan_id: classPlanId, user_id: userId, position, block_type: blockType, title, content, duration_minutes: durationMinutes, source_type: sourceType, source_ref: sourceRef, teacher_notes: teacherNotes, student_facing: studentFacing })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLessonBlock(id, fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.from("lesson_blocks").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLessonBlock(id) {
  if (!supabase) return;
  const { error } = await supabase.from("lesson_blocks").delete().eq("id", id);
  if (error) throw error;
}

/** Persists a full reordering — called after a drag/move-up/move-down
 * changes the sequence, so `position` always matches what's on screen. */
export async function reorderLessonBlocks(orderedIds) {
  if (!supabase) return;
  await Promise.all(orderedIds.map((id, i) => supabase.from("lesson_blocks").update({ position: i }).eq("id", id)));
}
