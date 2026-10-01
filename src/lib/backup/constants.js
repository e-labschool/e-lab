// Shared constants for the Backup, Export & Restore system.
//
// BACKUP_VERSION is the schema version of the JSON file this app WRITES.
// Bump it whenever the shape of `data` changes in a way that an older
// restoreContent.js could not safely interpret. validateBackup.js accepts
// any backupVersion from 1 up to BACKUP_VERSION — never a newer one than
// the running app understands.
export const BACKUP_FORMAT = "elab-content-backup";
export const BACKUP_VERSION = 1;
export const APPLICATION_NAME = "e-Lab";

// The exact, audited set of tables that constitute authored Learn CONTENT
// (see docs/BACKUP_AND_DISASTER_RECOVERY.md for the full audit). Deliberately
// excludes: profiles, learning_progress, concept_attempts, student_challenges,
// challenge_questions, student_streaks, user_preferences, user_access
// (student/user data, not content) and questions/question_versions/
// question_version_secrets (the separate Question Bank system — Learn pages
// only store a reference, id + pinned version id, to that system; see the
// docs for why the full bank is out of scope for this feature).
export const CONTENT_TABLES = [
  "learn_pages",
  "learn_blocks",
  "learn_check_questions",
  "learn_manual_questions",
  "learn_manual_question_secrets",
];

export const LEARN_MEDIA_BUCKET = "learn-media";

// Supabase's PostgREST layer caps a single response; batch reads stay
// comfortably under that regardless of table size.
export const PAGE_BATCH_SIZE = 500;
// How many page ids go into a single `.in("page_id", [...])` filter.
export const ID_CHUNK_SIZE = 150;
// Parallel RPC calls when fetching per-row manual-question secrets.
export const SECRET_FETCH_CONCURRENCY = 8;

