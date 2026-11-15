import { useCallback, useEffect, useRef, useState } from "react";
import { dropZone } from "../../../../lib/blockLayoutOps.js";

const THRESHOLD = 5; // px of movement before a press becomes a drag (so plain clicks still click)

/** Pointer-events drag & drop (mouse, pen AND touch -- no HTML5 drag API).
 *
 * start(e, payload, label) is called from a handle's onPointerDown. While dragging, the element
 * under the pointer that carries [data-drop-block="<id>"] is the target; its zone comes from where
 * in its box the pointer is (left/right quarter => "left"/"right" = place beside; top/bottom half =>
 * "before"/"after"). [data-drop-end] is the "after the last block" zone. data-drop-sides="0" disables
 * left/right, data-drop-vertical="1" is for list-style targets (outline).
 * Escape / pointercancel / window blur cancel. The caller must give the handle `touch-action: none`. */
export function usePointerDrag({ onDrop }) {
  const [drag, setDrag] = useState(null); // { payload, label, x, y, target }
  const state = useRef(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => { onDropRef.current = onDrop; });

  const findTarget = useCallback((x, y, payload) => {
    const els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
    for (const el of els) {
      const end = el.closest?.("[data-drop-end]");
      if (end) return { id: null, zone: "end" };
      const card = el.closest?.("[data-drop-block]");
      if (card) {
        const id = card.getAttribute("data-drop-block");
        if (payload.id && id === payload.id) return null;
        const r = card.getBoundingClientRect();
        const fx = r.width ? (x - r.left) / r.width : 0.5;
        const fy = r.height ? (y - r.top) / r.height : 0.5;
        const zone = dropZone(fx, fy, { allowSides: card.getAttribute("data-drop-sides") !== "0", vertical: card.getAttribute("data-drop-vertical") === "1" });
        return { id, zone };
      }
    }
    return null;
  }, []);

  const cleanup = useCallback(() => {
    const s = state.current;
    if (!s) return;
    window.removeEventListener("pointermove", s.move);
    window.removeEventListener("pointerup", s.up);
    window.removeEventListener("pointercancel", s.cancel);
    window.removeEventListener("keydown", s.key, true);
    window.removeEventListener("blur", s.cancel);
    document.body.style.userSelect = s.prevSelect;
    state.current = null;
    setDrag(null);
  }, []);

  const start = useCallback((e, payload, label) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cleanup();
    const s = { payload, label, ox: e.clientX, oy: e.clientY, active: false, target: null, prevSelect: document.body.style.userSelect };
    s.move = (ev) => {
      if (!s.active) {
        if (Math.hypot(ev.clientX - s.ox, ev.clientY - s.oy) < THRESHOLD) return;
        s.active = true;
        document.body.style.userSelect = "none";
      }
      // auto-scroll the nearest scrolling ancestor / window while dragging near the edges
      const edge = 70;
      if (ev.clientY < edge) window.scrollBy(0, -14); else if (ev.clientY > window.innerHeight - edge) window.scrollBy(0, 14);
      s.target = findTarget(ev.clientX, ev.clientY, payload);
      setDrag({ payload, label, x: ev.clientX, y: ev.clientY, target: s.target });
    };
    s.up = () => {
      const { active, target } = s;
      cleanup();
      if (active && target) onDropRef.current?.(payload, target);
    };
    s.cancel = () => cleanup();
    s.key = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); cleanup(); } };
    state.current = s;
    window.addEventListener("pointermove", s.move);
    window.addEventListener("pointerup", s.up);
    window.addEventListener("pointercancel", s.cancel);
    window.addEventListener("keydown", s.key, true);
    window.addEventListener("blur", s.cancel);
  }, [cleanup, findTarget]);

  useEffect(() => cleanup, [cleanup]);
  return { drag, start, cancel: cleanup };
}

/** Pointer-drag a width handle. onChange(columns) is called with the column under the pointer,
 * relative to the row element; onCommit(columns) on release. */
export function startResizeDrag(e, { rowEl, cellEl, snap, presets, onChange, onCommit }) {
  e.preventDefault(); e.stopPropagation();
  const rowRect = rowEl.getBoundingClientRect();
  const col = rowRect.width / 12;
  const cellLeft = cellEl.getBoundingClientRect().left;
  let last = null;
  const compute = (x) => {
    let span = Math.round((x - cellLeft) / col);
    span = Math.max(1, Math.min(12, span));
    if (snap) span = presets.reduce((best, p) => (Math.abs(p - span) < Math.abs(best - span) ? p : best), presets[0]);
    return span;
  };
  const move = (ev) => { const sp = compute(ev.clientX); if (sp !== last) { last = sp; onChange(sp); } };
  const finish = (commit) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); if (commit && last != null) onCommit(last); else onChange(null); };
  const up = () => finish(true);
  const cancel = () => finish(false);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
}
