// Finds e-Lab public-Storage-bucket references embedded inside JSONB
// block/question content, without assuming any particular block schema —
// it walks whatever JSON shape it is given and pattern-matches on a
// bucket's public URL, which is how media is actually referenced in this
// project (see LearnBlockRenderer.jsx / learnContentService.js /
// questionBankService.js — full public Supabase Storage URLs are stored
// inline, not relative paths, for every public bucket).
//
// 2026-10 gap closure: this scanner was previously hardcoded to
// learn-media only. It is now generalized to any public bucket
// (collectBucketReferences/bucketMediaMapToManifest, parameterized by
// `bucket`) so the SAME proven pattern — never a second, unrelated
// implementation — extends to question-media (Question Bank stimulus
// images). The original learn-media-only exports are kept as thin
// wrappers so every existing caller keeps working unchanged.
import { LEARN_MEDIA_BUCKET } from "./constants.js";

function buildMediaUrlRegex(bucket) {
  return new RegExp(`/storage/v1/object/public/${bucket}/([^"'\\s)\\\\]+)`, "g");
}

function scan(value, referencedBy, foundMap, re) {
  if (value == null) return;
  if (typeof value === "string") {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(value))) {
      let path = match[1];
      try {
        path = decodeURIComponent(path);
      } catch {
        // leave as-is if it isn't validly percent-encoded
      }
      if (!foundMap.has(path)) foundMap.set(path, new Set());
      foundMap.get(path).add(referencedBy);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scan(item, referencedBy, foundMap, re);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) scan(item, referencedBy, foundMap, re);
  }
}

/**
 * Scans an array of { id, ...jsonFields } rows for references to a given
 * PUBLIC bucket's objects across the given field names, returning a
 * Map<path, Set<referencedBy>>. Generalized version of
 * collectMediaReferences below — use this directly for any bucket other
 * than learn-media (e.g. "question-media").
 */
export function collectBucketReferences(rows, fields, bucket, labelPrefix, into) {
  const foundMap = into ?? new Map();
  const re = buildMediaUrlRegex(bucket);
  for (const row of rows) {
    for (const field of fields) {
      scan(row[field], `${labelPrefix}:${row.id}`, foundMap, re);
    }
  }
  return foundMap;
}

export function bucketMediaMapToManifest(foundMap, bucket) {
  return [...foundMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, refs]) => ({
      bucket,
      path,
      referencedBy: [...refs].sort(),
    }));
}

/** learn-media-only convenience wrapper, kept for every existing caller. */
export function collectMediaReferences(rows, fields, labelPrefix, into) {
  return collectBucketReferences(rows, fields, LEARN_MEDIA_BUCKET, labelPrefix, into);
}

/** learn-media-only convenience wrapper, kept for every existing caller. */
export function mediaMapToManifest(foundMap) {
  return bucketMediaMapToManifest(foundMap, LEARN_MEDIA_BUCKET);
}
