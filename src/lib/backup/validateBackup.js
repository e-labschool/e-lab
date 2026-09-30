// Structural validation of a parsed backup file, run entirely client-side
// BEFORE any database write is even considered. Produces a pass/fail
// report per check (section 9/10 of the spec) rather than a single
// boolean, so the Restore UI can show exactly what is wrong.
import { BACKUP_FORMAT, BACKUP_VERSION } from "./constants.js";

function check(list, id, label, pass, detail) {
  list.push({ id, label, pass: Boolean(pass), detail: detail || "" });
}

export function validateBackup(raw) {
  const checks = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    check(checks, "json", "File parses to a JSON object", false, "The file is not a JSON object.");
    return { valid: false, checks };
  }

  check(checks, "format", "Recognized e-Lab backup file", raw.format === BACKUP_FORMAT, `format: ${raw.format ?? "(missing)"}`);

  const versionOk = Number.isInteger(raw.backupVersion) && raw.backupVersion >= 1 && raw.backupVersion <= BACKUP_VERSION;
  check(
    checks,
    "version",
    "Supported backup version",
    versionOk,
    `backupVersion: ${raw.backupVersion ?? "(missing)"} (this app supports 1–${BACKUP_VERSION})`
  );

  check(checks, "exportedAt", "Export timestamp present and valid", typeof raw.exportedAt === "string" && !Number.isNaN(Date.parse(raw.exportedAt)));
  check(checks, "scope", "Scope metadata present", Boolean(raw.scope) && typeof raw.scope === "object");
  check(checks, "statistics", "Statistics block present", Boolean(raw.statistics) && typeof raw.statistics === "object");

  const data = raw.data && typeof raw.data === "object" ? raw.data : {};
  check(checks, "dataShape", "Data section present", Boolean(raw.data) && typeof raw.data === "object");

  const pages = Array.isArray(data.learn_pages) ? data.learn_pages : null;
  const blocks = Array.isArray(data.learn_blocks) ? data.learn_blocks : [];
  const checkQuestions = Array.isArray(data.learn_check_questions) ? data.learn_check_questions : [];
  const manualQuestions = Array.isArray(data.learn_manual_questions) ? data.learn_manual_questions : [];
  const manualSecrets = Array.isArray(data.learn_manual_question_secrets) ? data.learn_manual_question_secrets : [];

  check(checks, "pagesArray", "data.learn_pages is an array", Array.isArray(data.learn_pages));
  check(checks, "blocksArray", "data.learn_blocks is an array", Array.isArray(data.learn_blocks));
  check(checks, "cqArray", "data.learn_check_questions is an array", Array.isArray(data.learn_check_questions));
  check(checks, "mqArray", "data.learn_manual_questions is an array", Array.isArray(data.learn_manual_questions));
  check(checks, "secretsArray", "data.learn_manual_question_secrets is an array", Array.isArray(data.learn_manual_question_secrets));

  if (!pages) {
    check(checks, "stop", "Cannot validate relationships without data.learn_pages", false);
    return { valid: false, checks };
  }

  const pageIds = new Set();
  const naturalKeys = new Set();
  let malformedPages = 0;
  let dupPageIds = 0;
  let dupKeys = 0;
  for (const p of pages) {
    if (!p || !p.id || !p.parent_topic || !p.lesson_code || !p.title) malformedPages++;
    if (p?.id) {
      if (pageIds.has(p.id)) dupPageIds++;
      pageIds.add(p.id);
    }
    if (p?.parent_topic && p?.lesson_code) {
      const key = `${p.parent_topic}::${p.lesson_code}`;
      if (naturalKeys.has(key)) dupKeys++;
      naturalKeys.add(key);
    }
  }
  check(checks, "pagesWellFormed", "Every page has id, topic, lesson code and title", malformedPages === 0, `${malformedPages} malformed page row(s)`);
  check(checks, "pagesUniqueIds", "No duplicate page IDs within this backup", dupPageIds === 0, `${dupPageIds} duplicate id(s)`);
  check(checks, "pagesUniqueKeys", "No duplicate (topic, lesson code) pairs within this backup", dupKeys === 0, `${dupKeys} duplicate pair(s)`);

  let orphanBlocks = 0;
  let badBlockPositions = 0;
  for (const b of blocks) {
    if (!b?.page_id || !pageIds.has(b.page_id) || !b?.block_type) orphanBlocks++;
    if (!Number.isInteger(b?.position) || b.position < 0) badBlockPositions++;
  }
  check(checks, "blocksReference", "Every block references a page in this backup", orphanBlocks === 0, `${orphanBlocks} orphan/invalid block(s)`);
  check(checks, "blocksPosition", "Block positions are valid non-negative integers", badBlockPositions === 0, `${badBlockPositions} invalid position(s)`);

  let invalidCq = 0;
  let badCqPositions = 0;
  const cqKeys = new Set();
  let dupCq = 0;
  for (const c of checkQuestions) {
    if (!c?.page_id || !pageIds.has(c.page_id) || !c?.question_id || !c?.question_version_id) invalidCq++;
    if (!Number.isInteger(c?.position) || c.position < 0) badCqPositions++;
    if (c?.page_id && c?.question_id) {
      const key = `${c.page_id}::${c.question_id}`;
      if (cqKeys.has(key)) dupCq++;
      cqKeys.add(key);
    }
  }
  check(checks, "cqReference", "Every check question references a page, question and version", invalidCq === 0, `${invalidCq} invalid row(s)`);
  check(checks, "cqPosition", "Check question positions are valid", badCqPositions === 0, `${badCqPositions} invalid position(s)`);
  check(checks, "cqUnique", "No duplicate question assignments per page", dupCq === 0, `${dupCq} duplicate(s)`);

  const mqIds = new Set();
  let invalidMq = 0;
  let badMqPositions = 0;
  for (const m of manualQuestions) {
    if (!m?.page_id || !pageIds.has(m.page_id) || !["mcq", "short_answer"].includes(m?.question_type) || !m?.question_text) invalidMq++;
    if (!Number.isInteger(m?.position) || m.position < 0) badMqPositions++;
    if (m?.id) mqIds.add(m.id);
  }
  check(checks, "mqReference", "Every manual question references a page in this backup and has a valid type", invalidMq === 0, `${invalidMq} invalid row(s)`);
  check(checks, "mqPosition", "Manual question positions are valid", badMqPositions === 0, `${badMqPositions} invalid position(s)`);

  let invalidSecrets = 0;
  const secretIds = new Set();
  for (const s of manualSecrets) {
    if (!s?.manual_question_id || !mqIds.has(s.manual_question_id) || !s?.correct_answer_data) invalidSecrets++;
    if (s?.manual_question_id) secretIds.add(s.manual_question_id);
  }
  check(checks, "secretsReference", "Every manual-question answer references a question in this backup", invalidSecrets === 0, `${invalidSecrets} invalid row(s)`);
  const missingSecrets = manualQuestions.filter((m) => m?.id && !secretIds.has(m.id)).length;
  check(checks, "secretsComplete", "Every manual question has a matching answer record", missingSecrets === 0, `${missingSecrets} manual question(s) missing an answer`);

  if (raw.mediaManifest !== undefined) {
    const mediaOk = Array.isArray(raw.mediaManifest) && raw.mediaManifest.every((m) => m?.bucket && m?.path && Array.isArray(m?.referencedBy));
    check(checks, "mediaManifest", "Media manifest entries are well-formed", mediaOk);
  }

  const valid = checks.every((c) => c.pass);
  return {
    valid,
    checks,
    pages,
    blocks,
    checkQuestions,
    manualQuestions,
    manualSecrets,
  };
}
