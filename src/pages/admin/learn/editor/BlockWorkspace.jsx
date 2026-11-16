import { useEffect, useMemo, useRef, useState } from "react";
import { Undo2, Redo2, Plus, MoreHorizontal, Eye, Rows3, LayoutGrid, Library } from "lucide-react";
import { BLOCK_TYPES, BLOCK_CATEGORIES, getLearnBlockDisplayLabel } from "../../../../data/learnBlockRegistry.jsx";
import * as L from "../../../../lib/blockLayout.js";
import * as C from "../../../../lib/blockCanvas.js";
import { describeBlock } from "../../../../lib/blockLayoutOps.js";
import { usePointerDrag, startResizeDrag } from "./usePointerDrag.js";
import { DEVICES, UNIT, GAP, matchesQuery } from "./editorUtils.js";
import BlockTile from "./BlockTile.jsx";
import EditDrawer from "./EditDrawer.jsx";
import LibraryPanel from "./LibraryPanel.jsx";
import Menu, { menuItem, MenuLabel } from "./Menu.jsx";

const tool = "inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/40 disabled:opacity-40";
const seg = (on) => `inline-flex min-h-9 items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-[var(--color-indigo)] text-white" : "bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"}`;

function useIsPhone() {
  const q = "(max-width: 639px)";
  const [phone, setPhone] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(q); const on = () => setPhone(m.matches);
    on(); m.addEventListener?.("change", on); return () => m.removeEventListener?.("change", on);
  }, []);
  return phone;
}

/** The Learn editor's arrangement area. Two views of ONE data model: Classic (stacked full-width rectangles; narrow one to let the next
 * block flow beside it) and Canvas (free placement on a 12-column grid, never overlapping). All lesson state lives in LessonEditor. */
