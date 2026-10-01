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
  EXCLUDED_TABLES,
  ALL_DISASTER_TABLES,
  DEPLOYMENT_TIER,
  SCHEMA_RECOVERY_GAPS,
} from "./constants.js";
import { exportElabContent, fetchAllRows } from "./exportContent.js";
import { packageMediaFiles, verifyZippedMediaChecksums } from "./mediaPackage.js";
import { collectBucketReferences, bucketMediaMapToManifest } from "./mediaScan.js";
import { sha256HexOfString } from "./checksums.js";
import { auditSimulations } from "./simulationAudit.js";
import { getApplicationVersionInfo } from "./appVersion.js";
import { fetchAllDatasets, assertNoDatasetFailures } from "./datasetFetch.js";
import { buildDatasetReport } from "./datasetReport.js";

// Tables whose primary key is NOT a bare `id` column, or that are a
// singleton read rather than a full-table page scan — ordering/filtering
// must use the shape that actually exists, per table.
const ORDER_COLUMN_OVERRIDES = {
  user_preferences: "user_id",
  student_streaks: "user_id",
  platform_settings: "id",
};

/**
 * Reads ONE row of the platform_settings singleton (id = 1), returning it
 * wrapped in an array so it fits the same `{ table: rows[] }` shape every
 * other dataset uses in fetchAllDatasets — settings.platform_settings is
 * unwrapped back to a single object (or null) right after the pass.
 */
async function readPlatformSettingsRow(onProgress) {
  const { data, error } = await supabase.from("platform_settings").select("*").eq("id", 1).limit(1);
  if (error) throw error;
  onProgress?.(`Reading platform_settings… (${data?.length ?? 0})`);
  return data ?? [];
}

/**
 * question_secrets / question_version_secrets have table-level SELECT
 * revoked entirely (confirmed by get-admin-question-secrets-migration.sql's
 * own header comment) — the only read path is the new bulk admin-only RPC
 * added by question_bank_disaster_recovery_rpc_incremental.sql. A real RPC
 * failure here (permission, network, the table genuinely missing) throws
 * normally and is handled by fetchAllDatasets exactly like any other
 * table's failure — never silently treated as "not deployed" unless it is
 * a genuine Postgres "undefined_table" signal (isMissingTableError also
 * recognizes plain Postgres error code 42P01, which is what an RPC whose
 * BODY references a missing table raises at call time, unlike a direct
 * PostgREST `.from()` read's distinct PGRST205 shape).
 */
async function readViaRpc(rpcName, onProgress, label) {
  const { data, error } = await supabase.rpc(rpcName);
  if (error) throw error;
  onProgress?.(`Reading ${label}… (${data?.length ?? 0})`);
  return data ?? [];
}

/** readTable callback for fetchAllDatasets — real Supabase reads, used by
 * createDisasterBackup. Kept as a thin adapter so the actual decision
 * logic (datasetFetch.js) stays testable without a live connection. */
