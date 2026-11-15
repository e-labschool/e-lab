import { GripVertical, ArrowUp, ArrowDown, Search, Link2 } from "lucide-react";
import { BLOCK_TYPES, getLearnBlockDisplayLabel } from "../../../../data/learnBlockRegistry.jsx";
import { buildRows, LAYOUT_PRESETS } from "../../../../lib/blockLayout.js";
import { matchesQuery } from "./editorUtils.js";

const COMMON = ["rich_text", "image", "simulation", "check_understanding", "key_idea", "video"];
const item = "flex min-h-9 w-full items-center gap-2 rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-left text-sm text-[var(--color-ink)] hover:border-[var(--color-indigo)] hover:text-[var(--color-indigo)]";

function PresetGlyph({ spans }) {
  return <span aria-hidden className="flex h-4 w-8 shrink-0 gap-0.5">{spans.map((s, i) => <span key={i} style={{ flex: s }} className="rounded-sm bg-[var(--color-indigo)]/55" />)}</span>;
}

/** Left column: add-a-block palette (click, press Enter, or drag onto the page), layout presets, outline + search. */
export default function EditorSidebar({ blocks, selectedId, onSelect, onAdd, onPreset, onOp, startDrag, query, onQuery, drag }) {
  const rows = buildRows(blocks);
  const rest = Object.entries(BLOCK_TYPES).filter(([type]) => !COMMON.includes(type));
  const dragProps = (payload, label) => ({ onPointerDown: (e) => startDrag(e, payload, label), style: { touchAction: "none" } });
  const typeButton = (type) => {
    const t = BLOCK_TYPES[type];
    return (
      <button key={type} type="button" onClick={() => onAdd(type)} {...dragProps({ kind: "new", type }, t.label)} title={`Add ${t.label} (click, or drag onto the page)`} className={item}>
        <t.icon size={14} aria-hidden className="shrink-0" /> <span className="min-w-0 truncate">{t.label}</span>
      </button>
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Add a block" className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Add a block</p>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">{COMMON.map(typeButton)}</div>
        <details className="mt-2">
          <summary className="cursor-pointer rounded px-1 py-1 text-xs font-medium text-[var(--color-indigo)]">More block types</summary>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 lg:grid-cols-1">{rest.map(([type]) => typeButton(type))}</div>
        </details>
        <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Layout presets</p>
        <div className="grid grid-cols-1 gap-1.5">
          {Object.entries(LAYOUT_PRESETS).map(([key, p]) => (
            <button key={key} type="button" onClick={() => onPreset(key)} {...dragProps({ kind: "preset", key }, p.label)} title={`Add ${p.label} (click, or drag onto the page)`} className={item}>
              <PresetGlyph spans={p.spans} /> {p.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-[var(--color-ink-faint)]">Click to add after the selected block, or drag onto the page (the side of a block places it beside).</p>
      </section>

      <section aria-label="Lesson outline" className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Outline</p>
        <div className="relative mb-2">
          <Search size={13} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
          <input type="search" aria-label="Search blocks" placeholder="Search blocks" value={query} onChange={(e) => onQuery(e.target.value)} className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] py-1.5 pl-7 pr-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none" />
        </div>
        <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto" data-testid="outline">
          {rows.flatMap((row) => row.cells.map((cell, ci) => {
            const b = cell.block; const lab = getLearnBlockDisplayLabel(b); const Icon = BLOCK_TYPES[b.block_type]?.icon;
            if (!matchesQuery(b, lab, query)) return null;
            const target = drag?.target?.id === b.id;
            return (
              <li key={b.id} data-drop-block={b.id} data-drop-vertical="1" data-drop-sides="0" data-outline-item={b.id} className={`flex items-center gap-1 rounded-md border px-1 py-1 ${selectedId === b.id ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-transparent hover:bg-[var(--color-line)]/25"} ${target ? (drag.target.zone === "before" ? "border-t-2 border-t-[var(--color-amber)]" : "border-b-2 border-b-[var(--color-amber)]") : ""} ${row.cells.length > 1 ? "ml-2 border-l-2 border-l-[var(--color-indigo)]/40" : ""}`}>
                <button type="button" aria-label={`Drag ${lab.typeLabel} in the outline`} {...dragProps({ kind: "move", id: b.id }, lab.typeLabel)} className="shrink-0 cursor-grab rounded p-1 text-[var(--color-ink-faint)]"><GripVertical size={13} /></button>
                <button type="button" onClick={() => onSelect(b.id, true)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-[var(--color-ink)]">
                  {Icon && <Icon size={12} aria-hidden className="shrink-0 text-[var(--color-ink-faint)]" />}
                  <span className="min-w-0 truncate"><span className="font-medium">{lab.typeLabel}</span>{lab.preview ? <span className="text-[var(--color-ink-faint)]"> · {lab.preview}</span> : null}</span>
                  {row.cells.length > 1 && ci === 0 && <Link2 size={11} aria-label="shares a row" className="shrink-0 text-[var(--color-indigo)]" />}
                </button>
                <button type="button" aria-label={`Move ${lab.typeLabel} up`} onClick={() => onOp("up", b.id)} className="rounded p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/40"><ArrowUp size={12} /></button>
                <button type="button" aria-label={`Move ${lab.typeLabel} down`} onClick={() => onOp("down", b.id)} className="rounded p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/40"><ArrowDown size={12} /></button>
              </li>
            );
          }))}
        </ol>
        {blocks.length === 0 && <p className="text-xs text-[var(--color-ink-faint)]">No blocks yet.</p>}
      </section>
    </div>
  );
}