export default function BlockWorkspace({
  blocks, view, onView, editingId, editSection, onEdit, onCloseEdit, onOp, onDrop, onAdd, onPreset, onDuplicate, onDelete, onToggleVisible, onMeta,
  onUndo, onRedo, canUndo, canRedo, live, renderPreview, renderEditor, checkCount = 0, collapsedIds, onCollapsedChange, library, extraMenu = [], focusBlockId,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [multi, setMulti] = useState(() => new Set());
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState("desktop");
  const [snap, setSnap] = useState(true);
  const [collision, setCollision] = useState("nearest");
  const [query, setQuery] = useState("");
  const [libOpen, setLibOpen] = useState(false);
  const [gesture, setGesture] = useState(null); // classic resize { id, kind: "span"|"h", value } | canvas { id, mode, dx, dy, target }
  const phone = useIsPhone();
  const { drag, start } = usePointerDrag({ onDrop });
  const canvasRef = useRef(null);
  const canvas = view === "canvas";

  useEffect(() => { if (focusBlockId && blocks.some((b) => b.id === focusBlockId)) { setSelectedId(focusBlockId); document.getElementById(`learn-block-${focusBlockId}`)?.scrollIntoView?.({ block: "center" }); } }, [focusBlockId, blocks.length]);
  useEffect(() => { if (selectedId && !blocks.some((b) => b.id === selectedId)) setSelectedId(null); }, [blocks, selectedId]);

  // ---- display model while a gesture is in progress (nothing is committed until release) ----
  const display = useMemo(() => {
    if (!gesture) return blocks;
    if (gesture.kind === "span") return L.setSpanFlow(blocks, gesture.id, gesture.value);
    if (gesture.kind === "h") return C.setUiHeight(blocks, gesture.id, gesture.value);
    if (gesture.kind === "move") return C.moveTo(blocks, gesture.id, gesture.col, gesture.gr, { collision });
    if (gesture.kind === "size") return C.resizeTo(blocks, gesture.id, { span: gesture.span, rs: gesture.rs, collision });
    return blocks;
  }, [blocks, gesture, collision]);

  const label = (b) => getLearnBlockDisplayLabel(b);
  const select = (id, e) => {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) { setMulti((m) => { const n = new Set(m.size ? m : selectedId ? [selectedId] : []); if (n.has(id)) n.delete(id); else n.add(id); return n; }); setSelectedId(id); return; }
    setMulti(new Set()); setSelectedId(id);
  };
  const toggleCollapsed = (id) => { const n = new Set(collapsedIds); if (n.has(id)) n.delete(id); else n.add(id); onCollapsedChange(n); };
  // Rows can re-mount when a block moves; keep keyboard focus on the block that was being operated on.
  const pendingFocus = useRef(null);
  useEffect(() => {
    const id = pendingFocus.current; if (!id) return;
    pendingFocus.current = null;
    const el = document.getElementById(`learn-block-${id}`);
    if (el && document.activeElement !== el && (document.activeElement === document.body || !document.activeElement || !document.contains(document.activeElement))) el.focus({ preventScroll: true });
  });
  const op = (name, id, arg) => {
    if (document.activeElement?.closest?.("[data-block-card]")?.dataset.blockCard === id || document.activeElement === document.body) pendingFocus.current = id;
    if (name === "markReviewed") return onMeta(id, { needsReview: false, reviewedAt: new Date().toISOString(), note: "" });
    if (name === "needsReview") return onMeta(id, { needsReview: true });
    return onOp(name, id, { snap, collision, ...(arg || {}) });
  };
  const selectionIds = () => (multi.size ? [...multi] : selectedId ? [selectedId] : []);

  function tileProps(b, extra = {}) {
    const lay = L.getLayout(b);
    const pm = canvas ? C.placements(display).find((p) => p.id === b.id) : null;
    return {
      block: b, label: { typeLabel: label(b).typeLabel }, selected: selectedId === b.id, multi: multi.has(b.id) && selectedId !== b.id, editing: editingId === b.id, collapsed: collapsedIds.has(b.id),
      dim: !matchesQuery(b, label(b), query), checkCount: b.block_type === "check_understanding" ? checkCount : 0, span: pm?.span ?? lay?.span ?? 12, full: L.isFullOnly(b.block_type),
      placement: describeBlock(display, b.id), canvas, onSelect: select, onEdit, onOp: op, onToggleCollapsed: toggleCollapsed, onDuplicate, onDelete: (id) => { setSelectedId(null); onDelete(id); },
      onToggleVisible, onSaveLibrary: (id) => { setMulti(new Set([id])); setSelectedId(id); setLibOpen(true); },
      dropZone: drag?.target?.id === b.id ? drag.target.zone : null, ...extra,
    };
  }

  // ---- classic: pointer handles ----
  function classicResize(b) { return (e, edge) => {
    if (edge === "right") {
      const cell = e.currentTarget.closest("[data-cell]"); const row = e.currentTarget.closest("[data-row]");
      if (!cell || !row) return;
      startResizeDrag(e, { rowEl: row, cellEl: cell, snap, presets: L.SPAN_PRESETS.filter((p) => p >= L.minSpanFor(b.block_type)), onChange: (sp) => setGesture(sp == null ? null : { id: b.id, kind: "span", value: sp }), onCommit: (sp) => { setGesture(null); op("span", b.id, { span: sp }); } });
    } else {
      e.preventDefault(); e.stopPropagation();
      const y0 = e.clientY; const h0 = C.getUiHeight(b); let last = h0;
      const mv = (ev) => { last = Math.max(1, Math.min(L.MAX_ROW_SPAN, h0 + Math.round((ev.clientY - y0) / UNIT))); setGesture({ id: b.id, kind: "h", value: last }); };
      const end = (commit) => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); setGesture(null); if (commit && last !== h0) op("height", b.id, { h: last }); };
      const up = () => end(true); const cancel = () => end(false);
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel);
    }
  }; }

  // ---- canvas: pointer move / resize ----
  function canvasPointer(b, mode) {
    return (e, edge) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault?.(); e.stopPropagation?.();
      const el = canvasRef.current; if (!el) return;
      const colW = el.getBoundingClientRect().width / 12;
      const me = C.placements(blocks).find((p) => p.id === b.id);
      const x0 = e.clientX; const y0 = e.clientY; let moved = false; let last = null;
      const kind = mode === "move" ? "move" : "size";
      const mv = (ev) => {
        const dx = ev.clientX - x0; const dy = ev.clientY - y0;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        const dc = Math.round(dx / colW); const dr = Math.round(dy / UNIT);
        last = kind === "move"
          ? { id: b.id, kind, dx, dy, col: me.col + dc, gr: Math.max(1, me.gr + dr) }
          : { id: b.id, kind, dx: 0, dy: 0, span: edge === "bottom" ? me.span : me.span + dc, rs: edge === "right" ? me.rs : Math.max(1, me.rs + dr) };
        setGesture(last);
      };
      const end = (commit) => {
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", key, true);
        setGesture(null);
        if (commit && last) { if (last.kind === "move") op("moveTo", b.id, { col: last.col, gr: last.gr, collision }); else op("resizeTo", b.id, { span: last.span, rs: last.rs, collision }); }
      };
      const up = () => end(true); const cancel = () => end(false);
      const key = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); end(false); } };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel); window.addEventListener("keydown", key, true);
    };
  }

  const rows = useMemo(() => (canvas ? [] : L.buildRows(display)), [display, canvas]);
  const pls = useMemo(() => (canvas ? C.placements(display) : []), [display, canvas]);
  const bottom = pls.reduce((m, p) => Math.max(m, p.gr + p.rs), 1);
  const px = DEVICES[device].px;

  const addMenu = (
    <Menu label="Add block" icon={<Plus size={14} />} buttonClass={`${tool} border-[var(--color-indigo)] text-[var(--color-indigo)]`} testId="add-block" panelClass="w-72 max-w-[calc(100vw-12px)]">
      {BLOCK_CATEGORIES.map((cat) => (
        <div key={cat.id}><MenuLabel>{cat.label}</MenuLabel>
          <div className="grid grid-cols-2 gap-0.5">
            {Object.entries(BLOCK_TYPES).filter(([, t]) => t.category === cat.id).map(([type, t]) => (
              <button key={type} type="button" role="menuitem" data-menu-close data-add-type={type} className={menuItem} onClick={() => onAdd(type, selectedId)}><t.icon size={13} aria-hidden className="shrink-0" /> <span className="truncate">{t.label}</span></button>
            ))}
          </div></div>
      ))}
      <MenuLabel>Presets</MenuLabel>
      {Object.entries(L.LAYOUT_PRESETS).map(([key, p]) => <button key={key} type="button" role="menuitem" data-menu-close data-preset={key} className={menuItem} onClick={() => onPreset(key, selectedId)}>{p.label}</button>)}
      <MenuLabel>Reuse</MenuLabel>
      <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => setLibOpen(true)}><Library size={13} /> From block library...</button>
    </Menu>
  );
  const moreMenu = (
    <Menu label="More" icon={<MoreHorizontal size={14} />} buttonClass={tool} align="right" testId="more-menu" panelClass="w-64">
      <MenuLabel>Blocks</MenuLabel>
      <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => onCollapsedChange(new Set(blocks.map((b) => b.id)))}>Collapse all</button>
      <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => onCollapsedChange(new Set())}>Expand all</button>
      <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => setLibOpen(true)}>Block library...</button>
      <MenuLabel>Arrange</MenuLabel>
      <label className={menuItem}><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap widths to presets</label>
      {canvas && <><label className={menuItem}><input type="radio" name="collision" checked={collision === "nearest"} onChange={() => setCollision("nearest")} /> On overlap: snap to nearest free slot</label>
        <label className={menuItem}><input type="radio" name="collision" checked={collision === "push"} onChange={() => setCollision("push")} /> On overlap: push following blocks down</label></>}
      <MenuLabel>Student preview width</MenuLabel>
      <div className="flex gap-1 px-1.5">{Object.entries(DEVICES).map(([k, d]) => <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)} className={`${tool} flex-1 ${device === k ? "!bg-[var(--color-indigo)] !text-white" : ""}`}>{d.label}</button>)}</div>
      <MenuLabel>Find</MenuLabel>
      <div className="px-1.5 pb-1"><input type="search" aria-label="Search this lesson's blocks" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this lesson" className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1.5 text-xs" /></div>
      {extraMenu.length > 0 && <MenuLabel>Lesson</MenuLabel>}
      {extraMenu.map((it) => <button key={it.label} type="button" role="menuitem" data-menu-close className={menuItem} onClick={it.onClick}>{it.label}</button>)}
    </Menu>
  );

  const editing = editingId ? blocks.find((b) => b.id === editingId) : null;

  return (
    <div data-testid="block-workspace" data-view={view}>
      <div role="status" aria-live="polite" className="sr-only" data-testid="layout-live">{live}</div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Editor tools">
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-line)]" role="group" aria-label="Arrangement view">
          <button type="button" aria-pressed={!canvas} onClick={() => onView("classic")} className={seg(!canvas)} title="Stacked rectangles, one after another"><Rows3 size={13} /> Classic</button>
          <button type="button" aria-pressed={canvas} onClick={() => onView("canvas")} className={seg(canvas)} title="Free placement on a grid"><LayoutGrid size={13} /> Canvas</button>
        </div>
        {addMenu}
        <button type="button" className={tool} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)"><Undo2 size={13} /> Undo</button>
        <button type="button" className={tool} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Y)"><Redo2 size={13} /> Redo</button>
        <button type="button" aria-pressed={preview} onClick={() => setPreview((v) => !v)} className={`${tool} ${preview ? "!border-[var(--color-indigo)] !bg-[var(--color-indigo)] !text-white" : ""}`}><Eye size={13} /> Preview as student</button>
        <span className="sm:ml-auto">{moreMenu}</span>
      </div>

      {preview ? (
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 sm:p-4" data-testid="layout-preview" data-device={device}>
          <p className="mb-2 text-center text-[11px] text-[var(--color-ink-faint)]">This is the student page ({DEVICES[device].label}{px ? `, ${px}px` : ""}): full content, natural heights. Side-by-side placement needs a 640px-wide lesson column.</p>
          <div className="mx-auto overflow-x-hidden" style={{ maxWidth: px ? `${px}px` : "980px" }}>{renderPreview(device)}</div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 pt-10 sm:p-4 sm:pt-12" data-testid="layout-canvas" data-view={view} data-phone={phone ? "1" : "0"}>
          {blocks.length === 0 && <p className="pb-6 text-center text-sm text-[var(--color-ink-faint)]">No blocks yet. Use Add block to start.</p>}
          {phone ? (
            <ol className="flex flex-col gap-2" data-testid="phone-list">
              {(canvas ? C.readingOrder(display) : L.buildRows(display).flatMap((r) => r.cells.map((c) => c.block))).map((b) => <li key={b.id}><BlockTile {...tileProps(b, { variant: "list" })} /></li>)}
            </ol>
          ) : canvas ? (
            <div ref={canvasRef} className="relative lb-guides" data-testid="canvas-surface" style={{ height: (bottom + 3) * UNIT }}>
              {C.readingOrder(display).map((b) => {
                const p = pls.find((x) => x.id === b.id);
                const g = gesture && gesture.id === b.id && gesture.kind === "move" ? gesture : null;
                const collapsed = collapsedIds.has(b.id);
                return (
                  <div key={b.id} data-cell data-block-id={b.id} data-col={p.col} data-span={p.span} data-gr={p.gr} data-rs={p.rs} className="absolute" style={{ left: `${((p.col - 1) / 12) * 100}%`, width: `${(p.span / 12) * 100}%`, top: (p.gr - 1) * UNIT, height: collapsed ? undefined : p.rs * UNIT, padding: 3, zIndex: g ? 50 : selectedId === b.id ? 20 : 1, transform: g ? `translate(${g.dx}px, ${g.dy}px)` : undefined, opacity: g ? 0.85 : 1, transition: gesture ? "none" : undefined, pointerEvents: g ? "none" : undefined }}>
                    <BlockTile {...tileProps(b, { variant: "canvas", height: "100%", onGripDown: canvasPointer(b, "move"), onResizeDown: canvasPointer(b, "size") })} />
                  </div>
                );
              })}
              {gesture?.kind === "move" && (() => { const t = C.placements(display).find((p) => p.id === gesture.id); return t ? <div aria-hidden data-testid="canvas-ghost" className="pointer-events-none absolute rounded-md border-2 border-dashed border-[var(--color-amber)] bg-[var(--color-amber)]/10" style={{ left: `${((t.col - 1) / 12) * 100}%`, width: `${(t.span / 12) * 100}%`, top: (t.gr - 1) * UNIT, height: t.rs * UNIT }} /> : null; })()}
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: GAP * 1.5 }} data-testid="classic-list">
              {rows.map((row) => (
                <div key={row.id} data-row data-row-id={row.id} data-row-size={row.cells.length} className="grid items-start" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: GAP }}>
                  {row.cells.map((cell) => (
                    <div key={cell.block.id} data-cell data-block-id={cell.block.id} data-span={cell.span} style={{ gridColumn: `${cell.start ?? "auto"} / span ${cell.span}`, minWidth: 0 }}>
                      <BlockTile {...tileProps(cell.block, { variant: "classic", height: C.getUiHeight(cell.block) * UNIT, onGripDown: (e) => start(e, { kind: "move", id: cell.block.id }, label(cell.block).typeLabel), onResizeDown: classicResize(cell.block) })} />
                    </div>
                  ))}
                </div>
              ))}
              <div data-drop-end="1" data-testid="drop-end" className={`flex min-h-10 items-center justify-center rounded-md border-2 border-dashed text-xs font-semibold ${drag ? (drag.target?.zone === "end" ? "border-[var(--color-amber)] bg-[var(--color-amber-soft)] text-[var(--color-amber)]" : "border-[var(--color-amber)]/50 text-[var(--color-ink-soft)]") : "border-transparent text-transparent"}`}>{drag ? "Drop here to move to the end" : " "}</div>
            </div>
          )}
        </div>
      )}

      {drag && drag.payload && <div aria-hidden className="pointer-events-none fixed z-[100] rounded-md border border-[var(--color-indigo)] bg-[var(--color-paper-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--color-indigo)] shadow-lg" style={{ left: drag.x + 14, top: drag.y + 14 }}>{drag.label}</div>}
      {editing && <EditDrawer block={editing} label={{ typeLabel: label(editing).typeLabel }} section={editSection} onClose={onCloseEdit} onMeta={onMeta}>{renderEditor(editing)}</EditDrawer>}
      {libOpen && <LibraryPanel templates={library.templates} selectionCount={selectionIds().length} onClose={() => setLibOpen(false)} onSave={(name) => library.onSave(name, selectionIds())} onInsert={(t) => library.onInsert(t, selectedId)} onDelete={library.onDelete} onImport={library.onImport} />}
    </div>
  );
}
