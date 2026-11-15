import { useMemo, useState } from "react";
import { GripVertical, ChevronDown, ChevronRight, Pencil, Eye, EyeOff, Undo2, Redo2, ImageIcon } from "lucide-react";
import { BLOCK_TYPES, getLearnBlockDisplayLabel } from "../../../../data/learnBlockRegistry.jsx";
import LearnBlockRenderer from "../../../../components/learn/LearnBlockRenderer.jsx";
import * as L from "../../../../lib/blockLayout.js";
import { opForKey } from "../../../../lib/blockLayoutOps.js";
import { usePointerDrag, startResizeDrag } from "./usePointerDrag.js";
import { HEAVY_TYPES, DEVICES, WIDTH_LABELS, matchesQuery } from "./editorUtils.js";
import EditorSidebar from "./EditorSidebar.jsx";
import LayoutSettingsPanel from "./LayoutSettingsPanel.jsx";

const tool = "inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/40 disabled:opacity-40";
const segBtn = (on) => `min-h-9 px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-[var(--color-indigo)] text-white" : "bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"}`;

/** The Learn editor's page canvas: palette + outline (left), 12-column canvas (centre), settings (right).
 * All lesson state lives in LessonEditor; this component only reports intents:
 *   onOp(name, blockId, arg)         layout operations (blockLayoutOps.runLayoutOp)
 *   onDrop(payload, target)          drag release ({kind:"move"|"new"|"preset"}, {id, zone})
 *   onAdd(type) / onPreset(key)      add (after the selection)  */
