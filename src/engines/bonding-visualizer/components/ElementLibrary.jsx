import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { DashPanel } from "../../../components/simulation/SimulationDashboard.jsx";
import { getBondingElement } from "../model/elements.js";
import { searchElements } from "../../../data/chemistry/elements.js";

const matches = (e, q) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return e.symbol.toLowerCase().startsWith(s) || e.name.toLowerCase().startsWith(s) || String(e.Z) === s;
};

/**
 * Searchable element library. `groups` = [{ id, title, symbols }].
 * - click / tap / Enter / Space  -> onAdd(symbol)
 * - drag (mouse, pen)            -> onAdd(symbol, {clientX, clientY}) when released over `dropRef`
 * `disabledReason` (string) disables adding and shows why.
 */
export default function ElementLibrary({ title = "Elements", groups, onAdd, dropRef, disabledReason, hint, mode, footer }) {
  const [query, setQuery] = useState("");
  const [ghost, setGhost] = useState(null);
  const press = useRef(null);
  const justDragged = useRef(false);

  const filtered = useMemo(() => groups.map((g) => ({ ...g, items: g.symbols.map(getBondingElement).filter((e) => e && matches(e, query)) })), [groups, query]);
  const total = filtered.reduce((n, g) => n + g.items.length, 0);
  const outside = useMemo(() => {
    if (!query.trim() || total > 0) return null;
    const hit = searchElements(query)[0];
    return hit ? `${hit.name} (${hit.symbol}) is not part of this model.` : "No matching element.";
  }, [query, total]);

  const endDrag = useCallback((e, symbol) => {
    const p = press.current;
    press.current = null;
    setGhost(null);
    if (!p || !p.moved) return;
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 80);
    const r = dropRef?.current?.getBoundingClientRect();
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) onAdd(symbol, { clientX: e.clientX, clientY: e.clientY });
  }, [dropRef, onAdd]);

  const chipProps = (e) => ({
    onPointerDown: (ev) => {
      if (disabledReason || ev.pointerType === "touch" || (ev.button !== undefined && ev.button > 0)) return;
      press.current = { x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId, host: ev.currentTarget.closest(".sd-frame") ?? document.body };
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
    },
    onPointerMove: (ev) => {
      const p = press.current;
      if (!p || p.id !== ev.pointerId) return;
      if (!p.moved && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > 8) p.moved = true;
      if (p.moved) setGhost({ symbol: e.symbol, color: e.color, x: ev.clientX, y: ev.clientY, host: p.host });
    },
    onPointerUp: (ev) => endDrag(ev, e.symbol),
    onPointerCancel: () => { press.current = null; setGhost(null); },
    onClick: () => { if (justDragged.current || disabledReason) return; onAdd(e.symbol); },
  });

  return (
    <DashPanel title={title} grow ariaLabel="Element library" testId="library" className="bv-library" aside={<span className="bv-count" aria-hidden="true">{total}</span>}>
      <label className="bv-search">
        <Search size={14} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search element" aria-label="Search elements" data-testid="library-search" autoComplete="off" />
      </label>
      {hint && <p className="bv-hint" data-testid="library-hint">{hint}</p>}
      <div className="bv-library-scroll" data-mode={mode}>
        {filtered.map((g) => g.items.length > 0 && (
          <section key={g.id} className="bv-group" aria-label={g.title}>
            <h4 className="bv-group-title">{g.title}</h4>
            <div className="bv-chips">
              {g.items.map((e) => (
                <button
                  key={e.symbol} type="button" className="bv-chip" data-testid={`el-${e.symbol}`} disabled={false} aria-disabled={disabledReason ? "true" : undefined}
                  title={disabledReason ? disabledReason : `${e.name} (Z = ${e.Z}). Click to add, or drag onto the canvas.`}
                  aria-label={`${e.name}, atomic number ${e.Z}`} style={{ "--chip": e.color }} {...chipProps(e)}
                >
                  <span className="bv-chip-sym">{e.symbol}</span>
                  <span className="bv-chip-name">{e.name}</span>
                  <span className="bv-chip-z">{e.Z}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {total === 0 && <p className="bv-empty" data-testid="library-empty">{outside}</p>}
      </div>
      {footer}
      {disabledReason && <p className="bv-lock" data-testid="library-lock">{disabledReason}</p>}
      {ghost && createPortal(<div className="bv-ghost" style={{ left: ghost.x, top: ghost.y, background: ghost.color }} aria-hidden="true">{ghost.symbol}</div>, ghost.host)}
    </DashPanel>
  );
}
