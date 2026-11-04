// Shared, dependency-free helper for classifying a Supabase/PostgREST
// read error as "this table does not exist" vs. anything else. Kept in
// its own module (no import of supabaseClient.js, no import.meta.env
// dependency) so it can be unit-tested directly under plain Node, not
// only inside a Vite-bundled browser build — see
// scripts/test-disaster-recovery.mjs §7.
//
// PostgREST returns code "PGRST205" with the message shape
// "Could not find the table 'public.<name>' in the schema cache" when a
// table genuinely does not exist on the connected project (this is
// exactly the error the live "user_preferences" Disaster Recovery
// failure reported — see src/lib/backup/constants.js's audit note).
// Matched on the message too, in case a future PostgREST version keeps
// the wording but changes the code, since failing to recognize this
// shape would silently fall through to "unexpected error, abort" —
// which is the SAFE default, never the dangerous one, but the explicit
// message match keeps the optional-table skip working regardless.
//
// 2026-10 Question Bank gap closure: question_secrets/question_version_secrets
// are read via an admin-only RPC (table-level SELECT is revoked), not a
// direct PostgREST `.from()` call — see disasterExport.js's readViaRpc().
// When that RPC's body references a table that genuinely does not exist
// on the connected project, Postgres itself raises SQLSTATE 42P01
// ("undefined_table") with a message like `relation "public.<name>" does
// not exist`, a DIFFERENT shape than PostgREST's PGRST205/"could not find
// the table" — both are recognized here, so a confirmed missing-relation
// is never missed just because it arrived through an RPC call instead of
// a direct table read. Still deliberately narrow: only these two exact,
// confirmed "the relation does not exist" signals ever return true here —
// never a permission, RLS, network, or generic error.
export function isMissingTableError(err) {
  if (!err) return false;
  if (err.code === "PGRST205") return true;
  if (err.code === "42P01") return true;
  if (typeof err.message === "string" && /could not find the table/i.test(err.message)) return true;
  return typeof err.message === "string" && /relation ".*" does not exist/i.test(err.message);
}
