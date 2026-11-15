import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Search, Folder, ChevronRight, Loader2, FolderOpen, X } from "lucide-react";
import FolderTree from "./FolderTree.jsx";
import ResourceRow from "./ResourceRow.jsx";
import EmptyStatePanel from "../ui/EmptyStatePanel.jsx";
import { useResourceFolders } from "../../lib/useResourceFolders.js";
import {
  resolveResourceFolderId, countResources, childFolders, getAncestry, flattenTree, searchResources, sortResources,
  SORT_OPTIONS, effectiveTier, folderIdForLegacyCategory, legacyCategoryForRole,
} from "../../lib/resourceFolders.js";
import { tierBadge, checkAction } from "../../lib/access/accessPolicy.js";
import { useAccessContext } from "../../lib/access/AccessConfigContext.jsx";

const inputBase = "rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";

/**
 * Shared folder browser for Student and Teacher Resources.
 * `resources` are the already audience/level-filtered, normalised resources (see useVisibleResources);
 * this component only organises them.  Folder visibility follows the role; tiers are shown ONLY through
 * accessPolicy (invisible while everything is free).
 */
export default function ResourceBrowser({
  role, resources, resourcesLoading = false, resourcesError = null, initialFolderRef = null, redirectIfUnknown = null,
  emptyTitle = "Resources will be added here soon.", emptyDescription, accessConfig = null,
}) {
  const { folders, tree, loading: foldersLoading, source } = useResourceFolders(role);
  // Site access config comes from the provider (everything free while Premium is off); the `accessConfig` prop overrides it (tests).
  const siteCtx = useAccessContext();
  const config = accessConfig ?? siteCtx.config;
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const loading = resourcesLoading || foldersLoading;

  // ---- which folder is selected (URL ?folder=, else a deep-link ref such as a legacy category id) ----
  const resolveRef = (ref) => {
    if (!ref) return null;
    if (tree.byId.has(ref)) return ref;
    const bySlug = folderIdForLegacyCategory(folders, legacyCategoryForRole(ref, role), role) ?? folderIdForLegacyCategory(folders, ref, role);
    return bySlug ?? null;
  };
  const paramRef = params.get("folder");
  const selectedId = resolveRef(paramRef) ?? (paramRef ? null : resolveRef(initialFolderRef));
  const unknownInitial = !loading && initialFolderRef && !paramRef && resolveRef(initialFolderRef) == null;

  const folderOf = useMemo(() => {
    const m = new Map();
    for (const r of resources) m.set(r.id, resolveResourceFolderId(r, folders, role));
    return m;
  }, [resources, folders, role]);
  const counts = useMemo(() => {
    const c = countResources(tree, resources, (r) => folderOf.get(r.id));
    const m = new Map(c.total); m.set(null, resources.length);
    return { map: m, unfiled: c.unfiled };
  }, [tree, resources, folderOf]);

  const pathOf = (r) => { const f = folderOf.get(r.id); return f ? getAncestry(tree, f).map((n) => n.name).join(" / ") : ""; };
  const searching = query.trim().length > 0;
  const selectFolder = (id) => { setQuery(""); setParams(id ? { folder: id } : {}); };

  const view = useMemo(() => {
    if (searching) return { folders: [], files: sortResources(searchResources(resources, query, pathOf), sort) };
    const files = resources.filter((r) => (folderOf.get(r.id) ?? null) === selectedId || (selectedId == null && !tree.byId.has(folderOf.get(r.id))));
    return { folders: childFolders(tree, selectedId), files: sortResources(files, sort) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, resources, query, sort, selectedId, folderOf, tree]);

  if (unknownInitial && redirectIfUnknown) return <Navigate to={redirectIfUnknown} replace />;

  const crumbs = getAncestry(tree, selectedId);
  const pickerOptions = flattenTree(tree);
  const rowFor = (r) => {
    const f = folderOf.get(r.id);
    const tier = effectiveTier(tree, f, r.accessTier);
    const item = { tier };
    const ctx = { signedIn: true, role, entitlement: siteCtx.entitlement, config };
    return (
      <ResourceRow
        key={r.id} resource={r} folderPath={searching ? pathOf(r) : null}
        tierChip={tierBadge(item, config)}
        blocked={!checkAction(item, "view", ctx).allowed}
        download={checkAction(item, "download", ctx)}
      />
    );
  };
  const nothing = view.folders.length === 0 && view.files.length === 0;

  return (
    <div data-testid="resource-browser" data-folder-source={source}>
      {resourcesError && <p className="mb-4 text-sm text-[var(--color-coral)]">Some resources couldn't be loaded: {resourcesError}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search all resources"
            placeholder="Search all resources" className={`${inputBase} h-11 w-full pl-9 pr-9`}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
              <X size={14} />
            </button>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-ink-soft)]">
          <span>Sort</span>
          <select aria-label="Sort resources" value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputBase} h-11 px-3`}>
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {/* Narrow screens: the tree collapses to a folder picker */}
      <div className="mt-4 md:hidden">
        <label className="block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="folder-picker">Folder</label>
        <select id="folder-picker" value={selectedId ?? ""} onChange={(e) => selectFolder(e.target.value || null)} className={`${inputBase} mt-1 h-11 w-full px-3`}>
          <option value="">All resources</option>
          {pickerOptions.map((n) => <option key={n.id} value={n.id}>{n.pathString}</option>)}
        </select>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden self-start rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2 md:block" aria-label="Folder navigation">
          <FolderTree roots={tree.roots} selectedId={selectedId} onSelect={selectFolder} counts={loading ? null : counts.map} rootLabel="All resources" ariaLabel="Resource folders" />
        </aside>

        <section aria-label="Resources" className="min-w-0">
          {searching ? (
            <p className="text-sm text-[var(--color-ink-soft)]" role="status" aria-live="polite">
              {view.files.length} result{view.files.length === 1 ? "" : "s"} for &ldquo;{query.trim()}&rdquo; in all folders
            </p>
          ) : (
            <nav aria-label="Breadcrumb">
              <ol className="m-0 flex flex-wrap items-center gap-1 p-0 text-sm">
                <li className="list-none">
                  <button type="button" onClick={() => selectFolder(null)} aria-current={selectedId == null ? "page" : undefined} className={`rounded px-1 hover:underline ${selectedId == null ? "font-semibold text-[var(--color-indigo)]" : "text-[var(--color-ink-soft)]"}`}>All resources</button>
                </li>
                {crumbs.map((c, i) => (
                  <li key={c.id} className="flex list-none items-center gap-1">
                    <span aria-hidden="true" className="text-[var(--color-ink-faint)]">/</span>
                    <button type="button" onClick={() => selectFolder(c.id)} aria-current={i === crumbs.length - 1 ? "page" : undefined} className={`rounded px-1 hover:underline ${i === crumbs.length - 1 ? "font-semibold text-[var(--color-indigo)]" : "text-[var(--color-ink-soft)]"}`}>{c.name}</button>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {loading ? (
            <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
          ) : nothing ? (
            <div className="mt-6">
              {searching
                ? <EmptyStatePanel icon={Search} title="No resources match your search." />
                : <EmptyStatePanel icon={FolderOpen} title={emptyTitle} description={emptyDescription} />}
            </div>
          ) : (
            <ul className="m-0 mt-3 overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-0">
              {view.folders.map((f) => {
                const n = counts.map.get(f.id) ?? 0;
                return (
                  <li key={f.id} className="list-none border-b border-[var(--color-line)] last:border-b-0">
                    <button type="button" onClick={() => selectFolder(f.id)} data-testid="folder-row" className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-line)]/20 sm:px-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"><Folder size={18} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--color-ink)]">{f.name}</span>
                        <span className="block text-xs text-[var(--color-ink-faint)]">Folder &middot; {n} item{n === 1 ? "" : "s"}</span>
                      </span>
                      {tierBadge({ tier: effectiveTier(tree, f.id, "free") }, config) === "premium" && <span className="text-xs font-medium text-[var(--color-amber)]">Premium</span>}
                      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--color-ink-faint)]" />
                    </button>
                  </li>
                );
              })}
              {view.files.map(rowFor)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
