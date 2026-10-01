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

  return {
    contentPlan,
    usersData,
    userSummary: {
      totalProfiles: oldIds.length,
      matchingSameId: oldIds.filter((id) => existingProfileIds.has(id)).length,
    },
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
  const { zip, contentBackup } = validated;

  onProgress("Restoring educational content…");
  const contentResult = await restoreElabContent(contentBackup, "replace");

  let userDataResult = null;
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
    mediaResults,
    fullySuccessful: mediaResults.failed.length === 0,
  };
}