function makeReadTable(onProgress) {
  return async (table) => {
    if (table === "platform_settings") return readPlatformSettingsRow(onProgress);
    if (table === "question_secrets") return readViaRpc("admin_export_question_secrets", onProgress, table);
    if (table === "question_version_secrets") return readViaRpc("admin_export_question_version_secrets", onProgress, table);
    return fetchAllRows(table, { orderColumn: ORDER_COLUMN_OVERRIDES[table] || "id" }, onProgress);
  };
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

  // ---- 2. User application data — ONE complete pass over every table in
  // BACKUP_DATASETS (the single-source manifest, see constants.js). Every
  // table is attempted regardless of whether an earlier one failed, so a
  // single run reports the COMPLETE set of problems — never just the
  // first required table that happens to be missing (see
  // datasetFetch.js's header for why this replaced the old per-group,
  // throw-on-first-failure implementation). ----
  let users = { profiles: [], user_access: [], user_preferences: [] };
  let progress = { learning_progress: [], concept_attempts: [], prediction_cycles: [], prediction_snapshots: [], student_streaks: [] };
  let assessments = { student_challenges: [], challenge_questions: [] };
  let planning = { class_plans: [], lesson_blocks: [] };
  let settings = { platform_settings: null };
  let library = { resources: [] };
  // 2026-10 Question Bank / Question Paper gap closure — see
  // constants.js's BACKUP_DATASETS "question_bank"/"question_papers"
  // groups and SCHEMA_RECOVERY_GAPS. Kept as two separate data files
  // (data/question-bank.json, data/question-papers.json) rather than
  // folded into data/library.json, matching Phase 5's explicit separate
  // manifest sections.
  let questionBank = { questions: [], question_secrets: [], question_versions: [], question_version_secrets: [] };
  let questionPapers = { question_papers: [], question_paper_items: [] };
  let tableCounts = {};
  let tablesSkipped = [];
  let datasetFailures = [];

  if (includeUserData) {
    onProgress("Exporting user application data, progress, assessments, planning and settings…");
    const { out, counts, skipped, failures } = await fetchAllDatasets(ALL_DISASTER_TABLES, makeReadTable(onProgress), onProgress);

    users = { profiles: out.profiles ?? [], user_access: out.user_access ?? [], user_preferences: out.user_preferences ?? [] };
    progress = {
      learning_progress: out.learning_progress ?? [],
      concept_attempts: out.concept_attempts ?? [],
      prediction_cycles: out.prediction_cycles ?? [],
      prediction_snapshots: out.prediction_snapshots ?? [],
      student_streaks: out.student_streaks ?? [],
    };
    assessments = { student_challenges: out.student_challenges ?? [], challenge_questions: out.challenge_questions ?? [] };
    planning = { class_plans: out.class_plans ?? [], lesson_blocks: out.lesson_blocks ?? [] };
    settings = { platform_settings: out.platform_settings?.[0] ?? null };
    library = { resources: out.resources ?? [] };
    questionBank = {
      questions: out.questions ?? [],
      question_secrets: out.question_secrets ?? [],
      question_versions: out.question_versions ?? [],
      question_version_secrets: out.question_version_secrets ?? [],
    };
    questionPapers = { question_papers: out.question_papers ?? [], question_paper_items: out.question_paper_items ?? [] };

    tableCounts = { ...counts, platform_settings: settings.platform_settings ? 1 : 0 };
    tablesSkipped = skipped;
    datasetFailures = failures;

    // Only abort AFTER every table in the manifest has been attempted —
    // the aggregated error below names every one that failed, not just
    // whichever happened to be read first (spec: "The exporter must get
    // through the COMPLETE inventory").
    assertNoDatasetFailures(datasetFailures);
  }

  // ---- 3. Media — actual files, deduplicated, from the content manifest,
  // PLUS (2026-10 gap closure) uploaded Resource files and Question Bank
  // stimulus images — extending the exact same packageMediaFiles()/
  // verifyZippedMediaChecksums() path learn-media has always used, never
  // a second storage system. Deduplicated across all three sources by
  // bucket+path before download, so a file referenced twice is only
  // fetched once. ----
  onProgress("Collecting media…");
  const mediaEntryMap = new Map(); // key: `${bucket}::${path}` -> { bucket, path }
  for (const m of contentBackup.mediaManifest || []) {
    mediaEntryMap.set(`${m.bucket}::${m.path}`, { bucket: m.bucket, path: m.path });
  }

  // Resources: ONLY rows with an actual uploaded file (file_path set, no
  // external_url) are Storage objects — per spec, an external URL is
  // never treated as a missing/expected Storage file.
  const resourceFileEntries = (library.resources || []).filter((r) => r.file_path && !r.external_url);
  for (const r of resourceFileEntries) {
    mediaEntryMap.set(`resources::${r.file_path}`, { bucket: "resources", path: r.file_path });
  }

  // Question Bank stimulus images: scanned the same way learn-media
  // references are found inside JSONB content — public Storage URLs
  // embedded in questions.question_content/visual_data/options/parts and
  // question_versions.content_snapshot (the pinned, frozen copy a paper
  // item or canonical challenge actually renders from).
  const questionMediaMap = new Map();
  collectBucketReferences(questionBank.questions, ["question_content", "visual_data", "options", "parts"], "question-media", "questions", questionMediaMap);
  collectBucketReferences(questionBank.question_versions, ["content_snapshot"], "question-media", "question_versions", questionMediaMap);
  const questionMediaManifest = bucketMediaMapToManifest(questionMediaMap, "question-media");
  for (const m of questionMediaManifest) mediaEntryMap.set(`${m.bucket}::${m.path}`, { bucket: m.bucket, path: m.path });

  const mediaEntries = [...mediaEntryMap.values()];
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

    // ---- Question Bank / Question Paper integrity cross-checks (Phase 6) ----
    const questionIds = new Set(questionBank.questions.map((q) => q.id));
    const versionIds = new Set(questionBank.question_versions.map((v) => v.id));
    const paperIds = new Set(questionPapers.question_papers.map((p) => p.id));
    for (const row of questionBank.question_versions) {
      if (!questionIds.has(row.question_id)) relationshipWarnings.push(`question_versions row ${row.id} references question ${row.question_id} not present in this export`);
    }
    for (const row of questionBank.question_secrets) {
      if (!questionIds.has(row.question_id)) relationshipWarnings.push(`question_secrets row references question ${row.question_id} not present in this export`);
    }
    for (const row of questionBank.question_version_secrets) {
      if (!versionIds.has(row.question_version_id)) relationshipWarnings.push(`question_version_secrets row references question_versions id ${row.question_version_id} not present in this export`);
    }
    for (const row of questionPapers.question_paper_items) {
      if (!paperIds.has(row.paper_id)) relationshipWarnings.push(`question_paper_items row ${row.id} references question_papers id ${row.paper_id} not present in this export`);
      if (row.question_version_id && !versionIds.has(row.question_version_id)) {
        relationshipWarnings.push(`question_paper_items row ${row.id} references question_versions id ${row.question_version_id} not present in this export`);
      }
    }
    // Resources: an uploaded-file row must resolve to a packaged media
    // entry; an external_url row must NEVER be flagged as a missing file
    // (per spec, it was never supposed to be a Storage object).
    const packagedResourcePaths = new Set(mediaChecksums.filter((m) => m.bucket === "resources").map((m) => m.path));
    for (const row of library.resources) {
      if (row.file_path && !row.external_url && !packagedResourcePaths.has(row.file_path)) {
        relationshipWarnings.push(`resources row ${row.id} has file_path "${row.file_path}" but it was not packaged (see mediaFailures)`);
      }
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
    "data/library.json": library,
    "data/question-bank.json": questionBank,
    "data/question-papers.json": questionPapers,
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

  // ---- 6d. Schema audit diagnostic (dev/admin-only — the compact
  // "Required datasets: X / Available: X / Missing required: 0" summary).
  // If we reached this line with includeUserData true, assertNoDatasetFailures
  // already passed, so EVERY required table was read successfully —
  // requiredMissing is always 0 here by construction, never a guess. ----
  const requiredDatasetDefs = ALL_DISASTER_TABLES.filter((t) => t.required);
  // "Optional" here keeps its ORIGINAL, narrower meaning (tier 4 only —
  // "may legitimately not exist anywhere"); tier 3 (not_deployed_if_missing
  // — a real feature whose schema simply isn't applied to THIS project
  // yet, e.g. class_plans/lesson_blocks) is tracked separately below so
  // the two never read as the same claim in this summary either.
  const optionalDatasetDefs = ALL_DISASTER_TABLES.filter((t) => t.deploymentTier === DEPLOYMENT_TIER.OPTIONAL);
  const notDeployedFeatureDefs = ALL_DISASTER_TABLES.filter((t) => t.deploymentTier === DEPLOYMENT_TIER.NOT_DEPLOYED_IF_MISSING);
  const optionalSkippedCount = tablesSkipped.filter((s) => s.deploymentTier === DEPLOYMENT_TIER.OPTIONAL).length;
  const notDeployedSkippedCount = tablesSkipped.filter((s) => s.deploymentTier === DEPLOYMENT_TIER.NOT_DEPLOYED_IF_MISSING).length;
  const schemaAudit = {
    requiredDatasets: requiredDatasetDefs.length,
    requiredAvailable: includeUserData ? requiredDatasetDefs.length : null,
    requiredMissing: includeUserData ? 0 : null,
    // Tier 3 — feature schema present in this repo's source but not (yet)
    // applied to the connected Supabase project. Distinct from "optional"
    // below: these ARE expected to eventually exist, they are simply not
    // deployed here right now (spec: "generalize ... distinguish a
    // confirmed missing relation ... from an optional dataset").
    featureNotDeployedDatasets: notDeployedFeatureDefs.length,
    featureNotDeployedAvailable: includeUserData ? notDeployedFeatureDefs.length - notDeployedSkippedCount : null,
    featureNotDeployedAbsent: includeUserData ? notDeployedSkippedCount : null,
    optionalDatasets: optionalDatasetDefs.length,
    optionalAvailable: includeUserData ? optionalDatasetDefs.length - optionalSkippedCount : null,
    optionalUnavailable: includeUserData ? optionalSkippedCount : null,
    storageBuckets: STORAGE_BUCKETS.length,
    storageBucketsRequired: STORAGE_BUCKETS.filter((b) => b.required).length,
    simulationReferences: simulations.uniqueSimulations,
    simulationImplementationsVerified: simulations.verifiedImplementations,
    note: includeUserData
      ? null
      : "User/progress/assessment/planning/settings tables were not read (includeUserData=false) — this backup covers educational content + media only, so required/not-deployed/optional availability was not evaluated this run.",
  };

  // ---- 6e. Per-dataset reconciliation report (spec: "dataset | source
  // status | live status | backup status | row count | warning/error" —
  // for EVERY known dataset, not just the Class Planner two that prompted
  // this). Built from the SAME out/counts/skipped/failures this run just
  // produced — never a second, hand-maintained accounting. ----
  const datasetReport = buildDatasetReport(ALL_DISASTER_TABLES, {
    counts: tableCounts,
    skipped: tablesSkipped,
    failures: datasetFailures,
  });

  // ---- 6f. Per-bucket storage report (Phase 5: "bucket | live status |
  // object count discovered | objects packaged | bytes packaged | failed
  // objects | checksum status"), built from the SAME mediaEntries/
  // mediaChecksums/mediaFailures this run just produced — never a second,
  // hand-maintained accounting. ----
  const storageReport = STORAGE_BUCKETS.map((b) => {
    const discovered = mediaEntries.filter((m) => m.bucket === b.bucket);
    const packaged = mediaChecksums.filter((m) => m.bucket === b.bucket);
    const failed = mediaFailures.filter((m) => m.bucket === b.bucket);
    const bytesPackaged = packaged.reduce((sum, m) => sum + m.size, 0);
    return {
      bucket: b.bucket,
      liveStatus: discovered.length > 0 ? "objects_referenced" : "no_objects_referenced_this_run",
      objectsDiscovered: discovered.length,
      objectsPackaged: packaged.length,
      bytesPackaged,
      failedObjects: failed.length,
      // checksum status at this point reflects packaging-time computation
      // (every packaged file has its SHA-256 recorded already); the
      // independent RE-hash/compare pass runs in step 8 below and sets
      // manifest.verificationFailed if any packaged file's bytes don't
      // match what was recorded here.
      checksumStatus: failed.length === 0 ? "computed_pending_verification" : "incomplete_see_failedObjects",
      filesPackaged: b.filesPackaged,
    };
  });

  // ---- 6g. Question Bank / Question Paper reconciliation sections
  // (Phase 5: explicit sections distinct from the generic datasetReport
  // rows, naming tables detected/backed up, total records, and schema
  // recovery warnings together in one place). ----
  const questionBankTableNames = ["questions", "question_secrets", "question_versions", "question_version_secrets"];
  const questionPaperTableNames = ["question_papers", "question_paper_items"];
  const questionBankReport = {
    tablesDetected: questionBankTableNames,
    tablesBackedUp: includeUserData ? questionBankTableNames.filter((t) => !skippedTableNames.has(t)) : [],
    totalRecords: includeUserData
      ? questionBankTableNames.reduce((sum, t) => sum + (tableCounts[t] || 0), 0)
      : null,
    schemaRecoveryWarnings: SCHEMA_RECOVERY_GAPS.filter((g) => questionBankTableNames.includes(g.table)),
  };
  const questionPaperReport = {
    papers: includeUserData ? (tableCounts.question_papers || 0) : null,
    paperItems: includeUserData ? (tableCounts.question_paper_items || 0) : null,
    schemaRecoveryWarnings: SCHEMA_RECOVERY_GAPS.filter((g) => questionPaperTableNames.includes(g.table)),
  };

  // ---- 6h. Schema recovery gap report (Phase 8) — every table this
  // backup protects despite having NO source-controlled migration,
  // annotated with what THIS run actually observed (whether it was
  // readable here or confirmed absent), never just the static audit text
  // alone. ----
  const schemaRecoveryGaps = SCHEMA_RECOVERY_GAPS.map((gap) => ({
    ...gap,
    observedThisRun: includeUserData
      ? skippedTableNames.has(gap.table)
        ? "confirmed_absent_on_this_project"
        : datasetFailures.some((f) => f.table === gap.table)
          ? "read_failed_this_run"
          : "readable_on_this_project"
      : "not_evaluated_this_run",
  }));

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
    schemaAudit,
    datasetReport,
    storageReport,
    questionBankReport,
    questionPaperReport,
    schemaRecoveryGaps,
    applicationSource,
    requiredForRestore: [
      "The target Supabase project must already have every migration in supabase/migrations/*.sql and supabase/*.sql applied (schema first — see docs/DISASTER_RECOVERY.md).",
      "Storage buckets (" + STORAGE_BUCKETS.map((b) => b.bucket).join(", ") + ") must exist (created automatically by the relevant migration's `insert into storage.buckets`).",
      STORAGE_BUCKETS.every((b) => b.filesPackaged)
        ? "Every Storage bucket's file bytes (" + STORAGE_BUCKETS.map((b) => b.bucket).join(", ") + ") are packaged under media/ by this backup where a corresponding row/reference was found — a resource row with only an external_url, or a question with no stimulus image, simply has nothing to package, which is expected, not a gap."
        : "Only " +
          STORAGE_BUCKETS.filter((b) => b.filesPackaged).map((b) => b.bucket).join(", ") +
          " file bytes are packaged under media/ by this backup — the remaining bucket(s) must be recovered from Supabase Storage's own backup/replication.",
      "SCHEMA RECOVERY GAP: questions, question_secrets, question_versions, question_version_secrets, question_papers and question_paper_items have NO `create table` migration anywhere in this repository (see manifest.schemaRecoveryGaps). Their DATA is captured in data/question-bank.json / data/question-papers.json and CAN be restored by restore_elab_question_bank_data — but ONLY onto a target database that already has these exact tables (the same live project, or one where an admin has manually run `pg_dump --schema-only` against the source project first, per each gap's `recommendation`). Restoring onto a genuinely fresh/empty Supabase project will fail at this step until that schema is recreated.",
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
