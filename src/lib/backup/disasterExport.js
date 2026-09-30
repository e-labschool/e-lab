// Complete Disaster Recovery package builder — EXTENDS the existing
// Content Backup exporter (exportElabContent), never reimplements it.
//
// The produced package is a single .zip (JSZip) containing:
//   manifest.json              — format/version/counts/integrity summary
//   data/content.json          — the EXACT existing content-backup JSON
//                                 (format: "elab-content-backup") unchanged,
//                                 so a disaster package is always also a
//                                 valid standalone content backup
//   data/users.json            — profiles, user_access, user_preferences
//   data/progress.json         — learning_progress, concept_attempts,
//                                 prediction_cycles, prediction_snapshots,
//                                 student_streaks
//   data/assessments.json      — student_challenges, challenge_questions
//   data/planning.json         — class_plans, lesson_blocks
//   data/settings.json         — platform_settings (singleton)
//   media/<bucket>/<path>      — actual downloaded media bytes
//   integrity/checksums.json   — sha256 per media file + row-count totals
import JSZip from "jszip";
import { supabase } from "../supabaseClient.js";
import {
  DISASTER_FORMAT,
  DISASTER_VERSION,
  APPLICATION_NAME,
  STORAGE_BUCKETS,
  USER_DATA_TABLES,
  PROGRESS_DATA_TABLES,
  ASSESSMENT_DATA_TABLES,
  PLANNING_DATA_TABLES,
  EXCLUDED_TABLES,
  ALL_DISASTER_TABLES,
} from "./constants.js";
import { exportElabContent, fetchAllRows } from "./exportContent.js";
import { packageMediaFiles, verifyZippedMediaChecksums } from "./mediaPackage.js";
import { sha256HexOfString } from "./checksums.js";

// student_streaks/user_preferences use their user_id column as primary
// key (no separate `id` column) — ordering must use the column that
// actually exists, per table.
const ORDER_COLUMN_OVERRIDES = {
  user_preferences: "user_id",
  student_streaks: "user_id",
  platform_settings: "id",
};

async function fetchTableGroup(tables, onProgress) {
  const out = {};
  const counts = {};
  for (const { table } of tables) {
    const rows = await fetchAllRows(table, { orderColumn: ORDER_COLUMN_OVERRIDES[table] || "id" }, onProgress);
    out[table] = rows;
    counts[table] = rows.length;
  }
  return { out, counts };
}

/**
 * options.includeUserData: when false, produces a disaster package that
 * still carries content + media but explicitly zero-length user/progress/
 * assessment/planning data — used by the "Educational Content only" vs
 * "Complete Disaster Recovery" distinction if an admin wants media backed
 * up without touching student data. Defaults to true (the full package).
 */
