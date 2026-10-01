// Strict 1:1 parent/child cardinality verification for Question Bank
// secret tables, added alongside the readViaRpc() pagination fix
// (disasterExport.js) so a truncated secret export can never again be
// mistaken for a healthy/complete backup.
//
// Confirmed-from-real-code 1:1 relationships this guards:
//   questions <-> question_secrets           (save_question_with_secrets()'s
//                                              single-transaction upsert
//                                              into both tables)
//   question_versions <-> question_version_secrets
//                                             (mark_learn_check_answers()'s
//                                              unconditional lookup)
//
// Equal COUNTS alone are not sufficient proof of an intact 1:1
// relationship — two tables could have equal counts while covering
// different id sets (e.g. one truncation masking another), which a bare
// count comparison would miss entirely. This compares the actual id sets
// on both sides, never just their lengths.
//
// Never touches secret VALUES (correct_answer_data/markscheme/
// explanation) — only the id/foreign-key columns, which already appear
// in every other part of this same backup package (manifest counts,
// relationshipWarnings, etc.). Never fabricates a missing row to "fix" a
// mismatch — a gap is reported honestly, by id, never invented.
export function checkOneToOneCardinality(
  parentRows,
  childRows,
  { parentKey = "id", childKey, parentLabel, childLabel, sampleLimit = 20 } = {}
) {
  if (!childKey) throw new Error("checkOneToOneCardinality requires childKey.");
  const parentIds = new Set((parentRows || []).map((r) => r[parentKey]));
  const childIds = new Set((childRows || []).map((r) => r[childKey]));

  const missingChildren = [...parentIds].filter((id) => !childIds.has(id)); // parent rows with NO matching secret
  const orphanChildren = [...childIds].filter((id) => !parentIds.has(id)); // secret rows with no matching parent
  const duplicateChildKeys = []; // a child key appearing more than once also violates strict 1:1
  {
    const seen = new Set();
    for (const row of childRows || []) {
      const key = row[childKey];
      if (seen.has(key)) duplicateChildKeys.push(key);
      else seen.add(key);
    }
  }

  const ok = missingChildren.length === 0 && orphanChildren.length === 0 && duplicateChildKeys.length === 0;

  return {
    parentLabel,
    childLabel,
    parentCount: (parentRows || []).length,
    childCount: (childRows || []).length,
    missingChildrenCount: missingChildren.length,
    orphanChildrenCount: orphanChildren.length,
    duplicateChildKeysCount: duplicateChildKeys.length,
    // Capped samples so a large mismatch never dumps thousands of ids
    // into the manifest — this is diagnostic context, not the full gap
    // listing (the real gap is fully knowable from the two data files
    // already in this same package).
    missingChildrenSample: missingChildren.slice(0, sampleLimit),
    orphanChildrenSample: orphanChildren.slice(0, sampleLimit),
    duplicateChildKeysSample: duplicateChildKeys.slice(0, sampleLimit),
    ok,
  };
}
