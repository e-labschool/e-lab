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