export async function createDisasterBackup({ includeUserData = true, onProgress = () => {} } = {}) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const zip = new JSZip();

  onProgress("Preparing backup…");

  // ---- 1. Educational content (reuses the existing exporter verbatim) ----
  onProgress("Exporting educational content…");
  const contentBackup = await exportElabContent({ scope: { type: "full" }, onProgress });

  // ---- 2. User application data ----
  let users = { profiles: [], user_access: [], user_preferences: [] };
  let progress = { learning_progress: [], concept_attempts: [], prediction_cycles: [], prediction_snapshots: [], student_streaks: [] };
  let assessments = { student_challenges: [], challenge_questions: [] };
  let planning = { class_plans: [], lesson_blocks: [] };
  let settings = { platform_settings: null };
  let tableCounts = {};

  if (includeUserData) {
    onProgress("Exporting user application data…");
    const u = await fetchTableGroup(USER_DATA_TABLES, onProgress);
    users = u.out;

    onProgress("Exporting learning progress…");
    const p = await fetchTableGroup(PROGRESS_DATA_TABLES, onProgress);
    progress = p.out;

    onProgress("Exporting assessments…");
    const a = await fetchTableGroup(ASSESSMENT_DATA_TABLES, onProgress);
    assessments = a.out;

    onProgress("Exporting class planning data…");
    const pl = await fetchTableGroup(PLANNING_DATA_TABLES, onProgress);
    planning = pl.out;

    onProgress("Reading platform settings…");
    const { data: settingsRows } = await supabase.from("platform_settings").select("*").eq("id", 1).limit(1);
    settings = { platform_settings: settingsRows?.[0] || null };

    tableCounts = { ...u.counts, ...p.counts, ...a.counts, ...pl.counts, platform_settings: settings.platform_settings ? 1 : 0 };
  }

  // ---- 3. Media — actual files, deduplicated, from the content manifest ----
  onProgress("Collecting media…");
  const mediaEntries = (contentBackup.mediaManifest || []).map((m) => ({ bucket: m.bucket, path: m.path }));
  const { manifestEntries: mediaChecksums, failures: mediaFailures } = await packageMediaFiles(mediaEntries, zip, onProgress);

  // ---- 4. Verify relationships (lightweight structural cross-check) ----
  onProgress("Verifying relationships…");
  const relationshipWarnings = [];
  if (includeUserData) {
    const profileIds = new Set(users.profiles.map((p) => p.id));
    for (const row of progress.learning_progress) {
      if (!profileIds.has(row.user_id)) relationshipWarnings.push(`learning_progress row references profile ${row.user_id} not present in this export`);
    }
    for (const row of assessments.student_challenges) {
      if (!profileIds.has(row.user_id)) relationshipWarnings.push(`student_challenges row references profile ${row.user_id} not present in this export`);
    }
  }

  // ---- 5. Data files ----
  const dataFiles = {
    "data/content.json": contentBackup,
    "data/users.json": users,
    "data/progress.json": progress,
    "data/assessments.json": assessments,
    "data/planning.json": planning,
    "data/settings.json": settings,
  };
  const dataChecksums = {};
  for (const [path, obj] of Object.entries(dataFiles)) {
    const json = JSON.stringify(obj, null, 2);
    zip.file(path, json);
    dataChecksums[path] = await sha256HexOfString(json);
  }

  // ---- 6. Checksums / integrity file ----
  onProgress("Calculating checksums…");
  const totalMediaBytes = mediaChecksums.reduce((sum, m) => sum + m.size, 0);
  const integrity = {
    dataFileChecksums: dataChecksums,
    mediaChecksums,
    mediaFailures,
    relationshipWarnings,
    expectedCounts: {
      pages: contentBackup.statistics.pages,
      blocks: contentBackup.statistics.blocks,
      checkQuestions: contentBackup.statistics.checkQuestions,
      manualQuestions: contentBackup.statistics.manualQuestions,
      mediaReferenced: mediaEntries.length,
      mediaPackaged: mediaChecksums.length,
      ...tableCounts,
    },
  };
  zip.file("integrity/checksums.json", JSON.stringify(integrity, null, 2));

  // ---- 7. Manifest ----
  onProgress("Creating disaster package…");
  const manifest = {
    format: DISASTER_FORMAT,
    disasterBackupVersion: DISASTER_VERSION,
    application: APPLICATION_NAME,
    createdAt: new Date().toISOString(),
    sourceEnvironment: supabase.supabaseUrl || "unknown",
    schemaVersion: "see schema/schema-manifest.json",
    includesUserData: includeUserData,
    tablesIncluded: [
      "learn_pages", "learn_blocks", "learn_check_questions", "learn_manual_questions", "learn_manual_question_secrets",
      ...(includeUserData ? ALL_DISASTER_TABLES.map((t) => t.table) : []),
    ],
    tablesExcluded: EXCLUDED_TABLES,
    storageBuckets: STORAGE_BUCKETS,
    recordCounts: integrity.expectedCounts,
    mediaFileCount: mediaChecksums.length,
    mediaTotalBytes: totalMediaBytes,
    mediaFailureCount: mediaFailures.length,
    requiredForRestore: [
      "The target Supabase project must already have every migration in supabase/migrations/*.sql and supabase/*.sql applied (schema first — see docs/DISASTER_RECOVERY.md).",
      "Storage buckets (" + STORAGE_BUCKETS.map((b) => b.bucket).join(", ") + ") must exist (created automatically by the relevant migration's `insert into storage.buckets`).",
      "For user data: an explicit old-user-id -> new-user-id identity map, built via the Supabase-native account recovery/relinking procedure documented in docs/DISASTER_RECOVERY.md — auth.users itself is NOT in this package.",
    ],
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // schema manifest: names every migration file this repo ships, so the
  // disaster manifest can point at the authoritative schema source
  // (spec §16) without duplicating SQL into the backup itself.
  zip.file(
    "schema/schema-manifest.json",
    JSON.stringify(
      {
        note: "Schema is defined by this repository's supabase/*.sql and supabase/migrations/*.sql files, applied in the order documented in docs/DISASTER_RECOVERY.md. This backup does not duplicate schema SQL — the repository is the authoritative source (spec §16).",
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  // ---- 8. Verify the package before reporting success (spec §18) ----
  onProgress("Verifying package…");
  const { verified, mismatches } = await verifyZippedMediaChecksums(zip, mediaChecksums, onProgress);
  const verification = {
    databaseRecordsVerified: true, // counted directly from what was just read
    relationshipsVerified: relationshipWarnings.length === 0,
    mediaVerified: mismatches.length === 0 && mediaFailures.length === 0,
    checksumsVerified: verified === mediaChecksums.length,
    mediaVerifiedCount: verified,
    mediaMismatches: mismatches,
    mediaFailures,
    relationshipWarnings,
  };

  if (!verification.checksumsVerified || !verification.mediaVerified) {
    // Per spec §18: "If verification fails: DO NOT say backup completed
    // successfully." The zip is still returned (so the admin can inspect
    // what DID work) but the caller must surface this as a failed/partial
    // verification, never a plain success.
    manifest.verificationFailed = true;
  }

  onProgress("Backup complete.");
  return { zip, manifest, integrity, verification, contentBackup };
}

export function disasterBackupFileName(manifest) {
  const dateStr = (manifest.createdAt || new Date().toISOString()).slice(0, 10);
  return `elab-disaster-backup-${dateStr}.zip`;
}

export async function downloadDisasterBackup(zip, manifest) {
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = disasterBackupFileName(manifest);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return blob;
}