// ============================================================
// Complete Disaster Recovery — extends, never replaces, the Content
// Backup constants above. See docs/DISASTER_RECOVERY.md for the full
// audit this classification is based on.
//
// 2026-10 SCHEMA RECONCILIATION — read this before touching anything
// below. This file previously classified tables in four separate arrays
// that were hand-maintained independently, which is exactly how the live
// project ended up failing TWICE on the same class of bug (first
// `user_preferences`, then `prediction_cycles` — both marked REQUIRED
// while actually absent from the live Supabase schema cache: "Could not
// find the table 'public.<name>' in the schema cache"). Per an explicit,
// one-time audit (not another single-table patch), there is now exactly
// ONE authoritative list — BACKUP_DATASETS — and every other export below
// (USER_DATA_TABLES, PROGRESS_DATA_TABLES, ASSESSMENT_DATA_TABLES,
// PLANNING_DATA_TABLES, SETTINGS_TABLES, ALL_DISASTER_TABLES) is DERIVED
// from it by filtering on `group`, never redeclared. Add or reclassify a
// table in BACKUP_DATASETS only — nowhere else.
//
// THE RULE THIS AUDIT ENFORCES (non-negotiable, not a style preference):
// a table may be marked `required: true` only when (1) it has a genuine
// `create table if not exists public.<name>` migration somewhere under
// supabase/*.sql or supabase/migrations/*.sql, (2) real application code
// (outside this backup system) actually queries/writes it, by name,
// confirmed via `grep -rn ".from(\"<name>\")" src`, and (3) that
// application code treats a read failure on it as fatal (throws/surfaces
// the Supabase error) rather than tolerating absence. A table can NEVER
// be required merely because a migration file for it exists in this
// repository — a migration file sitting in supabase/migrations/ is proof
// of *intent*, not proof that it was ever actually run against the live
// project (that is exactly how both user_preferences and prediction_cycles
// went wrong: both have real `create table` migrations in this repo, both
// are genuinely queried by real app code, and both STILL turned out
// missing from the live schema cache, because the migration was never
// (re-)applied there). So in addition to (1)-(3), a table whose absence
// has been directly observed against the live project is downgraded to
// `required: false` regardless of how solid its code-level evidence is —
// see the prediction_cycles/prediction_snapshots entries below, and
// scripts/test-disaster-recovery.mjs §7/§10 which encode this rule as an
// executable, re-checkable test rather than a one-off manual judgement.
//
// `required: true`  — read failure for ANY reason aborts the whole
//                      Complete Disaster Recovery run (this table is
//                      load-bearing production data).
// `required: false` — a "table does not exist" read failure is skipped
//                      and recorded in the manifest; any OTHER failure
//                      (RLS, network, …) on it still aborts, identically
//                      to a required table — "optional" only ever means
//                      "legitimately may not exist", never "errors are
//                      fine to ignore" (see isMissingTableError in
//                      tableAccess.js, and datasetFetch.js which applies
//                      this rule uniformly over the whole list in one
//                      pass — see that file's header for why a single
//                      run now surfaces every failing table at once
//                      instead of one at a time across repeated reruns).
//
// ------------------------------------------------------------
// 2026-10 RECONCILIATION, PART 2 — `deploymentTier`. The live backup
// above (user_preferences, then prediction_cycles/prediction_snapshots)
// reported genuinely-absent tables. The NEXT live run reported two MORE:
// `class_plans` and `lesson_blocks` — real Class Planner tables (genuine
// migration in supabase/class-planner-migration.sql, real throwing usage
// in src/lib/classPlannerService.js) that were still `required: true`,
// so their absence aborted the whole backup. Simply flipping them to
// `required: false` would have been the THIRD single-table patch of the
// exact same bug, and would also have collapsed a real distinction the
// admin needs: "this table may legitimately not exist anywhere"
// (user_preferences/prediction_cycles' actual situation) is NOT the same
// claim as "this is a real, undeployed FEATURE whose schema exists in
// source but was never applied to this specific project" (class_plans/
// lesson_blocks' actual situation). `required` alone cannot say which —
// `deploymentTier` adds that distinction without touching the proven
// abort/skip mechanics `required` + isMissingTableError already drive.
// See DEPLOYMENT_TIER and describeDatasetAbsence() below, and
// scripts/test-disaster-recovery.mjs §11 for the acceptance test this
// reconciliation added (simulating both tables confirmed-missing while
// every required_live/feature_deployed table succeeds).
//
//   required_live          — core app data; load-bearing. ANY read
//                             failure aborts, including a confirmed
//                             missing-relation — a missing core table is
//                             never "not deployed yet", it's broken.
//   feature_deployed        — a real feature's table this project is
//                             expected to have (no live evidence it's
//                             ever absent). Same abort-on-any-failure
//                             behavior as required_live; kept as a
//                             distinct label purely so reports describe
//                             it as a deployed feature, not core system
//                             data.
//   not_deployed_if_missing — a real feature (genuine migration + real
//                             app usage) where a CONFIRMED missing-
//                             relation error means "this feature's
//                             schema was never applied to THIS Supabase
//                             project", not an abort. Any OTHER failure
//                             on it still aborts exactly like a required
//                             table — only the exact "table does not
//                             exist" signal (isMissingTableError) ever
//                             downgrades it. `class_plans`/
//                             `lesson_blocks` use this tier.
//   optional                — a table that may legitimately not exist in
//                             ANY environment (no dedicated migration of
//                             its own and/or the app already tolerates
//                             its absence) — a different CLAIM than
//                             not_deployed_if_missing even though the
//                             pass/fail mechanics are the same.
//                             `user_preferences`/`prediction_cycles`/
//                             `prediction_snapshots` use this tier.
//   excluded                 — not a BACKUP_DATASETS row at all; see
//                             EXCLUDED_TABLES. Included in the enum only
//                             so report code has one tier to switch on.
//
// Be conservative, always: isMissingTableError() is the ONLY signal that
// may ever downgrade a required_live/feature_deployed failure or treat a
// not_deployed_if_missing/optional failure as absence-not-abort. A
// permission/RLS error, network error, timeout, or any other unexpected
// failure NEVER gets reinterpreted as "not deployed" — it surfaces as a
// real, visible failure (abort for required_live/feature_deployed; a
// loudly-flagged, backup-aborting failure for the other two tiers as
// well — see datasetFetch.js, unchanged from the original fix).
// ------------------------------------------------------------
export const DEPLOYMENT_TIER = {
  REQUIRED_LIVE: "required_live",
  FEATURE_DEPLOYED: "feature_deployed",
  NOT_DEPLOYED_IF_MISSING: "not_deployed_if_missing",
  OPTIONAL: "optional",
  EXCLUDED: "excluded",
};

