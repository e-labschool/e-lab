// Builds the per-dataset reconciliation report requested by the 2026-10
// live-schema reconciliation (part 2): for EVERY known dataset —
//
//   dataset | source status | live status | backup status | row count | warning/error
//
// — not just the two Class Planner tables that prompted this. Kept
// dependency-free (only imports constants.js, no Supabase/browser import)
// so it can be unit-tested directly under plain Node, exactly like
// tableAccess.js/datasetFetch.js — see scripts/test-disaster-recovery.mjs.
//
// This module never decides abort-vs-skip itself (that remains
// datasetFetch.js's job, driven by `required` + isMissingTableError) — it
// only re-describes the ALREADY-DECIDED outcome (`out`/`counts`/`skipped`/
// `failures` from fetchAllDatasets) in the five-column shape the admin
// asked to see, for every dataset, so the admin never has to cross-
// reference tablesSkipped against a separate table list by hand.
import { DEPLOYMENT_TIER } from "./constants.js";

function sourceStatusFor(entry) {
  // Every BACKUP_DATASETS entry has already passed the audit this file's
  // header documents (constants.js): a genuine `create table` (or, for
  // the platform_settings singleton, schema.sql) migration AND real
  // application code that queries/writes it by name. That's "present in
  // source" — a claim about THIS repository, never about whether it is
  // actually deployed on any particular live project (see liveStatus,
  // decided per-export below).
  return entry.deploymentTier === DEPLOYMENT_TIER.EXCLUDED ? "excluded_from_backup" : "present_in_source";
}

/**
 * @param {Array} datasets - BACKUP_DATASETS (or a subset/superset shaped
 *   the same way); every entry is represented in the output even if it
 *   was never attempted (e.g. includeUserData=false runs).
 * @param {{counts?: object, skipped?: Array, failures?: Array}} fetchResult
 *   - the object fetchAllDatasets returns (out/counts/skipped/failures).
 * @returns {Array<{table: string, deploymentTier: string, sourceStatus: string,
 *   liveStatus: "deployed"|"not_deployed"|"error"|"not_evaluated",
 *   backupStatus: "exported"|"not_deployed"|"failed"|"not_evaluated",
 *   rowCount: number, warning: string|null}>}
 */
export function buildDatasetReport(datasets, { counts, skipped, failures } = {}) {
  const evaluated = Boolean(counts || skipped || failures);
  const skippedByTable = new Map((skipped || []).map((s) => [s.table, s]));
  const failureByTable = new Map((failures || []).map((f) => [f.table, f]));

  return datasets.map((entry) => {
    const { table } = entry;
    const failure = failureByTable.get(table);
    const skip = skippedByTable.get(table);

    if (!evaluated) {
      return {
        table,
        deploymentTier: entry.deploymentTier,
        sourceStatus: sourceStatusFor(entry),
        liveStatus: "not_evaluated",
        backupStatus: "not_evaluated",
        rowCount: 0,
        warning: "This run did not read user/progress/assessment/planning/settings tables (includeUserData=false).",
      };
    }

    if (failure) {
      return {
        table,
        deploymentTier: entry.deploymentTier,
        sourceStatus: sourceStatusFor(entry),
        liveStatus: "error",
        backupStatus: "failed",
        rowCount: 0,
        warning: failure.message,
      };
    }

    if (skip) {
      return {
        table,
        deploymentTier: entry.deploymentTier,
        sourceStatus: sourceStatusFor(entry),
        liveStatus: "not_deployed",
        backupStatus: "not_deployed",
        rowCount: 0,
        warning: skip.reason,
      };
    }

    return {
      table,
      deploymentTier: entry.deploymentTier,
      sourceStatus: sourceStatusFor(entry),
      liveStatus: "deployed",
      backupStatus: "exported",
      rowCount: (counts && counts[table]) ?? 0,
      warning: null,
    };
  });
}
