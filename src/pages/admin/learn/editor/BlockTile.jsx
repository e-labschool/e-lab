import { GripVertical, Copy, Trash2, ChevronDown, ChevronRight, Pencil, MoreHorizontal, Eye, EyeOff, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, BookmarkPlus, Flag, CheckCheck, ImageIcon } from "lucide-react";
import { BLOCK_TYPES } from "../../../../data/learnBlockRegistry.jsx";
import { opForKey } from "../../../../lib/blockLayoutOps.js";
import { getBlockMeta } from "../../../../lib/learnMeta.js";
import Menu, { menuItem, MenuLabel } from "./Menu.jsx";
import { tilePreview, WIDTH_LABELS, QUICK_WIDTHS } from "./editorUtils.js";

const tb = "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded px-1.5 text-[11px] font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-indigo-soft)] hover:text-[var(--color-indigo)] disabled:opacity-35";

/** One compact block rectangle: type icon, tag chips, a clamped preview (first lines, rest faded away), a thumbnail for
 * image / simulation / question blocks. Selecting it shows a floating mini toolbar. Double-click / Enter edits it. */
export default function BlockTile({
  block, label, variant = "classic", selected, multi, editing, collapsed, dim, checkCount = 0, span = 12, full, height, placement,
  dropZone, canvas, onSelect, onEdit, onOp, onToggleCollapsed, onDuplicate, onDelete, onToggleVisible, onSaveLibrary, onGripDown, onResizeDown, onFocusTile,
}) {
  const id = block.id;
  const Icon = BLOCK_TYPES[block.block_type]?.icon;
  const p = tilePreview(block, { checkCount });
  const meta = getBlockMeta(block);
  const list = variant === "list";

  function onKeyDown(e) {
    if (e.target !== e.currentTarget) return;
    const name = opForKey(e);
    if (name) { e.preventDefault(); onOp(name, id); return; }
    if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); onEdit(id); }
    else if (e.key === "Delete" || (e.key === "Backspace" && !e.ctrlKey && !e.metaKey)) { e.preventDefault(); onDelete(id); }
    else if (e.key === " ") { e.preventDefault(); onToggleCollapsed(id); }
  }
  const handleKeys = (axis) => (e) => {
    const map = axis === "x" ? { ArrowLeft: "narrower", ArrowRight: "wider" } : { ArrowUp: "shorter", ArrowDown: "taller" };
    if (map[e.key]) { e.preventDefault(); e.stopPropagation(); onOp(map[e.key], id); }
  };

  return (
    <div
      id={`learn-block-${id}`} data-drop-block={id} data-drop-sides={full || canvas || list ? "0" : "1"} data-block-card={id} data-selected={selected ? "true" : "false"}
      data-collapsed={collapsed ? "true" : "false"} data-type={block.block_type}
      tabIndex={0} role="group" aria-roledescription="block"
      aria-label={`${label.typeLabel}${p.title ? `: ${p.title}` : ""}. ${placement}. Arrow keys move it, Shift plus arrow keys resize it, Enter edits it, Delete removes it.`}
      onFocus={() => onFocusTile?.(id)} onClick={(e) => onSelect(id, e)} onDoubleClick={() => onEdit(id)} onKeyDown={onKeyDown}
      style={{ height: list || collapsed ? undefined : height, minHeight: collapsed ? undefined : undefined, touchAction: "manipulation" }}
      className={`group relative flex min-w-0 flex-col rounded-md border bg-[var(--color-paper-raised)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] ${selected ? "z-10 border-[var(--color-indigo)] ring-2 ring-[var(--color-indigo)]/40" : multi ? "border-[var(--color-teal)] ring-2 ring-[var(--color-teal)]/40" : "border-[var(--color-line)]"} ${block.visible ? "" : "border-dashed opacity-60"} ${dim ? "opacity-30" : ""} ${editing ? "shadow-[0_0_0_2px_var(--color-amber)]" : ""}`}
    >
      <div className="flex h-7 shrink-0 items-center gap-1 px-1">
        {!list && <button type="button" aria-label={`Drag ${label.typeLabel} to move it (or use the arrow keys)`} onPointerDown={onGripDown} style={{ touchAction: "none" }} className="cursor-grab rounded p-1 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40"><GripVertical size={13} /></button>}
        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold text-[var(--color-indigo)]">{Icon && <Icon size={12} aria-hidden className="shrink-0" />}<span className="truncate">{label.typeLabel}</span></span>
        <span className="flex min-w-0 items-center gap-1 overflow-hidden" aria-hidden={false}>
          {meta.codes.slice(0, 2).map((c) => <span key={c} data-chip="code" className="shrink-0 rounded bg-[var(--color-teal-soft)] px-1 text-[9px] font-bold text-[var(--color-teal)]">{c}</span>)}
          {meta.codes.length > 2 && <span className="shrink-0 text-[9px] text-[var(--color-ink-faint)]">+{meta.codes.length - 2}</span>}
          {meta.guide && <span data-chip="guide" className="shrink-0 rounded bg-[var(--color-line)]/50 px-1 text-[9px] font-bold text-[var(--color-ink-soft)]">v{meta.guide}</span>}
          {meta.needsReview && <span data-chip="review" className="shrink-0 rounded bg-[var(--color-amber-soft)] px-1 text-[9px] font-bold text-[var(--color-amber)]">Review</span>}
          {block.content?.audience === "hl" && <span className="shrink-0 rounded bg-[var(--color-violet-soft)] px-1 text-[9px] font-bold text-[var(--color-violet)]">HL</span>}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-[var(--color-ink-faint)]" aria-hidden>{!full && WIDTH_LABELS[span] ? WIDTH_LABELS[span] : ""}</span>
        {collapsed && <ChevronRight size={12} aria-hidden className="shrink-0 text-[var(--color-ink-faint)]" />}
      </div>

      {!collapsed && (
        <div className="relative min-h-0 flex-1 select-none overflow-hidden px-2 pb-1.5" data-testid="tile-body">
          <div className="flex h-full gap-2">
            {p.thumb ? <img src={p.thumb} alt="" draggable={false} className="h-full max-h-24 w-16 shrink-0 rounded border border-[var(--color-line)] bg-white object-cover" /> : p.kind !== "text" && (
              <div aria-hidden className="flex h-10 w-12 shrink-0 items-center justify-center rounded border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-faint)]">{p.kind === "image" ? <ImageIcon size={16} /> : Icon && <Icon size={16} />}</div>
            )}
            <div className="min-w-0 flex-1">
              {p.title && p.kind === "text" && <p className="truncate text-[12px] font-semibold text-[var(--color-ink)]">{p.title}</p>}
              {p.label && <p className="truncate text-[12px] font-semibold capitalize text-[var(--color-ink)]">{p.label}</p>}
              {(p.text || p.kind === "text") && <p data-testid="tile-text" className="line-clamp-3 break-words text-[11px] leading-[1.35] text-[var(--color-ink-soft)]">{p.kind === "text" ? p.text.slice(p.title && p.text.startsWith(p.title) ? p.title.length : 0).trim() || (p.title ? "" : "Empty block. Double-click to edit.") : p.text}</p>}
            </div>
          </div>
          {p.more && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[var(--color-paper-raised)] to-transparent" />}
        </div>
      )}

      {selected && (
        <div role="toolbar" aria-label={`${label.typeLabel} actions`} data-testid="mini-toolbar" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
          className={`${list ? "relative border-t border-[var(--color-line)]" : "absolute -top-10 left-0 z-30 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] shadow-lg"} flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-0.5 p-0.5`}>
          {list && <><button type="button" className={tb} aria-label={`Move ${label.typeLabel} up`} onClick={() => onOp("reading", id, { dir: -1 })}><ArrowUp size={14} /></button><button type="button" className={tb} aria-label={`Move ${label.typeLabel} down`} onClick={() => onOp("reading", id, { dir: 1 })}><ArrowDown size={14} /></button></>}
          <button type="button" className={tb} aria-label={`Edit ${label.typeLabel}`} onClick={() => onEdit(id)}><Pencil size={13} /></button>
          <button type="button" className={tb} aria-label={`Duplicate ${label.typeLabel}`} onClick={() => onDuplicate(id)}><Copy size={13} /></button>
          {!full && !list && QUICK_WIDTHS.map((w) => <button key={w} type="button" className={`${tb} ${span === w ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : ""}`} aria-pressed={span === w} aria-label={`Width ${w} of 12 columns`} onClick={() => onOp("span", id, { span: w })}>{WIDTH_LABELS[w]}</button>)}
          <button type="button" className={tb} aria-label={collapsed ? `Expand ${label.typeLabel}` : `Collapse ${label.typeLabel}`} aria-expanded={!collapsed} onClick={() => onToggleCollapsed(id)}>{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button>
          <button type="button" className={`${tb} hover:text-[var(--color-coral)]`} aria-label={`Delete ${label.typeLabel}`} onClick={() => onDelete(id)}><Trash2 size={13} /></button>
          <Menu ariaLabel={`More actions for ${label.typeLabel}`} icon={<MoreHorizontal size={14} />} label="" buttonClass={tb} testId="tile-more">
            <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => onToggleVisible(id)}>{block.visible ? <EyeOff size={13} /> : <Eye size={13} />} {block.visible ? "Hide from students" : "Show to students"}</button>
            <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => onEdit(id, "tags")}><Flag size={13} /> Tags and review...</button>
            <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => onSaveLibrary(id)}><BookmarkPlus size={13} /> Save to block library</button>
            <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => onOp(meta.needsReview ? "markReviewed" : "needsReview", id)}><CheckCheck size={13} /> {meta.needsReview ? "Mark reviewed" : "Mark needs review"}</button>
            {!list && <><MenuLabel>Move and size</MenuLabel>
              <div className="grid grid-cols-4 gap-1 px-1">
                <button type="button" className={tb} aria-label="Move up" onClick={() => onOp("up", id)}><ArrowUp size={13} /></button><button type="button" className={tb} aria-label="Move down" onClick={() => onOp("down", id)}><ArrowDown size={13} /></button>
                <button type="button" className={tb} aria-label="Move left" onClick={() => onOp("left", id)}><ArrowLeft size={13} /></button><button type="button" className={tb} aria-label="Move right" onClick={() => onOp("right", id)}><ArrowRight size={13} /></button>
                <button type="button" className={tb} onClick={() => onOp("narrower", id)}>Narrow</button><button type="button" className={tb} onClick={() => onOp("wider", id)}>Wide</button>
                <button type="button" className={tb} onClick={() => onOp("shorter", id)}>Short</button><button type="button" className={tb} onClick={() => onOp("taller", id)}>Tall</button>
              </div>
              {!canvas && !full && <><button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => onOp("besideNext", id)}>Place beside next block</button>
                <button type="button" role="menuitem" data-menu-close className={menuItem} onClick={() => onOp("separate", id)}>Put on its own row</button></>}</>}
          </Menu>
        </div>
      )}

      {selected && !list && !full && (
        <button type="button" aria-label={`Resize width: ${span} of 12 columns. Drag, or use Left and Right arrow keys.`} data-handle="right" onPointerDown={(e) => onResizeDown(e, "right")} onKeyDown={handleKeys("x")} style={{ touchAction: "none" }}
          className="absolute -right-2 top-1/2 z-20 h-8 w-3.5 -translate-y-1/2 cursor-ew-resize rounded-sm border-2 border-[var(--color-indigo)] bg-[var(--color-paper-raised)] shadow" />
      )}
      {selected && !list && !collapsed && (
        <button type="button" aria-label="Resize height. Drag, or use Up and Down arrow keys." data-handle="bottom" onPointerDown={(e) => onResizeDown(e, "bottom")} onKeyDown={handleKeys("y")} style={{ touchAction: "none" }}
          className="absolute -bottom-2 left-1/2 z-20 h-3.5 w-8 -translate-x-1/2 cursor-ns-resize rounded-sm border-2 border-[var(--color-indigo)] bg-[var(--color-paper-raised)] shadow" />
      )}
      {dropZone && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-md" data-drop-indicator={dropZone}>
          {(dropZone === "left" || dropZone === "right") && <div className={`absolute inset-y-0 flex w-1/2 items-center justify-center border-2 border-dashed border-[var(--color-amber)] bg-[var(--color-amber)]/15 text-center text-xs font-bold text-[var(--color-amber)] ${dropZone === "left" ? "left-0" : "right-0"}`}>Place beside</div>}
          {dropZone === "before" && <div className="absolute inset-x-0 top-0 h-1.5 bg-[var(--color-amber)]" />}
          {dropZone === "after" && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[var(--color-amber)]" />}
        </div>
      )}
    </div>
  );
}