/**
 * Tier-specific wording for a table's ABSENCE — used everywhere a skip
 * is reported (manifest.tablesSkipped reasons, manifest.datasetReport
 * warnings, the Admin UI). Only ever called for a CONFIRMED missing-
 * relation skip (never for an abort) — see datasetFetch.js. Keeping the
 * wording centralized here (not duplicated in datasetFetch.js /
 * datasetReport.js / the UI) is what makes tier 3 and tier 4 read
 * differently everywhere at once, per spec, from one source of truth.
 */
export function describeDatasetAbsence(entry) {
  switch (entry.deploymentTier) {
    case DEPLOYMENT_TIER.NOT_DEPLOYED_IF_MISSING:
      return (
        `NOT DEPLOYED — the "${entry.table}" table has a genuine migration ` +
        "and real application code that queries it in this repository, but " +
        "this Supabase project's schema cache reports it does not exist: " +
        "that migration has not been applied here. This backup records " +
        `"${entry.table}" with zero rows (never fabricated) and continues; ` +
        "its restore-dependency information is preserved so a future " +
        "environment where this feature IS deployed can still back it up " +
        "and restore it normally."
      );
    case DEPLOYMENT_TIER.OPTIONAL:
      return (
        `OPTIONAL — "${entry.table}" may legitimately not exist in any ` +
        "environment (no dedicated migration of its own, and/or the " +
        "application itself already tolerates its absence). Skipped " +
        "intentionally; this backup carries zero rows for it rather than " +
        "failing the whole export."
      );
    default:
      // required_live / feature_deployed never reach this on a legitimate
      // path (see datasetFetch.js — only a non-required table's CONFIRMED
      // missing-relation error calls this at all). Kept as a safe
      // fallback rather than throwing if that invariant is ever violated.
      return `"${entry.table}" is not present in this export.`;
  }
}
export const DISASTER_FORMAT = "elab-disaster-recovery";
export const DISASTER_VERSION = 1;

// Every Storage bucket actually referenced by application code (audited
// via `grep -rn "storage.from(" src`), not assumed. `required: true` means
// the application cannot function without it ever having existed (Learn
// authoring/rendering writes/reads learn-media directly, uncaught); the
// two others are real, actively-used features but their own code already
// tolerates an empty/absent bucket at the UI level (upload surfaces an
// error to the admin/teacher attempting it rather than crashing the app),
// so their absence is recorded, never fatal to the whole disaster backup.
// `filesPackaged` is an HONESTY field, not a classification: it says
// whether this Complete Disaster Recovery package actually downloads this
// bucket's object BYTES into media/<bucket>/… (true), or merely records
// the bucket's existence/metadata (false) — see mediaScan.js, which only
// ever walks learn-media URLs embedded in exported Learn content. Before
// this field existed, the manifest and docs both implied all three
// buckets' files were packaged identically; they were not — only
// learn-media's bytes ever actually get downloaded. `resources` row
// METADATA (title/path/etc.) is backed up via the `resources` table in
// BACKUP_DATASETS; its Storage file BYTES, and question-media's, are not
// — a documented future extension, not a silent gap (see
// docs/DISASTER_RECOVERY.md).
export const STORAGE_BUCKETS = [
  { bucket: "learn-media", description: "Student Learn lesson media (images/GIFs/video) referenced from learn_blocks/learn_manual_questions content.", required: true, filesPackaged: true },
  { bucket: "resources", description: "Teacher/student downloadable resource files (private bucket; accessed via signed URLs). Row metadata is in the `resources` table; file bytes are NOT yet packaged by this feature.", required: false, filesPackaged: false },
  { bucket: "question-media", description: "Question Bank stimulus images (MCQ/short-answer visual_data). The Question Bank itself is out of scope (see EXCLUDED_TABLES); file bytes are NOT packaged by this feature.", required: false, filesPackaged: false },
];

