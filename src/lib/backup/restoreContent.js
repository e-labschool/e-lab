// Restore preview (dry-run diff) and the actual restore call.
//
// The real write is a SINGLE call to the restore_elab_content(payload,
// mode) Postgres function (supabase/migrations/backup_restore_rpc.sql),
// which runs entirely inside one function invocation — Postgres makes a
// whole function body atomic: if ANY statement inside it raises, every
// change it made is rolled back automatically. That is the actual
// transactional guarantee this feature relies on (see docs/ for the
// honest discussion of what this does and doesn't cover).
import { supabase } from "../supabaseClient.js";

/**
 * Reads only the minimum needed to diff the backup's pages against the
 * live table: matches by the natural key (parent_topic, lesson_code) —
 * the same uniqueness constraint the table itself enforces — never by the
 * backup's own id column (a restored page must never be assumed to be
 * able to reuse its original database id; see restore_elab_content.sql).
 */
export async function planRestore(backup) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const pages = backup?.data?.learn_pages || [];
  const topics = [...new Set(pages.map((p) => p.parent_topic).filter(Boolean))];

  let existingPages = [];
  if (topics.length) {
    const { data, error } = await supabase
      .from("learn_pages")
      .select("id, parent_topic, lesson_code, title, status, updated_at")
      .in("parent_topic", topics);
    if (error) throw new Error(`Could not read existing content to compare against: ${error.message}`);
    existingPages = data || [];
  }

  const existingByKey = new Map(existingPages.map((p) => [`${p.parent_topic}::${p.lesson_code}`, p]));
  const newPages = [];
  const matchingPages = [];
  for (const p of pages) {
    const key = `${p.parent_topic}::${p.lesson_code}`;
    const existing = existingByKey.get(key);
    if (existing) matchingPages.push({ backup: p, existing });
    else newPages.push(p);
  }

  const blockCountByPageId = countBy(backup?.data?.learn_blocks, "page_id");
  const cqCountByPageId = countBy(backup?.data?.learn_check_questions, "page_id");
  const mqCountByPageId = countBy(backup?.data?.learn_manual_questions, "page_id");

  return {
    newPages,
    matchingPages,
    summary: {
      totalPages: pages.length,
      newPages: newPages.length,
      matchingPages: matchingPages.length,
    },
    countsFor(pageId) {
      return {
        blocks: blockCountByPageId.get(pageId) || 0,
        checkQuestions: cqCountByPageId.get(pageId) || 0,
        manualQuestions: mqCountByPageId.get(pageId) || 0,
      };
    },
  };
}

function countBy(rows, key) {
  const map = new Map();
  for (const r of rows || []) {
    map.set(r[key], (map.get(r[key]) || 0) + 1);
  }
  return map;
}

export async function restoreElabContent(backup, mode) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  if (!["merge", "replace"].includes(mode)) throw new Error(`Unsupported restore mode: ${mode}`);

  const payload = {
    learn_pages: backup?.data?.learn_pages || [],
    learn_blocks: backup?.data?.learn_blocks || [],
    learn_check_questions: backup?.data?.learn_check_questions || [],
    learn_manual_questions: backup?.data?.learn_manual_questions || [],
    learn_manual_question_secrets: backup?.data?.learn_manual_question_secrets || [],
  };

  const { data, error } = await supabase.rpc("restore_elab_content", { p_payload: payload, p_mode: mode });
  if (error) throw new Error(error.message || "Restore failed.");
  return data;
}
