import { useEffect, useRef, useState } from "react";
import { X, CheckCheck } from "lucide-react";
import { getBlockMeta, normalizeCodes } from "../../../../lib/learnMeta.js";

const input = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-sm text-[var(--color-ink)]";

/** Focused drawer with the full existing block editor (rich text, image, ... unchanged) plus the block's tags / review fields. */
export default function EditDrawer({ block, label, onClose, onMeta, children, section }) {
  const ref = useRef(null);
  const meta = getBlockMeta(block);
  const [codes, setCodes] = useState(meta.codes.join(", "));
  useEffect(() => { setCodes(getBlockMeta(block).codes.join(", ")); }, [block.id]);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    return () => { if (prev && document.contains(prev)) prev.focus?.(); };
  }, [block.id]);
  useEffect(() => { if (section === "tags") ref.current?.querySelector("[data-tags]")?.scrollIntoView?.({ block: "start" }); }, [section, block.id]);
  const commitCodes = () => { const next = normalizeCodes(codes); if (next.join() !== meta.codes.join()) onMeta(block.id, { codes: next }); };
  return (
    <section ref={ref} tabIndex={-1} id="block-content-editor" role="dialog" aria-modal="false" aria-label={`Edit ${label.typeLabel}`} data-testid="content-panel"
      onKeyDown={(e) => { if (e.key === "Escape" && !e.defaultPrevented) { e.stopPropagation(); onClose(); } }}
      className="fixed inset-y-0 right-0 z-50 flex w-[min(560px,100vw)] flex-col border-l border-[var(--color-line)] bg-[var(--color-paper)] shadow-2xl outline-none">
      <header className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-ink)]">Edit: {label.typeLabel}</h2>
        <button type="button" onClick={onClose} aria-label="Close editor" className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 text-xs font-semibold text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/40"><X size={14} /> Done</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div data-tags className="mb-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <p className="text-xs font-semibold text-[var(--color-ink)]">Tags and review</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-[var(--color-ink-soft)]">Syllabus codes (comma separated)<input className={input} value={codes} placeholder="S1.2.3, S1.2.4" onChange={(e) => setCodes(e.target.value)} onBlur={commitCodes} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitCodes(); } }} /></label>
            <label className="text-[11px] text-[var(--color-ink-soft)]">Guide version<input className={input} value={meta.guide} placeholder="2025" maxLength={24} onChange={(e) => onMeta(block.id, { guide: e.target.value })} /></label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-soft)]">
            <label className="inline-flex min-h-9 items-center gap-1.5"><input type="checkbox" checked={meta.needsReview} onChange={(e) => onMeta(block.id, e.target.checked ? { needsReview: true } : { needsReview: false })} /> Needs review</label>
            <button type="button" onClick={() => onMeta(block.id, { needsReview: false, reviewedAt: new Date().toISOString(), note: "" })} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 font-semibold hover:border-[var(--color-ink)]/40"><CheckCheck size={13} /> Mark reviewed</button>
            <span>{meta.reviewedAt ? `Last reviewed ${meta.reviewedAt.slice(0, 10)}` : "Not reviewed yet"}</span>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