export default function BlockWorkspace({
  blocks, editingId, onEdit, onOp, onDrop, onAdd, onPreset, onDuplicate, onDelete, onToggleVisible,
  onUndo, onRedo, canUndo, canRedo, live, renderPreview, collapsedIds, onCollapsedChange,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("edit");
  const [device, setDevice] = useState("desktop");
  const [snap, setSnap] = useState(true);
  const [guides, setGuides] = useState(true);
  const [query, setQuery] = useState("");
  const [resizing, setResizing] = useState(null);
  const { drag, start } = usePointerDrag({ onDrop });

  const display = useMemo(() => (resizing ? L.setSpan(blocks, resizing.id, resizing.span) : blocks), [blocks, resizing]);
  const rows = useMemo(() => L.buildRows(display), [display]);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const edit = mode === "edit";
  const px = DEVICES[device].px;

  function select(id, scroll) {
    setSelectedId(id);
    if (scroll) document.getElementById(`learn-block-${id}`)?.scrollIntoView({ block: "center", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function toggleCollapsed(id) {
    const next = new Set(collapsedIds); if (next.has(id)) next.delete(id); else next.add(id); onCollapsedChange(next);
  }
  const op = (name, id, arg) => onOp(name, id, { snap, ...(arg || {}) });

  return (
    <div data-testid="block-workspace">
      <div role="status" aria-live="polite" className="sr-only" data-testid="layout-live">{live}</div>

      <div className="mb-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Editor tools">
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-line)]" role="group" aria-label="Mode">
          <button type="button" aria-pressed={edit} onClick={() => setMode("edit")} className={segBtn(edit)}>Edit layout</button>
          <button type="button" aria-pressed={!edit} onClick={() => setMode("preview")} className={segBtn(!edit)}>Preview</button>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
          <span id="page-width-label">Page width</span>
          <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-line)]" role="group" aria-labelledby="page-width-label">
            {Object.entries(DEVICES).map(([k, d]) => <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)} className={segBtn(device === k)}>{d.label}</button>)}
          </div>
        </div>
        <button type="button" className={tool} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)"><Undo2 size={13} /> Undo</button>
        <button type="button" className={tool} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)"><Redo2 size={13} /> Redo</button>
        {edit && (
          <>
            <label className="inline-flex min-h-9 items-center gap-1.5 text-xs text-[var(--color-ink-soft)]"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap to grid</label>
            <label className="inline-flex min-h-9 items-center gap-1.5 text-xs text-[var(--color-ink-soft)]"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Column guides</label>
            <button type="button" className={`${tool} sm:ml-auto`} onClick={() => onCollapsedChange(new Set(blocks.map((b) => b.id)))}>Collapse all</button>
            <button type="button" className={tool} onClick={() => onCollapsedChange(new Set())}>Expand all</button>
          </>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-4 ${edit ? "lg:grid-cols-[210px_minmax(0,1fr)_270px]" : "grid-cols-1"}`}>
        {edit && (
          <div className="order-2 min-w-0 lg:order-none">
            <EditorSidebar blocks={blocks} selectedId={selectedId} onSelect={select} onAdd={(t) => onAdd(t, selectedId)} onPreset={(k) => onPreset(k, selectedId)} onOp={op} startDrag={start} query={query} onQuery={setQuery} drag={drag} />
          </div>
        )}

        <div className="order-1 min-w-0 lg:order-none">
          {edit ? (
            <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 sm:p-4">
              <div className={`lb-edit relative mx-auto rounded-md ${guides ? "lb-guides" : ""}`} style={{ maxWidth: px ? `${px}px` : undefined }} data-testid="layout-canvas" data-device={device}>
                <div className="flex flex-col gap-3">
                  {rows.map((row) => (
                    <div key={row.id} className="lb-row" data-row={row.id} data-row-size={row.cells.length} style={{ "--lb-gap": "0.75rem" }}>
                      {row.cells.map((cell) => (
                        <div key={cell.block.id} className="lb-cell" data-block-id={cell.block.id} data-align={cell.align} data-mobile={cell.mobile} data-span={cell.span} style={{ "--lb-span": cell.span, ...(cell.start ? { "--lb-start": cell.start } : {}) }}>
                          <BlockCard
                            block={cell.block} span={cell.span} blocks={display} selected={selectedId === cell.block.id} editing={editingId === cell.block.id}
                            collapsed={collapsedIds.has(cell.block.id)} dim={!matchesQuery(cell.block, getLearnBlockDisplayLabel(cell.block), query)}
                            drag={drag} snap={snap}
                            onSelect={select} onToggleCollapsed={toggleCollapsed} onEdit={onEdit} onToggleVisible={onToggleVisible} onOp={op} startDrag={start}
                            onResize={setResizing}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                  <div data-drop-end="1" data-testid="drop-end" className={`flex min-h-12 items-center justify-center rounded-md border-2 border-dashed text-xs font-semibold transition-colors ${drag ? (drag.target?.zone === "end" ? "border-[var(--color-amber)] bg-[var(--color-amber-soft)] text-[var(--color-amber)]" : "border-[var(--color-amber)]/50 text-[var(--color-ink-soft)]") : "border-transparent text-transparent"}`}>
                    {drag ? "Drop here to add at the end" : blocks.length === 0 ? "" : " "}
                  </div>
                </div>
                {blocks.length === 0 && !drag && <p className="pb-6 text-center text-sm text-[var(--color-ink-faint)]">No blocks yet. Click a block type on the left, or drag one onto this page.</p>}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 sm:p-4" data-testid="layout-preview" data-device={device}>
              <p className="mb-2 text-center text-[11px] text-[var(--color-ink-faint)]">Preview as a student sees it ({DEVICES[device].label}{px ? `, ${px}px` : ""}). Side-by-side placement needs a 640px-wide lesson column.</p>
              <div className="mx-auto overflow-x-hidden" style={{ maxWidth: px ? `${px}px` : "980px" }}>{renderPreview(device)}</div>
            </div>
          )}
        </div>

        {edit && (
          <div className="order-3 min-w-0 lg:order-none">
            <div className="lg:sticky lg:top-3">
              <LayoutSettingsPanel blocks={blocks} block={selected} onOp={op} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={(id) => { setSelectedId(null); onDelete(id); }} onToggleVisible={onToggleVisible} />
            </div>
          </div>
        )}
      </div>

      {drag && drag.payload && (
        <div aria-hidden className="pointer-events-none fixed z-[100] rounded-md border border-[var(--color-indigo)] bg-[var(--color-paper-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--color-indigo)] shadow-lg" style={{ left: drag.x + 14, top: drag.y + 14 }}>{drag.label}</div>
      )}
    </div>
  );
}

function BlockCard({ block, span, blocks, selected, editing, collapsed, dim, drag, snap, onSelect, onToggleCollapsed, onEdit, onToggleVisible, onOp, startDrag, onResize }) {
  const label = getLearnBlockDisplayLabel(block);
  const Icon = BLOCK_TYPES[block.block_type]?.icon;
  const full = L.isFullOnly(block.block_type);
  const id = block.id;
  const placement = L.describePlacement(blocks, id);
  const target = drag?.target?.id === id ? drag.target.zone : null;
  const c = block.content ?? {};
  const noImage = block.block_type === "image" && !c.url;

  function onKeyDown(e) {
    if (e.target !== e.currentTarget) return;
    const name = opForKey(e);
    if (name) { e.preventDefault(); onOp(name, id); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(id); }
  }

  function resizeStart(e) {
    const cell = e.currentTarget.closest(".lb-cell"); const row = e.currentTarget.closest(".lb-row");
    if (!cell || !row) return;
    startResizeDrag(e, { rowEl: row, cellEl: cell, snap, presets: L.SPAN_PRESETS.filter((p) => p >= L.minSpanFor(block.block_type)), onChange: (sp) => onResize(sp == null ? null : { id, span: sp }), onCommit: (sp) => { onResize(null); onOp("span", id, { span: sp }); } });
  }

  return (
    <div
      id={`learn-block-${id}`}
      data-drop-block={id}
      data-drop-sides={full ? "0" : "1"}
      data-block-card={id}
      data-selected={selected ? "true" : "false"}
      tabIndex={0}
      role="group"
      aria-roledescription="block"
      aria-label={`${label.typeLabel}${label.preview ? `: ${label.preview}` : ""}. ${placement}. Alt plus arrow keys move it, Alt plus Shift plus Left or Right resizes it, Enter edits content.`}
      onFocus={() => onSelect(id)}
      onClick={() => onSelect(id)}
      onKeyDown={onKeyDown}
      className={`group relative rounded-md border bg-[var(--color-paper-raised)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] ${selected ? "border-[var(--color-indigo)] ring-2 ring-[var(--color-indigo)]/40" : "border-[var(--color-line)]"} ${block.visible ? "" : "border-dashed opacity-60"} ${dim ? "opacity-30" : ""} ${editing ? "shadow-[0_0_0_2px_var(--color-amber)]" : ""}`}
    >
      <div className="flex items-center gap-1 border-b border-[var(--color-line)] px-1.5 py-1">
        <button type="button" aria-label={`Drag ${label.typeLabel} to move it (or use Alt plus arrow keys)`} onPointerDown={(e) => startDrag(e, { kind: "move", id }, label.typeLabel)} style={{ touchAction: "none" }} className="cursor-grab rounded p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40"><GripVertical size={14} /></button>
        <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[var(--color-indigo-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-indigo)]">
          {Icon && <Icon size={11} aria-hidden />}<span className="truncate">{label.typeLabel}</span>
        </span>
        {!full && <span className="shrink-0 text-[10px] text-[var(--color-ink-faint)]" aria-hidden>{WIDTH_LABELS[span] ?? `${span}/12`}</span>}
        {c.audience === "hl" && <span className="shrink-0 rounded bg-[var(--color-violet-soft)] px-1 py-0.5 text-[10px] font-semibold text-[var(--color-violet)]">HL</span>}
        <div className="ml-auto flex items-center">
          <button type="button" aria-label={collapsed ? `Expand ${label.typeLabel}` : `Collapse ${label.typeLabel}`} aria-expanded={!collapsed} onClick={(e) => { e.stopPropagation(); onToggleCollapsed(id); }} className="rounded p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40">{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button>
          <button type="button" aria-label={`Edit ${label.typeLabel} content`} onClick={(e) => { e.stopPropagation(); onEdit(id); }} className="rounded p-1.5 text-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]"><Pencil size={13} /></button>
          <button type="button" aria-label={block.visible ? `Hide ${label.typeLabel}` : `Show ${label.typeLabel}`} onClick={(e) => { e.stopPropagation(); onToggleVisible(id); }} className="rounded p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40">{block.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        </div>
      </div>
      {collapsed ? (
        <p className="truncate px-3 py-1.5 text-[11px] text-[var(--color-ink-faint)]">{label.preview || "—"}</p>
      ) : (
        <div className="pointer-events-none max-h-56 select-none overflow-hidden p-2.5" aria-hidden="true">
          {HEAVY_TYPES.has(block.block_type) || noImage ? (
            <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-6 text-center text-xs text-[var(--color-ink-faint)]">
              {noImage ? <ImageIcon size={14} /> : Icon && <Icon size={14} />}
              <span className="min-w-0 truncate">{noImage ? "Choose an image (Edit content)" : label.preview || label.typeLabel}</span>
            </div>
          ) : (
            <LearnBlockRenderer block={block} inCell={L.hasLayout(block)} />
          )}
        </div>
      )}
      {!full && selected && (
        <button
          type="button" aria-label={`Resize width: ${span} of 12 columns. Drag, or use Left and Right arrow keys.`}
          onPointerDown={resizeStart}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); onOp("narrower", id); } else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); onOp("wider", id); } }}
          style={{ touchAction: "none" }}
          className="absolute -right-2 top-1/2 z-10 h-8 w-3.5 -translate-y-1/2 cursor-ew-resize rounded-sm border-2 border-[var(--color-indigo)] bg-[var(--color-paper-raised)] shadow"
        />
      )}
      {target && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-md" data-drop-indicator={target}>
          {(target === "left" || target === "right") && (
            <div className={`absolute inset-y-0 flex w-1/2 items-center justify-center border-2 border-dashed border-[var(--color-amber)] bg-[var(--color-amber)]/15 text-center text-xs font-bold text-[var(--color-amber)] ${target === "left" ? "left-0" : "right-0"}`}>Drop here to place beside</div>
          )}
          {target === "before" && <div className="absolute inset-x-0 top-0 h-1.5 bg-[var(--color-amber)]" />}
          {target === "after" && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[var(--color-amber)]" />}
        </div>
      )}
    </div>
  );
}
