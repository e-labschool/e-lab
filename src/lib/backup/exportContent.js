// Builds a portable e-Lab content backup by querying the actual audited
// Learn-content tables, in dependency order, paginated so an arbitrarily
// large library never depends on a single unbounded Supabase response.
//
// This module ONLY reads. It never writes to the database or to Storage.
import { supabase } from "../supabaseClient.js";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  APPLICATION_NAME,
  LEARN_MEDIA_BUCKET,
  PAGE_BATCH_SIZE,
  ID_CHUNK_SIZE,
  SECRET_FETCH_CONCURRENCY,
} from "./constants.js";
import { collectMediaReferences, mediaMapToManifest } from "./mediaScan.js";

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/** Reads every row of `table`, optionally filtered, in PAGE_BATCH_SIZE pages. */
async function fetchAllRows(table, { applyFilter } = {}, onProgress) {
  const rows = [];
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select("*").order("id", { ascending: true }).range(from, from + PAGE_BATCH_SIZE - 1);
    if (applyFilter) query = applyFilter(query);
    const { data, error } = await query;
    if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
    rows.push(...data);
    onProgress?.(`Reading ${table}… (${rows.length})`);
    if (!data.length || data.length < PAGE_BATCH_SIZE) break;
    from += PAGE_BATCH_SIZE;
  }
  return rows;
}

/** Reads every row of `table` whose page_id is in pageIds, chunking the IN-list. */
async function fetchByPageIds(table, pageIds, onProgress) {
  if (!pageIds.length) return [];
  const rows = [];
  for (const ids of chunk(pageIds, ID_CHUNK_SIZE)) {
    const part = await fetchAllRows(table, { applyFilter: (q) => q.in("page_id", ids) }, onProgress);
    rows.push(...part);
  }
  return rows;
}

/**
 * Manual-question correct answers/explanations live in
 * learn_manual_question_secrets, which has ALL direct table access
 * revoked (see learn_content_cms.sql) — the only path is the admin-only
 * get_admin_learn_manual_question_secret RPC, one call per question.
 * Fetched with bounded concurrency rather than one at a time.
 */
async function fetchManualSecrets(manualQuestions, onProgress) {
  const results = [];
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= manualQuestions.length) return;
      const mq = manualQuestions[i];
      const { data, error } = await supabase.rpc("get_admin_learn_manual_question_secret", { p_question_id: mq.id });
      if (error) throw new Error(`Failed reading the answer for manual question ${mq.id}: ${error.message}`);
      if (data) {
        results.push({
          manual_question_id: mq.id,
          correct_answer_data: data.correctAnswerData ?? null,
          explanation: data.explanation ?? null,
        });
      }
      onProgress?.(`Reading manual question answers… (${results.length}/${manualQuestions.length})`);
    }
  }
  const workerCount = Math.min(SECRET_FETCH_CONCURRENCY, manualQuestions.length) || 0;
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

/**
 * scope:
 *   { type: "full" }
 *   { type: "topic", parentTopic }        -- scoped export by the ONE real
 *                                             hierarchy level that exists
 *                                             beyond the page itself (see
 *                                             the audit notes in docs/).
 *   { type: "pageIds", pageIds: [...] }    -- used internally for the
 *                                             automatic pre-restore safety
 *                                             snapshot.
 */
export async function exportElabContent({ scope = { type: "full" }, onProgress = () => {} } = {}) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  onProgress("Preparing backup…");

  let applyPageFilter;
  if (scope.type === "topic") {
    if (!scope.parentTopic) throw new Error("A topic scope requires parentTopic.");
    applyPageFilter = (q) => q.eq("parent_topic", scope.parentTopic);
  } else if (scope.type === "pageIds") {
    if (!scope.pageIds?.length) applyPageFilter = (q) => q.eq("id", "00000000-0000-0000-0000-000000000000");
    else applyPageFilter = (q) => q.in("id", scope.pageIds);
  } else if (scope.type !== "full") {
    throw new Error(`Unknown export scope: ${scope.type}`);
  }

  onProgress("Reading pages…");
  const pages = await fetchAllRows("learn_pages", { applyFilter: applyPageFilter }, onProgress);
  const pageIds = pages.map((p) => p.id);

  onProgress("Reading blocks…");
  const blocks = await fetchByPageIds("learn_blocks", pageIds, onProgress);

  onProgress("Reading check questions…");
  const checkQuestions = await fetchByPageIds("learn_check_questions", pageIds, onProgress);

  onProgress("Reading manual questions…");
  const manualQuestions = await fetchByPageIds("learn_manual_questions", pageIds, onProgress);

  onProgress("Reading manual question answers…");
  const manualSecrets = await fetchManualSecrets(manualQuestions, onProgress);

  onProgress("Scanning media references…");
  const mediaMap = new Map();
  collectMediaReferences(blocks, ["content"], "learn_blocks", mediaMap);
  collectMediaReferences(manualQuestions, ["stimulus", "options"], "learn_manual_questions", mediaMap);
  const mediaManifest = mediaMapToManifest(mediaMap);

  onProgress("Building backup…");
  const backup = {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    application: APPLICATION_NAME,
    scope:
      scope.type === "topic"
        ? { type: "topic", parentTopic: scope.parentTopic }
        : scope.type === "pageIds"
          ? { type: "pageIds", pageIds: scope.pageIds }
          : { type: "full" },
    statistics: {
      pages: pages.length,
      blocks: blocks.length,
      checkQuestions: checkQuestions.length,
      manualQuestions: manualQuestions.length,
      media: mediaManifest.length,
    },
    data: {
      learn_pages: pages,
      learn_blocks: blocks,
      learn_check_questions: checkQuestions,
      learn_manual_questions: manualQuestions,
      learn_manual_question_secrets: manualSecrets,
    },
    mediaManifest,
  };

  onProgress("Ready");
  return backup;
}

export function backupFileName(backup) {
  const dateStr = (backup.exportedAt || new Date().toISOString()).slice(0, 10);
  const scopeSuffix =
    backup.scope?.type === "topic"
      ? `-${String(backup.scope.parentTopic).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`
      : backup.scope?.type === "pageIds"
        ? "-snapshot"
        : "-full";
  return `elab-content${scopeSuffix}-${dateStr}.json`;
}

export function downloadBackup(backup) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName(backup);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { LEARN_MEDIA_BUCKET };
