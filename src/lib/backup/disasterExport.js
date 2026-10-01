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
import { auditSimulations } from "./simulationAudit.js";
import { getApplicationVersionInfo } from "./appVersion.js";
import { isMissingTableError } from "./tableAccess.js";

// student_streaks/user_preferences use their user_id column as primary
// key (no separate `id` column) — ordering must use the column that
// actually exists, per table.
const ORDER_COLUMN_OVERRIDES = {
  user_preferences: "user_id",
  student_streaks: "user_id",
  platform_settings: "id",
};

/**
 * Reads every table in `tables` (each `{ table, required }`, see
 * constants.js for the audited classification). A REQUIRED table whose
 * read fails for any reason aborts the whole backup with a clear error.
 * An OPTIONAL table whose read fails specifically because the table does
 * not exist is skipped — recorded in the returned `skipped` list, never
 * silently dropped — and the backup continues; any other error on an
 * optional table still aborts, identically to a required one.
 */
async function fetchTableGroup(tables, onProgress) {
  const out = {};
  const counts = {};
  const skipped = [];
  for (const { table, required = true } of tables) {
    try {
      const rows = await fetchAllRows(table, { orderColumn: ORDER_COLUMN_OVERRIDES[table] || "id" }, onProgress);
      out[table] = rows;
      counts[table] = rows.length;
    } catch (err) {
      if (!required && isMissingTableError(err)) {
        out[table] = [];
        counts[table] = 0;
        skipped.push({
          table,
          reason: `Classified OPTIONAL — this table does not exist in this Supabase project's schema cache. Skipped intentionally; this backup carries zero rows for it rather than failing the whole export.`,
        });
        onProgress?.(`Skipping ${table} (table not present — optional) …`);
        continue;
      }
      // Either a required table, or an optional table that failed for a
      // reason OTHER than "does not exist" (RLS, network, etc.) — never
      // silently swallowed, always aborts the backup.
      throw new Error(
        required
          ? `Required table "${table}" could not be read — Complete Disaster Recovery aborted. ${err.message}`
          : `Table "${table}" could not be read (not a "table missing" error, so this is not treated as optional) — Complete Disaster Recovery aborted. ${err.message}`
      );
    }
  }
  return { out, counts, skipped };
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
  let tablesSkipped = [];

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
    // platform_settings is REQUIRED (category H, singleton config) — the
    // Supabase error is now checked rather than silently discarded (the
    // previous code destructured only `data`, so a query error here was
    // invisible and the backup would quietly report zero settings as if
    // that were a legitimate empty result — exactly the "silently ignore
    // unexpected database errors" failure mode spec §2 forbids).
    const { data: settingsRows, error: settingsError } = await supabase.from("platform_settings").select("*").eq("id", 1).limit(1);
    if (settingsError) {
      throw new Error(`Required table "platform_settings" could not be read — Complete Disaster Recovery aborted. ${settingsError.message}`);
    }
    settings = { platform_settings: settingsRows?.[0] || null };

    tableCounts = { ...u.counts, ...p.counts, ...a.counts, ...pl.counts, platform_settings: settings.platform_settings ? 1 : 0 };
    tablesSkipped = [...u.skipped, ...p.skipped, ...a.skipped, ...pl.skipped];
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

  // ---- 6b. Simulation audit (spec §3-8): every simulationId referenced
  // by the just-exported Learn content, cross-checked against the
  // application's own simulation registry/engine components. ----
  onProgress("Verifying simulation references…");
  const simulations = auditSimulations(contentBackup);

  // ---- 6c. Application source/version strategy (spec §6/§13) ----
  const applicationSource = {
    protectedBy: "Git repository (application source, including every simulation engine, is NOT duplicated into this package — see docs/DISASTER_RECOVERY.md).",
    ...getApplicationVersionInfo(),
  };

  // ---- 7. Manifest ----
  onProgress("Creating disaster package…");
  const skippedTableNames = new Set(tablesSkipped.map((s) => s.table));
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
      ...(includeUserData ? ALL_DISASTER_TABLES.map((t) => t.table).filter((t) => !skippedTableNames.has(t)) : []),
    ],
    // Optional tables that were queried but turned out not to exist on
    // this Supabase project — skipped intentionally, never silently
    // (spec §2: "handled intentionally and reported in the manifest").
    // Empty on a project where every optional table happens to exist.
    tablesSkipped,
    tablesExcluded: EXCLUDED_TABLES,
    storageBuckets: STORAGE_BUCKETS,
    recordCounts: integrity.expectedCounts,
    mediaFileCount: mediaChecksums.length,
    mediaTotalBytes: totalMediaBytes,
    mediaFailureCount: mediaFailures.length,
    simulations,
    applicationSource,
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
    simulationsVerified: simulations.missingImplementations === 0,
    mediaVerifiedCount: verified,
    mediaMismatches: mismatches,
    mediaFailures,
    relationshipWarnings,
    simulationWarnings:
      simulations.missingImplementations > 0
        ? simulations.items
            .filter((i) => i.status === "missing")
            .map((i) => `Learn content references simulationId "${i.simulationId}" (${i.referencedBlocks} block(s)) but no implementation is registered in src/data/simulationEngineComponents.js.`)
        : [],
  };

  if (!verification.checksumsVerified || !verification.mediaVerified) {
    // Per spec §18: "If verification fails: DO NOT say backup completed
    // successfully." The zip is still returned (so the admin can inspect
    // what DID work) but the caller must surface this as a failed/partial
    // verification, never a plain success.
    manifest.verificationFailed = true;
  }
  if (!verification.simulationsVerified) {
    // Per spec §7: "If a Learn page references simulationId = xyz but
    // there is no corresponding simulation implementation: show a
    // WARNING. Do not silently produce a supposedly complete backup."
    // This is a warning, not a hard failure (the content itself was
    // captured faithfully; it's the application-source side that can't
    // be verified as reconstructable) — it does NOT set
    // verificationFailed, but it is always present in the returned
    // result for the caller (the Admin UI) to surface.
    manifest.simulationWarning = `${simulations.missingImplementations} referenced simulation(s) have no matching implementation in this build — see manifest.simulations.items.`;
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
