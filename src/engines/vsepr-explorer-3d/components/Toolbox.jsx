import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Redo2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { ELEMENTS, TOOLBOX_ATOMS } from "../model/elements.js";

const DRAG_THRESHOLD = 6;
const BOND_TOOLS = [
  { order: 1, label: "Single", glyph: "—", tip: "Single bond: one shared pair, ONE electron domain" },
  { order: 2, label: "Double", glyph: "=", tip: "Double bond: two shared pairs, still ONE electron domain" },
  { order: 3, label: "Triple", glyph: "≡", tip: "Triple bond: three shared pairs, still ONE electron domain" },
];

/**
 * Compact toolbox: atoms, bond tools, lone pair, edit buttons.
 * Items are { type: "atom", symbol } | { type: "bond", order } | { type: "lp" }.
 *   click        -> onActivate(item)
 *   pointer drag -> onDragMove(item, x, y) while dragging, onDrop(item, x, y) on release (mouse, pen AND touch)
 */
export default function Toolbox({
  bondTool, onActivate, onDragMove, onDrop, onDragEnd, hint, canUndo, canRedo, onUndo, onRedo, onClear, onReset, disabledNote, showEdit = true, atomsOnly = false,
}) {
  const press = useRef(null);
  const justDragged = useRef(false);
  const [ghost, setGhost] = useState(null);

  const finish = useCallback((e, item) => {
    const p = press.current; press.current = null; setGhost(null);
    if (!p || !p.moved) return;
    justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 120);
    onDrop?.(item, e.clientX, e.clientY); onDragEnd?.();
  }, [onDrop, onDragEnd]);

  const bind = (item, ghostInfo) => ({
    onPointerDown: (ev) => {
      if (ev.button !== undefined && ev.button > 0) return;
      press.current = { x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId, host: ev.currentTarget.closest(".sd-frame") ?? document.body };
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
    },
    onPointerMove: (ev) => {
      const p = press.current; if (!p || p.id !== ev.pointerId) return;
      if (!p.moved && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > DRAG_THRESHOLD) p.moved = true;
      if (p.moved) { setGhost({ ...ghostInfo, x: ev.clientX, y: ev.clientY, host: p.host }); onDragMove?.(item, ev.clientX, ev.clientY); }
    },
    onPointerUp: (ev) => { try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch { /* ignore */ } finish(ev, item); },
    onPointerCancel: () => { press.current = null; setGhost(null); onDragEnd?.(); },
    onClick: () => { if (justDragged.current) return; onActivate?.(item); },
    onKeyDown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onActivate?.(item); } },
  });

  return (
    <div className="vx-toolbox" data-testid="vsepr-toolbox">
      <section aria-label="Atoms">
        <h3 className="vx-h">Atoms</h3>
        <div className="vx-atoms" role="group" aria-label="Atoms: click to add, or drag into the workspace">
          {TOOLBOX_ATOMS.map((s) => {
            const el = ELEMENTS[s];
            return (
              <button
                key={s} type="button" className="vx-atom" data-testid={`tool-atom-${s}`} style={{ "--c": el.color, "--t": el.text }}
                title={`${el.name}: drag into the workspace, or click to add. The first atom becomes the central atom.`} aria-label={`${el.name} (${s})`} {...bind({ type: "atom", symbol: s }, { label: s, color: el.color, text: el.text, round: true })}
              ><span>{s}</span></button>
            );
          })}
        </div>
      </section>
      {!atomsOnly && (
        <>
          <section aria-label="Bonds">
            <h3 className="vx-h">Bonds</h3>
            <div className="vx-bonds" role="group" aria-label="Bond tools: the selected bond type is used for the next atom you attach">
              {BOND_TOOLS.map((b) => (
                <button
                  key={b.order} type="button" className="vx-bond" aria-pressed={bondTool === b.order} data-testid={`tool-bond-${b.order}`} title={`${b.tip}. Select it, then add atoms; or drag it onto the central atom.`}
                  {...bind({ type: "bond", order: b.order }, { label: b.glyph, color: "#2a3f78", text: "#e8f0ff", round: false })}
                >
                  <span className="vx-bond-glyph" aria-hidden="true">{b.order === 1 ? "▬" : b.order === 2 ? "══" : "≡"}</span>
                  <span className="vx-bond-name">{b.label}</span><span className="vx-bond-sub">(1 domain)</span>
                </button>
              ))}
            </div>
          </section>
          <section aria-label="Lone pair">
            <h3 className="vx-h">Lone pair</h3>
            <button type="button" className="vx-lp" data-testid="tool-lp" title="Lone pair: one electron domain on the central atom. Click to add, or drag onto the model." {...bind({ type: "lp" }, { label: "••", color: "#2a3f78", text: "#e8f0ff", round: false })}>
              <span className="vx-lp-dots" aria-hidden="true">●●</span><span className="vx-lp-txt"><b>Lone pair</b><small>(1 domain)</small></span>
            </button>
          </section>
        </>
      )}
      {hint && <p className="vx-hint" data-testid="vsepr-hint"><Info size={14} aria-hidden="true" /><span>{hint}</span></p>}
      {disabledNote && <p className="vx-note" role="status" data-testid="vsepr-note">{disabledNote}</p>}
      {showEdit && (
        <div className="vx-edit" role="group" aria-label="Edit">
          <button type="button" className="vx-btn" onClick={onUndo} disabled={!canUndo} title="Undo the last edit (adding, removing or changing atoms, bonds and lone pairs)" data-testid="btn-undo"><Undo2 size={14} aria-hidden="true" /> Undo</button>
          <button type="button" className="vx-btn" onClick={onRedo} disabled={!canRedo} title="Redo" data-testid="btn-redo"><Redo2 size={14} aria-hidden="true" /> Redo</button>
          <button type="button" className="vx-btn" onClick={onClear} title="Clear: remove everything from the workspace (you can undo this)" data-testid="btn-clear"><Trash2 size={14} aria-hidden="true" /> Clear</button>
          <button type="button" className="vx-btn" onClick={onReset} title="Reset: empty workspace, forget the history and reset the view and options" data-testid="btn-reset"><RotateCcw size={14} aria-hidden="true" /> Reset</button>
        </div>
      )}
      {ghost && createPortal(<div className={"vx-ghost" + (ghost.round ? " vx-ghost--round" : "")} style={{ left: ghost.x, top: ghost.y, background: ghost.color, color: ghost.text }} aria-hidden="true">{ghost.label}</div>, ghost.host)}
    </div>
  );
}
