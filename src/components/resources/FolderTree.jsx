import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";

const ROOT_ID = "__root__";

// Accessible folder tree (WAI-ARIA tree pattern): role=tree / treeitem / group,
// aria-level / aria-expanded / aria-selected, roving tabindex and arrow-key navigation
// (Up/Down move, Right expands or enters, Left collapses or goes to parent, Home/End,
// Enter/Space select).  Purely presentational: callers own the data and the selection.
export default function FolderTree({ roots, selectedId = null, onSelect, counts, rootLabel, renderMeta, ariaLabel = "Folders" }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [focusKey, setFocusKey] = useState(selectedId ?? ROOT_ID);
  const treeRef = useRef(null);

  const parentOf = useMemo(() => {
    const m = new Map();
    const visit = (n, p) => { m.set(n.id, p); n.children.forEach((c) => visit(c, n.id)); };
    roots.forEach((r) => visit(r, null));
    return m;
  }, [roots]);

  // Keep the selected folder visible: expand its ancestors when the selection changes.
  useEffect(() => {
    if (selectedId == null) return;
    setExpanded((prev) => {
      const next = new Set(prev); let p = parentOf.get(selectedId);
      while (p) { next.add(p); p = parentOf.get(p); }
      return next;
    });
    setFocusKey(selectedId);
  }, [selectedId, parentOf]);

  const toggle = (id, on) => {
    const open = on ?? !expanded.has(id);
    setExpanded((prev) => { const n = new Set(prev); if (open) n.add(id); else n.delete(id); return n; });
    if (!open) setFocusKey(id); // never leave the tab stop inside a collapsed branch
  };
  const activeKey = focusKey === ROOT_ID && !rootLabel ? roots[0]?.id : focusKey;

  function focusItem(el) { if (!el) return; setFocusKey(el.dataset.key); el.focus(); }

  function onKeyDown(e) {
    const item = e.target.closest?.('[role="treeitem"]');
    if (!item || !treeRef.current?.contains(item)) return;
    const items = [...treeRef.current.querySelectorAll('[role="treeitem"]')];
    const i = items.indexOf(item);
    const key = item.dataset.key;
    const id = key === ROOT_ID ? null : key;
    const node = id == null ? null : { children: item.dataset.hasChildren === "true" ? [1] : [] };
    const isOpen = item.getAttribute("aria-expanded") === "true";
    let handled = true;
    switch (e.key) {
      case "ArrowDown": focusItem(items[Math.min(items.length - 1, i + 1)]); break;
      case "ArrowUp": focusItem(items[Math.max(0, i - 1)]); break;
      case "Home": focusItem(items[0]); break;
      case "End": focusItem(items[items.length - 1]); break;
      case "ArrowRight":
        if (node?.children.length && !isOpen) toggle(id, true);
        else if (node?.children.length) focusItem(items[i + 1]);
        break;
      case "ArrowLeft":
        if (node?.children.length && isOpen) toggle(id, false);
        else { const p = id == null ? null : parentOf.get(id); focusItem(p ? items.find((x) => x.dataset.key === p) : (rootLabel ? items[0] : null)); }
        break;
      case "Enter": case " ": onSelect(id); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  const rowBase = "flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors";
  const rowTone = (sel) => (sel ? "bg-[var(--color-indigo-soft)] font-medium text-[var(--color-indigo)]" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]");

  function renderNode(n) {
    const hasKids = n.children.length > 0;
    const open = expanded.has(n.id);
    const sel = selectedId === n.id;
    const count = counts?.get?.(n.id);
    return (
      <li
        key={n.id} role="treeitem" data-key={n.id} data-has-children={hasKids ? "true" : "false"}
        aria-level={n.depth} aria-selected={sel} aria-expanded={hasKids ? open : undefined}
        tabIndex={activeKey === n.id ? 0 : -1}
        className="list-none outline-none [&:focus-visible>div]:ring-2 [&:focus-visible>div]:ring-[var(--color-indigo)]"
      >
        <div
          className={`${rowBase} ${rowTone(sel)}`} style={{ paddingLeft: `${(n.depth - 1) * 14 + 6}px` }}
          onClick={() => { onSelect(n.id); setFocusKey(n.id); if (hasKids) toggle(n.id, true); }}
        >
          <span
            aria-hidden="true" onClick={(e) => { if (hasKids) { e.stopPropagation(); toggle(n.id); } }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center ${hasKids ? "" : "invisible"}`}
          >
            <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
          </span>
          {open && hasKids ? <FolderOpen size={16} className="shrink-0 text-[var(--color-indigo)]" aria-hidden="true" /> : <Folder size={16} className="shrink-0 text-[var(--color-indigo)]" aria-hidden="true" />}
          <span className="min-w-0 flex-1 truncate">{n.name}</span>
          {renderMeta?.(n)}
          {count != null && <span className="shrink-0 text-xs text-[var(--color-ink-faint)]" aria-label={`${count} items`}>{count}</span>}
        </div>
        {hasKids && open && <ul role="group" className="m-0 p-0">{n.children.map(renderNode)}</ul>}
      </li>
    );
  }

  return (
    <ul ref={treeRef} role="tree" aria-label={ariaLabel} onKeyDown={onKeyDown} className="m-0 flex flex-col gap-0.5 p-0">
      {rootLabel && (
        <li
          role="treeitem" data-key={ROOT_ID} data-has-children="false" aria-level={1} aria-selected={selectedId == null}
          tabIndex={activeKey === ROOT_ID ? 0 : -1} className="list-none outline-none [&:focus-visible>div]:ring-2 [&:focus-visible>div]:ring-[var(--color-indigo)]"
        >
          <div className={`${rowBase} ${rowTone(selectedId == null)}`} onClick={() => { onSelect(null); setFocusKey(ROOT_ID); }}>
            <span className="h-5 w-5 shrink-0" aria-hidden="true" />
            <FolderOpen size={16} className="shrink-0 text-[var(--color-indigo)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{rootLabel}</span>
            {counts?.get?.(null) != null && <span className="shrink-0 text-xs text-[var(--color-ink-faint)]">{counts.get(null)}</span>}
          </div>
        </li>
      )}
      {roots.map(renderNode)}
    </ul>
  );
}

export { ROOT_ID };
