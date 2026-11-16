// Supabase calls for the Content Overview / reuse tools. Admin only (RLS: is_admin()). No new tables or columns.
import { supabase } from "./supabaseClient.js";
import { listBlocks, getLesson, createBlock, updateBlock, listCheckQuestions, addCheckQuestion } from "./learnContentService.js";
import { META_BLOCK_TYPE, extractMetaRow, metaContent } from "./learnMeta.js";
import { buildDuplicate } from "./learnReuse.js";

const need = () => { if (!supabase) throw new Error("Not connected to Supabase."); };
async function pagedSelect(table, columns, order) {
  need();
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(table).select(columns).order(order, { ascending: true }).range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}
export const listAllPages = () => pagedSelect("learn_pages", "*", "id");
export const listAllBlocks = () => pagedSelect("learn_blocks", "*", "id");
export async function listCheckCounts() {
  const rows = await pagedSelect("learn_check_questions", "id,page_id", "id").catch(() => []);
  const manual = await pagedSelect("learn_manual_questions", "id,page_id", "id").catch(() => []);
  const counts = {};
  for (const r of [...rows, ...manual]) counts[r.page_id] = (counts[r.page_id] ?? 0) + 1;
  return counts;
}

/** Writes lesson-level metadata into the hidden `lesson_meta` block (created invisible, never served to students). */
export async function saveLessonMeta(pageId, meta, metaRowId = null) {
  need();
  if (metaRowId) { const r = await updateBlock(metaRowId, { content: metaContent(meta), visible: false }); return r; }
  return createBlock(pageId, { blockType: META_BLOCK_TYPE, content: metaContent(meta), position: 0, visible: false });
}

async function insertPage(fields) {
  need();
  const { data: rows, error: e1 } = await supabase.from("learn_pages").select("display_order, display_order_sl, display_order_hl").eq("parent_topic", fields.parent_topic);
  if (e1) throw e1;
  const max = (f) => Math.max(0, ...(rows || []).map((r) => Number(r?.[f] ?? 0) || 0));
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("learn_pages").insert({
    parent_topic: fields.parent_topic, lesson_code: fields.lesson_code, syllabus_codes: fields.syllabus_codes ?? [], title: fields.title, level: fields.level,
    display_order: max("display_order") + 1, display_order_sl: max("display_order_sl") + 1, display_order_hl: max("display_order_hl") + 1, status: "draft", created_by: u?.user?.id ?? null,
  }).select().single();
  if (error) throw error;
  return data;
}
async function insertBlocks(pageId, blocks, meta) {
  let i = 0;
  for (const b of blocks) { await createBlock(pageId, { blockType: b.block_type, content: b.content, position: i, visible: b.visible }); i += 1; }
  await createBlock(pageId, { blockType: META_BLOCK_TYPE, content: metaContent(meta), position: 0, visible: false });
}

/** Creates NEW draft lessons from a validated import plan (validateImport). Never touches existing lessons. */
export async function importLessons(planLessons) {
  const created = [];
  for (const l of planLessons) {
    const page = await insertPage(l);
    await insertBlocks(page.id, l.blocks, l.meta);
    created.push(page);
  }
  return created;
}

/** Duplicate as a new guide version: new draft lesson (needs review) + copied blocks + copied check-question links. Original untouched. */
export async function duplicateLessonAsVersion(pageId, version) {
  need();
  const [page, rows, all] = await Promise.all([getLesson(pageId), listBlocks(pageId), listAllPages()]);
  const existingCodes = all.filter((p) => p.parent_topic === page.parent_topic).map((p) => p.lesson_code);
  const plan = buildDuplicate(page, rows, version, { existingCodes });
  const created = await insertPage(plan.page);
  await insertBlocks(created.id, plan.blocks, plan.meta);
  let questionsCopied = 0; let questionsSkipped = 0;
  try {
    const checks = await listCheckQuestions(pageId);
    for (const q of checks) {
      if (q.source_type === "manual") { questionsSkipped += 1; continue; }
      await addCheckQuestion(created.id, { questionId: q.question_id, questionVersionId: q.question_version_id, position: q.position }); questionsCopied += 1;
    }
  } catch { /* check questions are best effort */ }
  return { page: created, questionsCopied, questionsSkipped };
}
export { extractMetaRow };
