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
import { DEPLOYMENT_TIER, describeDatasetAbsence } from "./constants.js";

/**
 * @param {Array<{table: string, required?: boolean, deploymentTier?: string}>} datasets
 *   - BACKUP_DATASETS (or any subset/superset shaped the same way).
 *   `required` still drives the ONLY mechanic that matters for safety
 *   (abort vs. skip on a confirmed missing-relation error — see
 *   isMissingTableError below); `deploymentTier` only selects WHICH
 *   wording a skip is reported with (describeDatasetAbsence in
 *   constants.js), so a dataset with no explicit tier still behaves
 *   identically to before this field existed.
 * @param {(table: string) => Promise<any[]>} readTable - reads ALL rows of
 *   one table (or throws). Takes only the table name so this module never
 *   has to know about Supabase, pagination, or auth.
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<{
 *   out: Record<string, any[]>,
 *   counts: Record<string, number>,
 *   skipped: Array<{table: string, deploymentTier: string, reason: string}>,
 *   failures: Array<{table: string, required: boolean, deploymentTier: string, message: string, reason: string}>
 * }>}
 */
export async function fetchAllDatasets(datasets, readTable, onProgress = () => {}) {
  const out = {};
  const counts = {};
  const skipped = [];
  const failures = [];

  for (const entry of datasets) {
    const { table, required = true, deploymentTier } = entry;
    try {
      const rows = (await readTable(table)) ?? [];
      out[table] = rows;
      counts[table] = rows.length;
      onProgress(`Read ${table} (${rows.length})`);
    } catch (err) {
      // SAFETY INVARIANT (do not weaken): isMissingTableError() — a
      // CONFIRMED PostgREST "relation does not exist" / schema-cache-miss
      // signal — is the ONLY thing that may ever turn a non-required
      // table's failure into a non-aborting "not deployed" outcome.
      // Permission/RLS errors, network errors, timeouts, or any other
      // unexpected failure shape fall straight through to the `failures`
      // branch below, for every tier, with no exception.
      if (!required && isMissingTableError(err)) {
        out[table] = [];
        counts[table] = 0;
        skipped.push({
          table,
          deploymentTier: deploymentTier || DEPLOYMENT_TIER.OPTIONAL,
          reason: describeDatasetAbsence(entry),
        });
        onProgress(
          deploymentTier === DEPLOYMENT_TIER.NOT_DEPLOYED_IF_MISSING
            ? `Skipping ${table} (feature not deployed on this project) …`
            : `Skipping ${table} (table not present — optional) …`
        );
        continue;
      }
      // Either a required (required_live/feature_deployed) table, or a
      // not_deployed_if_missing/optional table that failed for a reason
      // OTHER than "does not exist" (RLS, network, etc.) — never silently
      // swallowed, regardless of tier. Recorded, NOT thrown here: every
      // remaining table in the manifest is still attempted, so one run
      // surfaces the complete set of problems (see this file's header).
      out[table] = [];
      counts[table] = 0;
      failures.push({
        table,
        required,
        deploymentTier: deploymentTier || (required ? DEPLOYMENT_TIER.REQUIRED_LIVE : DEPLOYMENT_TIER.OPTIONAL),
        message: err?.message || String(err),
        reason: required
          ? `Required table "${table}" could not be read.`
          : `Table "${table}" could not be read (not a "table missing" error, so this is not treated as not-deployed/optional).`,
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
