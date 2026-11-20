import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { getBlockMeta, normalizeCodes } from "../../../lib/learnMeta.js";

const input = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-sm text-[var(--color-ink)]";

/** Small collapsed "Tags / review" disclosure shown under a block's editor in the plain list editor. */
export default function BlockTagsReview({ block, onMeta }) {
  const meta = getBlockMeta(block);
  const [codes, setCodes] = useState(meta.codes.join(", "));
  useEffect(() => { setCodes(getBlockMeta(block).codes.join(", ")); }, [block.id]);
  const commitCodes = () => { const next = normalizeCodes(codes); if (next.join() !== meta.codes.join()) onMeta(block.id, { codes: next }); };
  return (
    <details className="mt-3 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3" data-testid="block-tags-review">
      <summary className="cursor-pointer text-xs font-semibold text-[var(--color-ink)]">
        Tags / review
        {meta.needsReview && <span className="ml-2 rounded bg-[var(--color-amber-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-amber)]">Needs review</span>}
        {meta.codes.length > 0 && <span className="ml-2 font-normal text-[var(--color-ink-faint)]">{meta.codes.join(", ")}</span>}
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-[var(--color-ink-soft)]">Syllabus codes (comma separated)<input className={input} value={codes} placeholder="S1.2.3, S1.2.4" onChange={(e) => setCodes(e.target.value)} onBlur={commitCodes} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitCodes(); } }} /></label>
        <label className="text-[11px] text-[var(--color-ink-soft)]">Guide version<input className={input} value={meta.guide} placeholder="2025" maxLength={24} onChange={(e) => onMeta(block.id, { guide: e.target.value })} /></label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-soft)]">
        <label className="inline-flex min-h-9 items-center gap-1.5"><input type="checkbox" checked={meta.needsReview} onChange={(e) => onMeta(block.id, { needsReview: e.target.checked })} /> Needs review</label>
        <button type="button" onClick={() => onMeta(block.id, { needsReview: false, reviewedAt: new Date().toISOString(), note: "" })} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 font-semibold hover:border-[var(--color-ink)]/40"><CheckCheck size={13} /> Mark reviewed</button>
        <span>{meta.reviewedAt ? `Last reviewed ${meta.reviewedAt.slice(0, 10)}` : "Not reviewed yet"}</span>
      </div>
    </details>
  );
}
