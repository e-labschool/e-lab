// Complete Disaster Recovery restore — staged, because Postgres table
// writes and Supabase Storage uploads cannot share one transaction
// (spec §24's own framing: "wherever technically possible"). Stages:
//
//   1. Content restore   — a single call to the EXISTING
//                           restore_elab_content RPC (reused verbatim,
//                           not duplicated) with data/content.json.
//   2. User-data restore — a single call to the new
//                           restore_elab_disaster_data RPC with an
//                           explicit identity map (old user id -> target
//                           user id already present in auth.users on this
//                           database — see docs/DISASTER_RECOVERY.md).
//   3. Media restore     — each packaged file is re-uploaded to its
//                           bucket/path, then its uploaded bytes are
//                           re-downloaded and re-hashed to confirm the
//                           upload actually matches the package
//                           (compensating verification, since Storage
//                           gives no transactional guarantee). A media
//                           file that fails is reported, never silently
//                           swallowed — content/user-data restore is NOT
//                           rolled back because of a media failure (the
//                           DB portions already committed atomically in
//                           their own RPC calls); the admin sees exactly
//                           which files need a manual re-upload.
import { supabase } from "../supabaseClient.js";
import { planRestore, restoreElabContent } from "./restoreContent.js";
import { sha256Hex } from "./checksums.js";

export { buildIdentityMap, parseIdentityMapText } from "./identityMap.js";

/** Restore plan for the content portion (reuses the existing diff logic
 * verbatim) plus simple existence counts for the user-data portion. */
export async function planDisasterRestore(validated) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const contentPlan = await planRestore(validated.contentBackup);

  const users = validated.zip.file("data/users.json");
  const usersData = users ? JSON.parse(await users.async("string")) : { profiles: [] };
  const oldIds = (usersData.profiles || []).map((p) => p.id);

  let existingProfileIds = new Set();
  if (oldIds.length) {
    const { data } = await supabase.from("profiles").select("id").in("id", oldIds);
    existingProfileIds = new Set((data || []).map((r) => r.id));
  }

  // 2026-10 gap closure: dry-run must recognize the new Question Bank /
  // Question Paper datasets too, not just content + users — may be absent
  // entirely in a package produced before this update.
  const qbFile = validated.zip.file("data/question-bank.json");
  const qpFile = validated.zip.file("data/question-papers.json");
  const questionBankData = qbFile ? JSON.parse(await qbFile.async("string")) : null;
  const questionPapersData = qpFile ? JSON.parse(await qpFile.async("string")) : null;
  const questionBankSummary = questionBankData
    ? {
        questions: (questionBankData.questions || []).length,
        questionSecrets: (questionBankData.question_secrets || []).length,
        questionVersions: (questionBankData.question_versions || []).length,
        questionVersionSecrets: (questionBankData.question_version_secrets || []).length,
      }
    : null;
  const questionPaperSummary = questionPapersData
    ? {
        papers: (questionPapersData.question_papers || []).length,
        paperItems: (questionPapersData.question_paper_items || []).length,
      }
    : null;

  return {
    contentPlan,
    usersData,
    userSummary: {
      totalProfiles: oldIds.length,
      matchingSameId: oldIds.filter((id) => existingProfileIds.has(id)).length,
    },
    questionBankSummary,
    questionPaperSummary,
  };
}

async function readJsonFromZip(zip, path, fallback) {
  const f = zip.file(path);
  if (!f) return fallback;
  try {
    return JSON.parse(await f.async("string"));
  } catch {
    return fallback;
  }
}

/**
 * Executes the full staged restore. `identityMap` is {oldUserId:
 * targetUserId}; pass {} to skip all user-data restore (content + media
 * only). Returns a consolidated result object — never throws away a
 * partial failure silently (every stage's outcome, success or not, is in
 * the returned object).
 */
