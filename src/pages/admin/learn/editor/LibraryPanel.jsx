import { useRef, useState } from "react";
import { X, Download, Upload, Trash2, Plus } from "lucide-react";
import { exportLibrary, validateLibrary } from "../../../../lib/learnReuse.js";

const btn = "inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-ink)]/40 disabled:opacity-40";

/** Reusable block templates. Stored in this browser (localStorage) and moved between devices with Export / Import. */
export default function LibraryPanel({ templates, selectionCount, onSave, onInsert, onDelete, onImport, onClose }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const file = useRef(null);
  function doExport() {
    const blob = new Blob([JSON.stringify(exportLibrary(templates), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "elab-block-library.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function doImport(e) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try {
      const res = validateLibrary(JSON.parse(await f.text()));
      if (!res.ok) { setMsg(`Not imported: ${res.errors.join(" ")}`); return; }
      onImport(res.templates); setMsg(`Imported ${res.templates.length} template(s).`);
    } catch (err) { setMsg(`Not imported: ${err.message}`); }
  }
  return (
    <div role="dialog" aria-label="Block library" aria-modal="false" data-testid="library-panel" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
      className="fixed bottom-4 right-4 z-50 flex max-h-[80vh] w-[min(420px,calc(100vw-2rem))] flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] shadow-2xl">
      <header className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2"><h2 className="flex-1 text-sm font-semibold text-[var(--color-ink)]">Block library</h2><button type="button" className={btn} onClick={onClose} aria-label="Close library"><X size={13} /></button></header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <p className="text-[11px] text-[var(--color-ink-faint)]">Templates are kept in this browser. Use Export to back them up or move them to another computer.</p>
        <div className="flex gap-2">
          <input className="min-w-0 flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-sm" placeholder="Template name" aria-label="Template name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className={btn} disabled={!selectionCount} onClick={() => { onSave(name); setName(""); }}><Plus size={13} /> Save {selectionCount || 0} selected</button>
        </div>
        {!selectionCount && <p className="text-[11px] text-[var(--color-ink-faint)]">Select a block (Ctrl or Shift + click to select several) to save it as a template.</p>}
        <ul className="space-y-1.5">
          {templates.length === 0 && <li className="text-xs text-[var(--color-ink-faint)]">No templates yet.</li>}
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5" data-template={t.id}>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--color-ink)]">{t.name}</span><span className="block truncate text-[11px] text-[var(--color-ink-faint)]">{t.blocks.length} block{t.blocks.length > 1 ? "s" : ""}{t.preview ? ` - ${t.preview}` : ""}</span></span>
              <button type="button" className={btn} onClick={() => onInsert(t)}>Insert</button>
              <button type="button" className={btn} aria-label={`Delete template ${t.name}`} onClick={() => onDelete(t.id)}><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
        {msg && <p role="status" className="text-xs text-[var(--color-ink-soft)]">{msg}</p>}
      </div>
      <footer className="flex gap-2 border-t border-[var(--color-line)] p-2"><button type="button" className={btn} onClick={doExport} disabled={!templates.length}><Download size={13} /> Export</button><button type="button" className={btn} onClick={() => file.current?.click()}><Upload size={13} /> Import</button><input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Import block library file" onChange={doImport} /></footer>
    </div>
  );
}
