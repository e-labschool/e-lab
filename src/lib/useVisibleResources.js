import { useState, useEffect } from "react";
import { isSupabaseConfigured } from "./supabaseClient.js";
import { listVisibleResources } from "./resourceService.js";
import { viewResource } from "./resourceActions.js";

// Normalizes a Supabase `resources` row into the SAME shape
// student-resources.js entries already use (title, description, category,
// topic, fileType, resourceType, fileSizeLabel, filePath, externalUrl,
// downloadable) — so ResourceCard and the existing filtering logic in
// resourceUtils.js need no restructuring, only small additive support for
// the two fields static entries never had: isLocked and needsSignedUrl.
function normalizeSupabaseResource(row) {
  const fileType = row.mime_type?.includes("pdf") ? "PDF"
    : row.mime_type?.includes("word") ? "DOCX"
    : row.mime_type?.includes("presentation") ? "PPTX"
    : row.mime_type?.includes("sheet") ? "XLSX"
    : row.external_url ? "Link" : "File";

  return {
    id: `sb-${row.id}`,
    title: row.title,
    description: row.description ?? "",
    category: row.category,
    folderId: row.folder_id ?? null, // undefined/null before the resource-folders migration -> legacy category fallback
    createdAt: row.created_at ?? null,
    accessTier: row.access_tier ?? "free",
    topic: row.subtopic || row.topic || null,
    resourceType: row.resource_type,
    fileType,
    fileSizeLabel: row.file_size ? `${(row.file_size / 1024).toFixed(0)} KB` : undefined,
    filePath: null, // never a direct path for Supabase-stored files — see needsSignedUrl
    externalUrl: row.external_url ?? null,
    downloadable: Boolean(row.file_path) && !row.is_locked,
    isLocked: row.is_locked,
    needsSignedUrl: Boolean(row.file_path),
    supabaseFilePath: row.file_path,
    mimeType: row.mime_type ?? null,
    originalFileName: row.original_file_name ?? null,
    audience: row.audience,
  };
}

/** Fetches Supabase-backed resources visible to the current signed-in role. Static entries from data/student-resources.js are merged in by the caller, not here — this hook only knows about Supabase. */
export function useVisibleResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const [refetchToken, setRefetchToken] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    listVisibleResources()
      .then((rows) => setResources(rows.map(normalizeSupabaseResource)))
      .catch((err) => setError(err.message || "Couldn't load resources."))
      .finally(() => setLoading(false));
  }, [refetchToken]);

  return { resources, loading, error, refetch: () => setRefetchToken((t) => t + 1) };
}

/** Kept for compatibility: opens the resource in a new tab (see resourceActions.viewResource for the behaviour). */
export async function openResource(resource) {
  return viewResource(resource);
}