// ============================================================
// BACKUP_DATASETS — the single, authoritative table manifest.
//
// `group` controls which data/*.json file in the disaster package a row
// lands in (content is handled separately by exportContent.js/
// CONTENT_TABLES — unchanged — and is not repeated here). Every other
// array below is computed FROM this one.
//
// Audit evidence for every entry (full citations in
// docs/DISASTER_RECOVERY.md):
//   profiles                 — supabase/schema.sql; read/written by
//                              nearly every service in src/lib, always
//                              throws on error.
//   user_access              — supabase/admin-access-migration.sql;
//                              src/lib/accessService.js throws on error.
//   user_preferences         — supabase/schema.sql ONLY (the single
//                              "run once" bootstrap file, no dedicated
//                              incremental migration of its own); the
//                              app's own src/context/PreferencesContext.jsx
//                              already reads it with .maybeSingle() and
//                              silently falls back to {} on error — the
//                              app itself never treats this table as
//                              load-bearing. OPTIONAL (audited 2026-09,
//                              confirmed by the live
//                              "Could not find the table
//                              'public.user_preferences'" failure).
//   learning_progress        — supabase/schema.sql +
//                              migrations/learning_progress_incremental.sql;
//                              src/lib/progressAnalytics.js throws on error.
//   concept_attempts         — supabase/schema.sql +
//                              migrations/learning_progress_incremental.sql
//                              + migrations/learning_progress_permissions_fix.sql
//                              (three independent migrations touching it —
//                              the strongest evidence of any table here
//                              that it is actively maintained production
//                              schema); src/context/ProgressContext.jsx
//                              writes to it directly.
//   prediction_cycles        — migrations/prediction_cycles_incremental.sql;
//                              src/lib/predictionEngine.js genuinely
//                              queries/writes it (this is real Predicted-
//                              Grade feature code, not a name invented for
//                              backup purposes). DOWNGRADED TO OPTIONAL:
//                              this is the table the live Complete
//                              Disaster Recovery run actually failed on —
//                              "Could not find the table
//                              'public.prediction_cycles' in the schema
//                              cache" — direct proof the migration above
//                              has not actually been applied to the live
//                              project, regardless of it existing in this
//                              repo. Note the app's own read paths
//                              (getActiveCycle/getAllCycles in
//                              predictionEngine.js) already destructure
//                              only `data` and silently return
//                              null/[] on a Supabase error — the Progress
//                              page already degrades gracefully without
//                              this table; only the (separate, opt-in)
//                              "Start new cycle" write path would surface
//                              an error, which is a live-site follow-up
//                              for the Predicted Grade feature itself, not
//                              a disaster-recovery concern.
//   prediction_snapshots     — same migration file, same table-missing
//                              live evidence (prediction_snapshots has an
//                              FK to prediction_cycles — if the parent is
//                              absent the child cannot exist either).
//                              OPTIONAL for the same reason.
//   student_streaks          — supabase/solve-challenges-migration.sql;
//                              src/lib/challengeService.js throws on error.
//   student_challenges       — supabase/solve-challenges-migration.sql;
//                              src/lib/challengeService.js throws on error.
//   challenge_questions      — supabase/solve-challenges-migration.sql;
//                              src/lib/challengeService.js throws on error.
//   class_plans              — supabase/class-planner-migration.sql;
//                              src/lib/classPlannerService.js throws on
//                              error. RECLASSIFIED `not_deployed_if_missing`
//                              (2026-10, part 2): a live Complete Disaster
//                              Recovery run reported "Could not find the
//                              table 'public.class_plans' in the schema
//                              cache" — direct evidence this repo's own
//                              migration has not been applied to that
//                              project, the same class-planner-migration.sql
//                              has not been run there, exactly the
//                              "migration file proves intent, never live
//                              existence" pattern prediction_cycles hit
//                              first. NOT downgraded to `optional`: this is
//                              a real, actively-developed feature expected
//                              to be deployed eventually, not a table that
//                              may legitimately never exist anywhere — see
//                              DEPLOYMENT_TIER above for why that
//                              distinction is kept instead of collapsed.
//   lesson_blocks            — supabase/class-planner-migration.sql;
//                              src/lib/classPlannerService.js throws on
//                              error. Same live-confirmed-missing evidence
//                              and `not_deployed_if_missing` reclassification
//                              as class_plans (its FK parent) — see above.
//   platform_settings        — supabase/admin-settings-migration.sql;
//                              src/lib/settingsService.js throws on error
//                              (its own .maybeSingle() sibling,
//                              platform_settings_public, is a VIEW over
//                              it used for anonymous pre-login reads —
//                              never backed up itself, see EXCLUDED_TABLES
//                              reasoning inline at the bottom of this file
//                              for why derived views are never part of
//                              this list).
//
// Tables that were considered and are NOT here, with the reason: see
// EXCLUDED_TABLES below (Question Bank system, question_papers/
// question_paper_items, derived views, auth.users, secrets).
// ============================================================
export const BACKUP_DATASETS = [
  { table: "profiles", userIdColumn: "id", category: "D", group: "users", required: true, deploymentTier: DEPLOYMENT_TIER.REQUIRED_LIVE },
  { table: "user_access", userIdColumn: "user_id", category: "E", group: "users", required: true, deploymentTier: DEPLOYMENT_TIER.REQUIRED_LIVE },
  { table: "user_preferences", userIdColumn: "user_id", category: "H", group: "users", required: false, deploymentTier: DEPLOYMENT_TIER.OPTIONAL },

  { table: "learning_progress", userIdColumn: "user_id", category: "F", group: "progress", required: true, deploymentTier: DEPLOYMENT_TIER.FEATURE_DEPLOYED },
  { table: "concept_attempts", userIdColumn: "user_id", category: "F", group: "progress", required: true, deploymentTier: DEPLOYMENT_TIER.FEATURE_DEPLOYED },
  { table: "prediction_cycles", userIdColumn: "user_id", category: "F", group: "progress", required: false, deploymentTier: DEPLOYMENT_TIER.OPTIONAL },
  { table: "prediction_snapshots", userIdColumn: "user_id", category: "F", group: "progress", required: false, deploymentTier: DEPLOYMENT_TIER.OPTIONAL },
  { table: "student_streaks", userIdColumn: "user_id", category: "F", group: "progress", required: true, deploymentTier: DEPLOYMENT_TIER.FEATURE_DEPLOYED },

  { table: "student_challenges", userIdColumn: "user_id", category: "G", group: "assessments", required: true, deploymentTier: DEPLOYMENT_TIER.FEATURE_DEPLOYED },
  { table: "challenge_questions", userIdColumn: "user_id", category: "G", group: "assessments", required: true, deploymentTier: DEPLOYMENT_TIER.FEATURE_DEPLOYED },

  // 2026-10 reconciliation, part 2: reclassified from `required: true` to
  // `not_deployed_if_missing` — see DEPLOYMENT_TIER above and the audit
  // note above BACKUP_DATASETS for the live evidence. NOT `optional`: see
  // the same note for why that distinction is deliberate.
  { table: "class_plans", userIdColumn: "user_id", category: "F", group: "planning", required: false, deploymentTier: DEPLOYMENT_TIER.NOT_DEPLOYED_IF_MISSING },
  { table: "lesson_blocks", userIdColumn: "user_id", category: "F", group: "planning", required: false, deploymentTier: DEPLOYMENT_TIER.NOT_DEPLOYED_IF_MISSING }, // also FKs class_plan_id

  { table: "platform_settings", userIdColumn: null, category: "H", group: "settings", required: true, deploymentTier: DEPLOYMENT_TIER.REQUIRED_LIVE }, // singleton, id = 1, no user_id

  // Discovered by the 2026-10 reconciliation's grep-driven completeness
  // check (scripts/test-disaster-recovery.mjs §6b: every table name a
  // .from(...) call in src/ references must be accounted for somewhere)
  // — `resources` had NO
  // migration-vs-inventory gap, it simply had never been added to EITHER
  // the content backup OR the disaster backup OR EXCLUDED_TABLES: a true
  // silent gap, not a hardcoded-but-wrong assumption like
  // user_preferences/prediction_cycles were. supabase/resources-migration.sql
  // defines it; src/lib/resourceService.js throws on every read/write
  // error — genuinely required, admin/teacher-authored library metadata.
  // `userIdColumn` is "created_by" (nullable FK to auth.users) rather than
  // a strict per-user ownership column — see disasterRestore's identity
  // handling note in the RPC migration for how a row with no mappable
  // creator is still restored (creator attribution set to null, row never
  // dropped).
  { table: "resources", userIdColumn: "created_by", category: "I", group: "library", required: true, deploymentTier: DEPLOYMENT_TIER.FEATURE_DEPLOYED },
];

