import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowUp, ArrowDown, Trash2, Loader2, FolderPlus, Info, AlertTriangle, Lock } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useResourceFolders } from "../../../lib/useResourceFolders.js";
import { listAllResourcesForAdmin } from "../../../lib/resourceService.js";
import {
  createFolder, renameFolder, moveFolder, reorderFolder, setFolderAudience, setFolderTier, deleteFolder, seedLegacyFolders,
} from "../../../lib/folderService.js";
import {
  getFolder, getAncestry, flattenTree, countResources, resolveResourceFolderId, validateMove, inheritsPremium, MAX_FOLDER_DEPTH,
  audienceFitsUnder, normaliseFolderTier,
} from "../../../lib/resourceFolders.js";
import { DEFAULT_ACCESS_CONFIG, showPremiumUi } from "../../../lib/access/accessPolicy.js";
import FolderTree from "../../../components/resources/FolderTree.jsx";
import Button from "../../../components/ui/Button.jsx";
import LockToggle from "../../../components/admin/LockToggle.jsx";

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30 disabled:opacity-50";
const labelClasses = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";
const AUDIENCE_LABEL = { student: "Students", teacher: "Teachers", both: "Both" };
// Shared wording for the lock toggle.  Locks are saved as access_tier 'premium' / 'free' and only take effect once the
// Premium master switch (Admin -> Simulation access) is ON.
const LOCK_HELP_OFF = "Premium is not active yet — everything is free for everyone right now. Locks are saved and only take effect once Premium is switched on (master switch in Simulation access).";
const LOCK_HELP_ON = "Locked folders are only open to members with Premium access; their sub-folders and resources inherit the lock.";
const card = "rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5";

