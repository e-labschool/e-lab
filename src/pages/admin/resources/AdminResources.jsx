import { useState, useEffect, useMemo } from "react";
import { Plus, Search, FileText, Lock, Globe, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { listAllResourcesForAdmin, updateResource, deleteResource } from "../../../lib/resourceService.js";
import ResourceActions from "../../../components/resources/ResourceActions.jsx";
import { resourceFromRow } from "../../../lib/resourceActions.js";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import ResourceForm from "./ResourceForm.jsx";
import { useResourceFolders } from "../../../lib/useResourceFolders.js";
import { resolveResourceFolderId, folderOptionsForAudience, getDescendantIds, getAncestry } from "../../../lib/resourceFolders.js";

const STATUS_TONE = { draft: "neutral", published: "teal", hidden: "amber" };
const DEFAULT_FILTERS = { audience: "All", folder: "All", level: "All", status: "All", search: "" };

export default function AdminResources() {
  const { isConfigured } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [editing, setEditing] = useState(null); // resource being edited, or {} for "new"
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [refetchToken] = useState(0);
  const { folders, tree } = useResourceFolders("admin");
  // folder (or legacy category fallback) each resource lives in
  const folderIdOf = (r) => resolveResourceFolderId(r, folders, "admin");

  useEffect(() => {
    if (!isConfigured) return;
    listAllResourcesForAdmin()
      .then((data) => setResources(data))
      .catch((err) => setLoadError(err.message || "Couldn't load resources."))
      .finally(() => setLoading(false));
  }, [isConfigured, refetchToken]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return resources.filter((r) => {
      if (filters.audience !== "All" && r.audience !== filters.audience) return false;
      if (filters.folder !== "All") {
        const fid = folderIdOf(r);
        const inFolder = fid === filters.folder || (fid != null && getDescendantIds(tree, filters.folder).includes(fid));
        if (!inFolder && !(fid == null && r.category === filters.folder)) return false; // category fallback when unfiled
      }
      if (filters.level !== "All" && r.level !== filters.level) return false;
      if (filters.status !== "All" && r.status !== filters.status) return false;
      if (q && !`${r.title} ${r.description ?? ""} ${r.topic ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, filters, folders, tree]);

  const folderFilterOptions = useMemo(() => [
    { value: "All", label: "Folder: All" },
    ...folderOptionsForAudience(folders, "both").map((o) => ({ value: o.id, label: o.label })),
    // legacy categories that match no folder (e.g. older free-text values) stay filterable
    ...[...new Set(resources.filter((r) => resolveResourceFolderId(r, folders, "admin") == null).map((r) => r.category))].map((c) => ({ value: c, label: `${c} (no folder)` })),
  ], [folders, resources]);

  async function toggleStatus(resource) {
    setBusyId(resource.id);
    try {
      const nextStatus = resource.status === "published" ? "hidden" : "published";
      const updated = await updateResource(resource.id, { status: nextStatus });
      setResources((prev) => prev.map((r) => (r.id === resource.id ? updated : r)));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleLock(resource) {
    setBusyId(resource.id);
    try {
      const updated = await updateResource(resource.id, { is_locked: !resource.is_locked });
      setResources((prev) => prev.map((r) => (r.id === resource.id ? updated : r)));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    setBusyId(pendingDelete.id);
    try {
      await deleteResource(pendingDelete);
      setResources((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!isConfigured) {
    return <p className="p-10 text-sm text-[var(--color-ink-soft)]">Resources management requires Supabase to be connected.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Resources</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Upload, organize and manage learning resources across e-Lab.</p>
        </div>
        <Button onClick={() => setEditing({})}><Plus size={15} /> Add Resource</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
          <input
            type="text" placeholder="Search resources" value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="w-56 rounded-md border border-[var(--color-line)] bg-transparent py-1.5 pl-7 pr-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
          />
        </div>
        <FilterSelect label="Audience" value={filters.audience} options={["All", "student", "teacher", "both"]} onChange={(v) => setFilters((f) => ({ ...f, audience: v }))} />
        <FilterSelect label="Folder" value={filters.folder} options={folderFilterOptions} onChange={(v) => setFilters((f) => ({ ...f, folder: v }))} />
        <FilterSelect label="Level" value={filters.level} options={["All", "SL", "HL", "SL & HL"]} onChange={(v) => setFilters((f) => ({ ...f, level: v }))} />
        <FilterSelect label="Status" value={filters.status} options={["All", "draft", "published", "hidden"]} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
        {JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) && (
          <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-[var(--color-ink-faint)]">{filtered.length} of {resources.length}</span>
      </div>

      {loadError && <p className="mt-4 text-sm text-[var(--color-coral)]">{loadError}</p>}

      {loading ? (
        <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-[var(--color-ink-faint)]">
          {resources.length === 0 ? "No resources yet — add your first one." : "No resources match these filters."}
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-line)] p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)]">
                <FileText size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--color-ink)]">
                  {r.title} {r.is_locked && <Lock size={12} className="text-[var(--color-amber)]" />}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  <Badge tone="neutral">{r.audience}</Badge>
                  <Badge tone="neutral">{folderIdOf(r) ? getAncestry(tree, folderIdOf(r)).map((n) => n.name).join(" / ") : r.category}</Badge>
                  {r.topic && <Badge tone="indigo">{r.subtopic || r.topic}</Badge>}
                  {r.level && <Badge tone="neutral">{r.level}</Badge>}
                  {r.access_tier === "premium" && <Badge tone="amber">Premium</Badge>}
                </div>
              </div>
              {/* View (eye) + Download: same component as the student/teacher pages, so the admin can check an upload.  Never locked/blocked for the admin. */}
              <ResourceActions resource={resourceFromRow(r)} compact />
              <div className="flex shrink-0 items-center gap-1">
                <IconAction label="Edit" icon={Pencil} onClick={() => setEditing(r)} />
                <IconAction
                  label={r.status === "published" ? "Unpublish" : "Publish"}
                  icon={Globe} active={r.status === "published"}
                  onClick={() => toggleStatus(r)}
                  busy={busyId === r.id}
                />
                <IconAction label={r.is_locked ? "Unlock" : "Lock"} icon={Lock} active={r.is_locked} onClick={() => toggleLock(r)} busy={busyId === r.id} />
                <IconAction label="Delete" icon={Trash2} danger onClick={() => setPendingDelete(r)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ResourceForm
          resource={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setResources((prev) => (editing.id ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev]));
            setEditing(null);
          }}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingDelete(null)}>
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[var(--color-ink)]">Delete "{pendingDelete.title}"?</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">This will remove the resource and its uploaded file.</p>
            <div className="mt-4 flex gap-3">
              <Button variant="danger" onClick={confirmDelete} disabled={busyId === pendingDelete.id}>
                {busyId === pendingDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </Button>
              <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o === "All" ? `${label}: All` : o } : o));
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-xs text-[var(--color-ink-soft)] focus:border-[var(--color-ink)]"
    >
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function IconAction({ label, icon: Icon, onClick, danger, active, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        danger ? "text-[var(--color-ink-faint)] hover:bg-[var(--color-coral-soft)] hover:text-[var(--color-coral)]" :
        active ? "bg-[var(--color-amber-soft)] text-[var(--color-amber)]" :
        "text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"
      }`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
    </button>
  );
}