export async function restoreDisasterBackup(validated, { includeUserData = true, identityMap = {}, onProgress = () => {} } = {}) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { zip, contentBackup, manifest } = validated;
  // Datasets the ORIGINATING backup itself recorded as not_deployed/
  // optional (manifest.tablesSkipped, see disasterExport.js) — surfaced
  // here, not re-derived, so the admin sees WHY a dataset restored zero
  // rows instead of guessing whether something silently failed. The RPC
  // tolerates the target database also lacking these tables (see
  // disaster_recovery_rpc_incremental.sql's `tableMissing` flags); this is
  // purely the "what did the source package already know was absent"
  // report, surfaced regardless of what the target turns out to have.
  const datasetsNotDeployed = manifest?.tablesSkipped || [];

  onProgress("Restoring educational content…");
  const contentResult = await restoreElabContent(contentBackup, "replace");

  let userDataResult = null;
  let questionBankResult = null;
  if (includeUserData) {
    onProgress("Restoring user application data, progress and assessments…");
    const [users, progress, assessments, planning, settings, library] = await Promise.all([
      readJsonFromZip(zip, "data/users.json", {}),
      readJsonFromZip(zip, "data/progress.json", {}),
      readJsonFromZip(zip, "data/assessments.json", {}),
      readJsonFromZip(zip, "data/planning.json", {}),
      readJsonFromZip(zip, "data/settings.json", {}),
      readJsonFromZip(zip, "data/library.json", {}), // may be absent in a package produced before the 2026-10 reconciliation added it
    ]);
    const payload = { ...users, ...progress, ...assessments, ...planning, ...settings, ...library };
    const { data, error } = await supabase.rpc("restore_elab_disaster_data", { p_payload: payload, p_id_map: identityMap });
    if (error) throw new Error(`User/progress/assessment restore failed: ${error.message}`);
    userDataResult = data;

    // ---- Question Bank / Question Paper restore (2026-10 gap closure) —
    // a SEPARATE RPC call (restore_elab_question_bank_data), per the
    // staged-restore design these tables' SCHEMA RECOVERY GAP requires
    // (see question_bank_disaster_recovery_rpc_incremental.sql's header).
    // May be absent entirely in a package produced before this update. ----
    onProgress("Restoring Question Bank and Question Papers…");
    const [questionBank, questionPapers] = await Promise.all([
      readJsonFromZip(zip, "data/question-bank.json", null),
      readJsonFromZip(zip, "data/question-papers.json", null),
    ]);
    if (questionBank || questionPapers) {
      const qbPayload = { ...(questionBank || {}), ...(questionPapers || {}) };
      const { data: qbData, error: qbError } = await supabase.rpc("restore_elab_question_bank_data", { p_payload: qbPayload, p_id_map: identityMap });
      if (qbError) throw new Error(`Question Bank / Question Paper restore failed: ${qbError.message}`);
      questionBankResult = qbData;
    }
  }

  onProgress("Restoring media files…");
  const mediaFiles = zip.folder("media") ? Object.keys(zip.files).filter((p) => p.startsWith("media/") && !zip.files[p].dir) : [];
  const mediaResults = { uploaded: 0, verified: 0, failed: [] };
  let doneCount = 0;
  for (const zipPath of mediaFiles) {
    doneCount += 1;
    onProgress(`Restoring media… (${doneCount}/${mediaFiles.length})`);
    // zipPath looks like "media/<bucket>/<...path>"
    const rest = zipPath.slice("media/".length);
    const slashIdx = rest.indexOf("/");
    const bucket = rest.slice(0, slashIdx);
    const objectPath = rest.slice(slashIdx + 1);
    try {
      const bytes = await zip.file(zipPath).async("arraybuffer");
      const expectedHash = await sha256Hex(bytes);
      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      mediaResults.uploaded += 1;

      // Compensating verification: re-download and re-hash what actually
      // landed in Storage, since upload+DB writes aren't one transaction.
      const { data: reDownloaded, error: downloadError } = await supabase.storage.from(bucket).download(objectPath);
      if (downloadError) throw new Error(`uploaded but re-download failed: ${downloadError.message}`);
      const actualHash = await sha256Hex(await reDownloaded.arrayBuffer());
      if (actualHash !== expectedHash) throw new Error("uploaded but checksum mismatch after upload");
      mediaResults.verified += 1;
    } catch (err) {
      mediaResults.failed.push({ bucket, path: objectPath, error: err.message || String(err) });
    }
  }

  onProgress("Restore complete.");
  return {
    contentResult,
    userDataResult,
    questionBankResult,
    mediaResults,
    datasetsNotDeployed,
    fullySuccessful: mediaResults.failed.length === 0,
  };
}