export default function AdminFolders({ accessConfig = DEFAULT_ACCESS_CONFIG }) {
  const { isConfigured } = useAuth();
  const { folders, tree, source, reason, error: loadError, loading, refetch } = useResourceFolders("admin", { strict: true });
  const [resources, setResources] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(null); // { parent_id } | null
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canWrite = source === "database";

  useEffect(() => {
    if (!isConfigured) return;
    listAllResourcesForAdmin().then(setResources).catch(() => setResources([]));
  }, [isConfigured]);

  const counts = useMemo(() => countResources(tree, resources, (r) => resolveResourceFolderId(r, folders, "admin")), [tree, resources, folders]);
  const selected = getFolder(tree, selectedId);
  const premiumUi = showPremiumUi(accessConfig);

  const run = useCallback(async (fn, okMessage) => {
    setBusy(true); setError(null); setNotice(null);
    try { const out = await fn(); refetch(); setNotice(okMessage ?? null); return out; }
    catch (err) { setError(err.message || "Something went wrong."); return null; }
    finally { setBusy(false); }
  }, [refetch]);

  if (!isConfigured) return <p className="p-10 text-sm text-[var(--color-ink-soft)]">Folder management requires Supabase to be connected.</p>;

  const direct = selected ? counts.direct.get(selected.id) ?? 0 : 0;
  const total = selected ? counts.total.get(selected.id) ?? 0 : 0;
  const kids = selected?.children.length ?? 0;
  const deleteBlocked = kids > 0 ? `This folder has ${kids} sub-folder${kids === 1 ? "" : "s"}. Move or delete ${kids === 1 ? "it" : "them"} first.`
    : direct > 0 ? `This folder contains ${direct} resource${direct === 1 ? "" : "s"}. Move ${direct === 1 ? "it" : "them"} to another folder first (Resources → Edit → Folder).` : null;

  const moveTargets = selected ? [{ id: "", label: "Top level (no parent)", ok: validateMove(folders, selected.id, null).ok },
    ...flattenTree(tree).filter((n) => n.id !== selected.id).map((n) => ({ id: n.id, label: n.pathString, ok: validateMove(folders, selected.id, n.id).ok }))].filter((o) => o.ok && o.id !== (selected.parent_id ?? "")) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Resource folders</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Create folders here. They appear in the Folder dropdown when you add a resource.</p>

      {!loading && !canWrite && (
        <div role="status" data-testid="folders-notice" className="mt-5 flex gap-3 rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-amber-soft)] p-4 text-sm text-[var(--color-ink)]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--color-amber)]" aria-hidden="true" />
          <div>
            <p className="font-medium">{reason === "error" ? "Folders couldn't be loaded." : "The folders table has not been created yet."}</p>
            <p className="mt-1 text-[var(--color-ink-soft)]">
              {reason === "error" && loadError ? `${loadError} ` : ""}You are seeing the standard folders built from the current categories. Everything works as before, but creating, renaming, moving and deleting folders is switched off until the owner applies the folders SQL (see docs/RESOURCE_FOLDERS.md).
            </p>
          </div>
        </div>
      )}
      {!loading && canWrite && folders.length === 0 && (
        <div role="status" className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-line)] p-4 text-sm text-[var(--color-ink-soft)]">
          <Info size={16} aria-hidden="true" /> The folders table is empty. Students and teachers still see the standard folders until you add some.
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(seedLegacyFolders, "Standard folders created.")}>Create the four standard folders</Button>
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-[var(--color-coral)]">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-[var(--color-teal)]">{notice}</p>}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className={`${card} min-w-0`} aria-label="Folder list">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Folders</h2>
            <Button size="sm" disabled={!canWrite || busy} onClick={() => { setCreating({ parent_id: null }); setSelectedId(null); }}><Plus size={14} /> New folder</Button>
          </div>
          <div className="mt-3">
            {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
              : tree.roots.length === 0 ? <p className="py-6 text-sm text-[var(--color-ink-faint)]">No folders yet.</p>
              : <FolderTree
                  roots={tree.roots} selectedId={selectedId} ariaLabel="Resource folders"
                  onSelect={(id) => { setSelectedId(id); setCreating(null); setConfirmDelete(false); setNotice(null); setError(null); }}
                  counts={counts.total}
                  renderMeta={(n) => (
                    <span className="flex shrink-0 items-center gap-1">
                      {n.audience !== "student" && <span className="rounded-full border border-[var(--color-line)] px-1.5 text-[10px] uppercase tracking-wide text-[var(--color-ink-faint)]">{AUDIENCE_LABEL[n.audience]}</span>}
                      {n.access_tier === "premium" && <span title="Locked for Premium" className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-amber)]/40 bg-[var(--color-amber-soft)] px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-amber)]"><Lock size={9} aria-hidden="true" />Premium</span>}
                      {n.access_tier !== "premium" && inheritsPremium(tree, n.id) && <span data-testid="locked-via-folder" title="Locked via a parent folder" className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-line)] px-1.5 text-[10px] uppercase tracking-wide text-[var(--color-ink-faint)]"><Lock size={9} aria-hidden="true" />via folder</span>}
                    </span>
                  )}
                />}
          </div>
          <p className="mt-4 text-xs text-[var(--color-ink-faint)]">Select a folder to rename, move, reorder, change its audience or lock it for Premium.</p>
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {creating && <CreateFolderPanel key={creating.parent_id ?? "top"} parent={getFolder(tree, creating.parent_id)} tree={tree} busy={busy} onCancel={() => setCreating(null)}
            onCreate={async (fields) => { const row = await run(() => createFolder(fields), "Folder created."); if (row) { setCreating(null); setSelectedId(row.id); } }} />}

          {!creating && selected && (
            <section className={card} aria-label={`Folder: ${selected.name}`} data-testid="folder-details">
              <h2 className="text-base font-semibold text-[var(--color-ink)]">Folder: {selected.name}</h2>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{getAncestry(tree, selected.id).map((n) => n.name).join(" / ")} &middot; {kids} sub-folder{kids === 1 ? "" : "s"} &middot; {direct} resource{direct === 1 ? "" : "s"} here ({total} including sub-folders)</p>

              <RenameRow key={selected.id + selected.name} folder={selected} disabled={!canWrite || busy} onSave={(name) => run(() => renameFolder(selected.id, name), "Folder renamed.")} />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClasses} htmlFor="fd-audience">Audience</label>
                  <select id="fd-audience" className={inputClasses} value={selected.audience} disabled={!canWrite || busy}
                    onChange={(e) => run(() => setFolderAudience(selected.id, e.target.value), "Audience updated.")}>
                    {Object.entries(AUDIENCE_LABEL).filter(([v]) => !selected.parent || audienceFitsUnder(v, selected.parent.audience)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <span className={labelClasses} id="fd-lock-label">Premium lock (inherited by contents)</span>
                  <div className="flex items-center gap-3">
                    <LockToggle id="fd-lock" name={selected.name} locked={normaliseFolderTier(selected.access_tier) === "premium"} disabled={!canWrite || busy}
                      onChange={(on) => run(() => setFolderTier(selected.id, on ? "premium" : "free"), on ? "Folder locked for Premium." : "Folder unlocked (free).")} />
                    <span className="text-sm text-[var(--color-ink-soft)]" data-testid="lock-state">{normaliseFolderTier(selected.access_tier) === "premium" ? "Locked for Premium" : "Unlocked (free)"}</span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--color-ink-faint)]" data-testid="tier-help">
                {premiumUi ? LOCK_HELP_ON : LOCK_HELP_OFF}
              </p>
              {(normaliseFolderTier(selected.access_tier) === "premium" || inheritsPremium(tree, selected.id)) && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-[var(--color-ink-soft)]" data-testid="lock-inherit">
                  <Lock size={12} className="mt-0.5 shrink-0 text-[var(--color-amber)]" aria-hidden="true" />
                  <span>
                    {inheritsPremium(tree, selected.id)
                      ? `Locked via folder "${getAncestry(tree, selected.id).slice(0, -1).find((f) => normaliseFolderTier(f.access_tier) === "premium").name}": the most restrictive lock wins, so unlocking this folder alone does not open it.`
                      : `Everything inside (${total} resource${total === 1 ? "" : "s"}, ${kids} sub-folder${kids === 1 ? "" : "s"} and their contents) inherits this lock.`}
                  </span>
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 basis-60">
                  <label className={labelClasses} htmlFor="fd-move">Move to</label>
                  <MoveRow key={selected.id} options={moveTargets} disabled={!canWrite || busy} onMove={(pid) => run(() => moveFolder(selected.id, pid || null), "Folder moved.")} />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={!canWrite || busy} aria-label={`Move ${selected.name} up`} onClick={() => run(() => reorderFolder(selected.id, "up"), "Order updated.")}><ArrowUp size={14} /> Up</Button>
                  <Button variant="secondary" size="sm" disabled={!canWrite || busy} aria-label={`Move ${selected.name} down`} onClick={() => run(() => reorderFolder(selected.id, "down"), "Order updated.")}><ArrowDown size={14} /> Down</Button>
                  <Button variant="secondary" size="sm" disabled={!canWrite || busy || getAncestry(tree, selected.id).length >= MAX_FOLDER_DEPTH}
                    title={getAncestry(tree, selected.id).length >= MAX_FOLDER_DEPTH ? `Folders can be nested ${MAX_FOLDER_DEPTH} levels deep at most` : undefined}
                    onClick={() => setCreating({ parent_id: selected.id })}><FolderPlus size={14} /> Add sub-folder</Button>
                </div>
              </div>

              <div className="mt-6 border-t border-[var(--color-line)] pt-4">
                {deleteBlocked ? (
                  <p className="text-sm text-[var(--color-ink-soft)]" data-testid="delete-blocked"><Trash2 size={13} className="mr-1 inline" aria-hidden="true" /> Can't delete: {deleteBlocked}</p>
                ) : confirmDelete ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-[var(--color-ink)]">Delete the empty folder &ldquo;{selected.name}&rdquo;?</p>
                    <Button variant="danger" size="sm" disabled={busy} onClick={async () => { const pid = selected.parent_id; const ok = await run(() => deleteFolder(selected.id).then(() => true), "Folder deleted."); if (ok) { setSelectedId(pid ?? null); setConfirmDelete(false); } }}>Delete folder</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" disabled={!canWrite || busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete folder</Button>
                )}
                <p className="mt-2 text-xs text-[var(--color-ink-faint)]">Only empty folders can be deleted. Files are never moved or deleted by changing folders.</p>
              </div>
            </section>
          )}

          {!creating && !selected && !loading && (
            <section className={card}>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">Add a resource</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Select a folder on the left to manage it, or <Link to="/admin/resources" className="font-medium text-[var(--color-indigo)] underline">go to Resources</Link> to add a file &mdash; the Folder dropdown lists every folder here (filtered by the audience you choose).</p>
              {counts.unfiled > 0 && <p className="mt-2 text-xs text-[var(--color-ink-faint)]">{counts.unfiled} resource{counts.unfiled === 1 ? "" : "s"} use a category that matches no folder; they appear under &ldquo;All resources&rdquo; for readers.</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function RenameRow({ folder, disabled, onSave }) {
  const [name, setName] = useState(folder.name);
  return (
    <form className="mt-4 flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim() !== folder.name) onSave(name); }}>
      <div className="min-w-0 flex-1">
        <label className={labelClasses} htmlFor="fd-name">Name</label>
        <input id="fd-name" className={inputClasses} value={name} maxLength={80} disabled={disabled} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" variant="secondary" size="sm" disabled={disabled || !name.trim() || name.trim() === folder.name}>Rename</Button>
    </form>
  );
}

function MoveRow({ options, disabled, onMove }) {
  const [target, setTarget] = useState("__none__");
  return (
    <div className="flex gap-2">
      <select id="fd-move" className={inputClasses} value={target} disabled={disabled || options.length === 0} onChange={(e) => setTarget(e.target.value)}>
        <option value="__none__">{options.length ? "Choose a destination…" : "No other valid destination"}</option>
        {options.map((o) => <option key={o.id || "top"} value={o.id || "__top__"}>{o.label}</option>)}
      </select>
      <Button variant="secondary" size="sm" disabled={disabled || target === "__none__"} onClick={() => onMove(target === "__top__" ? "" : target)}>Move</Button>
    </div>
  );
}

function CreateFolderPanel({ parent, tree, busy, onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState(parent?.audience && parent.audience !== "both" ? parent.audience : (parent ? "both" : "student"));
  const [locked, setLocked] = useState(false);
  const allowed = Object.entries(AUDIENCE_LABEL).filter(([v]) => !parent || audienceFitsUnder(v, parent.audience));
  return (
    <section className={card} aria-label="New folder">
      <h2 className="text-base font-semibold text-[var(--color-ink)]">{parent ? `New sub-folder in ${getAncestry(tree, parent.id).map((n) => n.name).join(" / ")}` : "New top-level folder"}</h2>
      <form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); onCreate({ parent_id: parent?.id ?? null, name, audience, access_tier: locked ? "premium" : "free" }); }}>
        <div>
          <label className={labelClasses} htmlFor="nf-name">Name</label>
          <input id="nf-name" autoFocus required maxLength={80} className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelClasses} htmlFor="nf-audience">Audience</label>
          <select id="nf-audience" className={inputClasses} value={audience} onChange={(e) => setAudience(e.target.value)}>
            {allowed.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <span className={labelClasses}>Premium lock</span>
          <div className="flex items-center gap-3">
            <LockToggle id="nf-lock" name="the new folder" locked={locked} onChange={setLocked} />
            <span className="text-sm text-[var(--color-ink-soft)]">{locked ? "Locked for Premium" : "Unlocked (free)"}</span>
          </div>
        </div>
        <div className="flex gap-3 sm:col-span-3">
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create folder"}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </section>
  );
}
