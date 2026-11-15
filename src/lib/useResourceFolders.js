import { useState, useEffect, useMemo, useCallback } from "react";
import { loadFolders, loadFoldersForAdmin } from "./folderService.js";
import { buildTree, filterFoldersForRole, synthesizeLegacyFolders } from "./resourceFolders.js";

/**
 * Loads the folder rows for a role with graceful fallback.
 *  role: 'student' | 'teacher' | 'admin'
 *  Returns { folders (rows visible to role), tree, source: 'database'|'fallback', reason, loading, refetch }.
 * `reason` (fallback only): 'not-migrated' | 'empty' | 'error' | 'not-connected'.
 * Student/teacher pages treat an empty table like a missing one (synthesised legacy folders), so
 * nothing looks different until the owner has actually seeded folders.  The admin manager
 * (`strict: true`) sees the real, possibly empty, table.
 */
export function useResourceFolders(role, { strict = false } = {}) {
  const [state, setState] = useState({ rows: synthesizeLegacyFolders(), source: "fallback", reason: null, loading: true, error: null });
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (strict ? loadFoldersForAdmin() : loadFolders())
      .then((res) => { if (!cancelled) setState({ rows: res.folders, source: res.source, reason: res.reason, loading: false, error: res.error ?? null }); })
      .catch((err) => { if (!cancelled) setState({ rows: synthesizeLegacyFolders(), source: "fallback", reason: "error", loading: false, error: err?.message ?? null }); });
    return () => { cancelled = true; };
  }, [strict, token]);

  const folders = useMemo(() => filterFoldersForRole(state.rows, role), [state.rows, role]);
  const tree = useMemo(() => buildTree(folders), [folders]);
  const refetch = useCallback(() => setToken((t) => t + 1), []);
  return { folders, tree, source: state.source, reason: state.reason, error: state.error, loading: state.loading, refetch };
}