function byGroup(group) {
  return BACKUP_DATASETS.filter((t) => t.group === group);
}

// Derived, backward-compatible groupings — every one of these is a VIEW
// over BACKUP_DATASETS, never a second place that names a table.
export const USER_DATA_TABLES = byGroup("users");
export const PROGRESS_DATA_TABLES = byGroup("progress");
export const ASSESSMENT_DATA_TABLES = byGroup("assessments");
export const PLANNING_DATA_TABLES = byGroup("planning");
export const SETTINGS_TABLES = byGroup("settings");
export const LIBRARY_DATA_TABLES = byGroup("library");

// Tables the disaster backup explicitly and deliberately EXCLUDES, with
// the audited reason — surfaced verbatim in the manifest's
// `tablesExcluded` so nothing "silently" disappears (spec §41.4).
export const EXCLUDED_TABLES = [
  { table: "auth.users", reason: "Supabase-managed authentication identities. Requires the service-role Admin API (server-side only, never in this React frontend). See docs/DISASTER_RECOVERY.md — NOT PORTABLE by this package; a documented relinking procedure is provided instead.", deploymentTier: DEPLOYMENT_TIER.EXCLUDED },
  { table: "questions / question_versions / question_version_secrets / question_secrets", reason: "The separate Question Bank system. Learn pages only store a reference (question_id + pinned question_version_id) to it, by the same deliberate scope boundary the existing Content Backup already documents — restoring it is a future extension, not this feature's job.", deploymentTier: DEPLOYMENT_TIER.EXCLUDED },
  { table: "question_papers / question_paper_items", reason: "Confirmed by code audit (grep -rn \"question_paper\" src/) to be a real, actively-used teacher feature (src/pages/teacher/qbuilder/) with NO create-table migration anywhere in supabase/*.sql or supabase/migrations/*.sql — it was provisioned directly against the live Supabase project outside version control, exactly like the Question Bank it composes from. Grouped with the Question Bank under the same documented scope boundary (docs/BACKUP_AND_DISASTER_RECOVERY.md §4/§5) rather than guessed at: this backup cannot safely assume its columns/RLS, and restoring a question paper without its referenced canonical questions would be incomplete anyway.", deploymentTier: DEPLOYMENT_TIER.EXCLUDED },
  { table: "user_access_overview / platform_settings_public", reason: "Both are Postgres VIEWs (create or replace view — see admin-access-migration.sql / admin-settings-migration.sql), not base tables: they have no rows of their own to back up. Their underlying base tables (user_access, platform_settings) ARE in BACKUP_DATASETS above; restoring those automatically makes the views correct again.", deploymentTier: DEPLOYMENT_TIER.EXCLUDED },
  { table: "Supabase Auth sessions/tokens/refresh tokens", reason: "Secrets — never captured anywhere in application code or this backup, by design (spec §12/§35).", deploymentTier: DEPLOYMENT_TIER.EXCLUDED },
];

// All application-owned table groups the disaster backup covers, in one
// place, so export/restore/UI never enumerate tables three different ways.
export const ALL_DISASTER_TABLES = BACKUP_DATASETS;
