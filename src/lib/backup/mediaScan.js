// Finds e-Lab learn-media references embedded inside JSONB block/question
// content, without assuming any particular block schema — it walks
// whatever JSON shape it is given and pattern-matches on the bucket's
// public URL, which is how media is actually referenced in this project
// (see LearnBlockRenderer.jsx / learnContentService.js — full public
// Supabase Storage URLs are stored inline, not relative paths).
import { LEARN_MEDIA_BUCKET } from "./constants.js";

const MEDIA_URL_RE = new RegExp(
  `/storage/v1/object/public/${LEARN_MEDIA_BUCKET}/([^"'\\s)\\\\]+)`,
  "g"
);

function scan(value, referencedBy, foundMap) {
  if (value == null) return;
  if (typeof value === "string") {
    MEDIA_URL_RE.lastIndex = 0;
    let match;
    while ((match = MEDIA_URL_RE.exec(value))) {
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
    for (const item of value) scan(item, referencedBy, foundMap);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) scan(item, referencedBy, foundMap);
  }
}

/**
 * Scans an array of { id, ...jsonFields } rows for learn-media references
 * across the given field names, returning a Map<path, Set<referencedBy>>.
 */
export function collectMediaReferences(rows, fields, labelPrefix, into) {
  const foundMap = into ?? new Map();
  for (const row of rows) {
    for (const field of fields) {
      scan(row[field], `${labelPrefix}:${row.id}`, foundMap);
    }
  }
  return foundMap;
}

export function mediaMapToManifest(foundMap) {
  return [...foundMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, refs]) => ({
      bucket: LEARN_MEDIA_BUCKET,
      path,
      referencedBy: [...refs].sort(),
    }));
}
