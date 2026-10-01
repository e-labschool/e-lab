// Shared, dependency-free "read every dataset in the manifest, in ONE
// complete pass" helper — the fix for the exact failure pattern the live
// project hit twice in a row:
//
//   user_preferences missing -> fix -> rerun -> prediction_cycles missing
//   -> fix -> rerun -> (next table) missing -> fix -> rerun -> ...
//
// The previous implementation (inlined in disasterExport.js) threw
// IMMEDIATELY on the first table whose read failed, whether required or
// not — so a single run could only ever reveal ONE problem, forcing
// exactly the one-at-a-time whack-a-mole loop the user is furious about,
// even with perfectly correct required/optional classification. The fix
// here is structural, not a reclassification: attempt EVERY table in the
// manifest, every time, and only decide whether to abort once the
// complete inventory has been attempted — so if two (or ten) required
// tables are simultaneously missing from a given live project, ONE run
// reports ALL of them, not just the first.
//
// Kept framework-free (no supabaseClient import) so it can be unit-tested
// directly under plain Node with a fake `readTable`, exactly like
// tableAccess.js's isMissingTableError — see
// scripts/test-disaster-recovery.mjs.
import { isMissingTableError } from "./tableAccess.js";

/**
 * @param {Array<{table: string, required?: boolean}>} datasets - BACKUP_DATASETS
 *   (or any subset/superset shaped the same way).
 * @param {(table: string) => Promise<any[]>} readTable - reads ALL rows of
 *   one table (or throws). Takes only the table name so this module never
 *   has to know about Supabase, pagination, or auth.
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<{
 *   out: Record<string, any[]>,
 *   counts: Record<string, number>,
 *   skipped: Array<{table: string, reason: string}>,
 *   failures: Array<{table: string, required: boolean, message: string, reason: string}>
 * }>}
 */
export async function fetchAllDatasets(datasets, readTable, onProgress = () => {}) {
  const out = {};
  const counts = {};
  const skipped = [];
  const failures = [];

  for (const { table, required = true } of datasets) {
    try {
      const rows = (await readTable(table)) ?? [];
      out[table] = rows;
      counts[table] = rows.length;
      onProgress(`Read ${table} (${rows.length})`);
    } catch (err) {
      if (!required && isMissingTableError(err)) {
        out[table] = [];
        counts[table] = 0;
        skipped.push({
          table,
          reason:
            "Classified OPTIONAL — this table does not exist in this Supabase project's schema cache. Skipped intentionally; this backup carries zero rows for it rather than failing the whole export.",
        });
        onProgress(`Skipping ${table} (table not present — optional) …`);
        continue;
      }
      // Either a required table, or an optional table that failed for a
      // reason OTHER than "does not exist" (RLS, network, etc.) — never
      // silently swallowed. Recorded, NOT thrown here: every remaining
      // table in the manifest is still attempted, so one run surfaces the
      // complete set of problems (see this file's header).
      out[table] = [];
      counts[table] = 0;
      failures.push({
        table,
        required,
        message: err?.message || String(err),
        reason: required
          ? `Required table "${table}" could not be read.`
          : `Table "${table}" could not be read (not a "table missing" error, so this is not treated as optional).`,
      });
      onProgress(`FAILED reading ${table}: ${err?.message || err}`);
    }
  }

  return { out, counts, skipped, failures };
}

/**
 * Throws ONE aggregated error naming every failed table, or does nothing
 * if `failures` is empty. Kept separate from fetchAllDatasets so callers
 * can inspect `failures` (e.g. to still show a partial-progress UI) before
 * deciding to abort.
 */
export function assertNoDatasetFailures(failures) {
  if (!failures.length) return;
  const lines = failures.map((f) => `  - ${f.table}: ${f.reason} ${f.message}`);
  throw new Error(
    `Complete Disaster Recovery aborted — ${failures.length} table(s) could not be read:\n${lines.join("\n")}`
  );
}
