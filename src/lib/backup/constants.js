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
// ============================================================
export const DISASTER_FORMAT = "elab-disaster-recovery";
export const DISASTER_VERSION = 1;

// Every Storage bucket actually referenced by application code (audited
// via `grep -rn "storage.from(" src`), not assumed. Each entry names the
// bucket and whether it is safe/expected to package actual file bytes —
// all three are legitimate application media, none are a secrets store.
export const STORAGE_BUCKETS = [
  { bucket: "learn-media", description: "Student Learn lesson media (images/GIFs/video) referenced from learn_blocks/learn_manual_questions content." },
  { bucket: "resources", description: "Teacher/student downloadable resource files (private bucket; accessed via signed URLs)." },
  { bucket: "question-media", description: "Question Bank stimulus images (MCQ/short-answer visual_data)." },
];

// Application-level USER tables — audited from supabase/schema.sql,
// admin-access-migration.sql, admin-users-migration.sql,
// learning_progress_incremental.sql, prediction_cycles_incremental.sql,
// solve-challenges-migration.sql, solve-focus-monitoring-migration.sql,
// class-planner-migration.sql. Deliberately excludes auth.users itself
// (Supabase-managed; requires the service-role Admin API, never callable
// from the browser — see docs/DISASTER_RECOVERY.md §"Authentication").
//
// Each entry names the table, the column that is (or resolves to) the
// auth user id needing ID-remapping on restore, and which classification
// bucket (per the user's spec, §1) it belongs to.
// `required` (audited 2026-09, fixing the live "Could not find the table
// 'public.user_preferences'" failure): true aborts the whole Complete
// Disaster Recovery run if the table read fails for any reason,
// including "table does not exist" (spec: "Required tables failing
// should stop the backup"). false means the table is OPTIONAL
// functionality that may genuinely not exist — the exporter skips ONLY
// a "table does not exist" error for it, records the skip in the
// manifest, and continues; any other error (RLS, network, etc.) still
// aborts, same as a required table.
//
// `user_preferences` is the one table classified OPTIONAL here:
//   - It is defined ONLY in supabase/schema.sql, the single "run this
//     once" bootstrap file whose own header says re-running an
//     already-applied section is unnecessary — unlike every other table
//     below, it has no dedicated `*_incremental.sql` / `*-migration.sql`
//     file of its own documenting an independent migration step, so
//     there is no guarantee that step was (re-)run on a given project.
//   - The application itself already treats it as non-critical:
//     src/context/PreferencesContext.jsx reads it with `.maybeSingle()`
//     and ignores `error` (falls back to `{}`), and its `upsert` merely
//     skips the state update on error — the app never throws or blocks
//     on this table being absent. It stores only small UI convenience
//     state (sidebar-collapsed, last route/concept, theme).
// Every other table below is REQUIRED: each has its own dedicated
// migration file, and the application code that reads it
// (accessService.js, challengeService.js, classPlannerService.js,
// predictionEngine.js, settingsService.js) always throws/surfaces the
// Supabase error rather than swallowing it — the app itself treats
// these as load-bearing.
export const USER_DATA_TABLES = [
  { table: "profiles", userIdColumn: "id", category: "D", required: true }, // D: user profile data
  { table: "user_access", userIdColumn: "user_id", category: "E", required: true }, // E: access/subscription
  { table: "user_preferences", userIdColumn: "user_id", category: "H", required: false }, // H: app settings (per-user) — OPTIONAL, see audit note above
];

export const PROGRESS_DATA_TABLES = [
  { table: "learning_progress", userIdColumn: "user_id", category: "F", required: true },
  { table: "concept_attempts", userIdColumn: "user_id", category: "F", required: true },
  { table: "prediction_cycles", userIdColumn: "user_id", category: "F", required: true },
  { table: "prediction_snapshots", userIdColumn: "user_id", category: "F", required: true },
  { table: "student_streaks", userIdColumn: "user_id", category: "F", required: true },
];

export const ASSESSMENT_DATA_TABLES = [
  { table: "student_challenges", userIdColumn: "user_id", category: "G", required: true },
  { table: "challenge_questions", userIdColumn: "user_id", category: "G", required: true },
];

// Teacher-authored planning data — application/user-owned content, not
// curriculum content, not progress/assessment. Included in the disaster
// package (spec: "SAME ... SETTINGS" + "reconstruct as faithfully as
// possible"), kept in its own group since it has its own FK shape
// (class_plans -> lesson_blocks, not a bare user_id leaf table).
export const PLANNING_DATA_TABLES = [
  { table: "class_plans", userIdColumn: "user_id", category: "F", required: true },
  { table: "lesson_blocks", userIdColumn: "user_id", category: "F", required: true }, // also FKs class_plan_id
];

// Singleton application configuration — one row, id = 1, no user_id at
// all. Included verbatim (H: application settings); never remapped.
export const SETTINGS_TABLES = [{ table: "platform_settings", userIdColumn: null, category: "H", required: true }];

// Tables the disaster backup explicitly and deliberately EXCLUDES, with
// the audited reason — surfaced verbatim in the manifest's
// `tablesExcluded` so nothing "silently" disappears (spec §41.4).
export const EXCLUDED_TABLES = [
  { table: "auth.users", reason: "Supabase-managed authentication identities. Requires the service-role Admin API (server-side only, never in this React frontend). See docs/DISASTER_RECOVERY.md — NOT PORTABLE by this package; a documented relinking procedure is provided instead." },
  { table: "questions / question_versions / question_version_secrets / question_secrets", reason: "The separate Question Bank system. Learn pages only store a reference (question_id + pinned question_version_id) to it, by the same deliberate scope boundary the existing Content Backup already documents — restoring it is a future extension, not this feature's job." },
  { table: "Supabase Auth sessions/tokens/refresh tokens", reason: "Secrets — never captured anywhere in application code or this backup, by design (spec §12/§35)." },
];

// All application-owned table groups the disaster backup covers, in one
// place, so export/restore/UI never enumerate tables three different ways.
export const ALL_DISASTER_TABLES = [
  ...USER_DATA_TABLES,
  ...PROGRESS_DATA_TABLES,
  ...ASSESSMENT_DATA_TABLES,
  ...PLANNING_DATA_TABLES,
  ...SETTINGS_TABLES,
];
