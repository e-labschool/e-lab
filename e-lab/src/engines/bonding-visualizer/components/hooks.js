import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** prefers-reduced-motion (animations are compressed to a short fade, rotation stops). */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try { return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia?.("(prefers-reduced-motion: reduce)"); } catch { return undefined; }
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** rAF loop: calls cb(dtSeconds) every frame (dt capped at 50 ms so a background tab never jumps). */
export function useFrameLoop(cb) {
  const ref = useRef(cb);
  useEffect(() => { ref.current = cb; });
  useEffect(() => {
    let id; let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      ref.current(dt);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

const WORLD_H = 560;
/** Measures the canvas box. The SVG world is always 560 units tall; its width follows the box aspect ratio. */
export function useWorld() {
  const boxRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 900, h: 500 });
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const aspect = Math.min(2.4, Math.max(0.7, size.w / size.h));
  const world = { W: Math.round(WORLD_H * aspect), H: WORLD_H };
  const toWorld = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg || !svg.createSVGPoint) return null;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);
  return { boxRef, svgRef, world, toWorld };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Pointer dragging of atoms inside the SVG (mouse, pen and touch). */
export function useAtomDrag({ toWorld, world, enabled, onMove, onSelect, onGroupMove, groupEnabled }) {
  const drag = useRef(null);
  const bind = useCallback((id, getPos) => ({
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button > 0) return;
      const w = toWorld(e.clientX, e.clientY);
      if (!w) return;
      if (enabled) {
        const cur = getPos();
        drag.current = { id, pid: e.pointerId, dx: cur.x - w.x, dy: cur.y - w.y, group: false };
        onSelect?.(id);
      } else if (groupEnabled) {
        drag.current = { id, pid: e.pointerId, last: w, group: true };
      } else return;
      e.stopPropagation();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d || d.pid !== e.pointerId) return;
      const w = toWorld(e.clientX, e.clientY);
      if (!w) return;
      if (d.group) { onGroupMove?.(w.x - d.last.x, w.y - d.last.y); d.last = w; return; }
      onMove(d.id, clamp(w.x + d.dx, 30, world.W - 30), clamp(w.y + d.dy, 30, world.H - 30));
    },
    onPointerUp: (e) => { if (drag.current?.pid === e.pointerId) drag.current = null; },
    onPointerCancel: (e) => { if (drag.current?.pid === e.pointerId) drag.current = null; },
  }), [toWorld, world.W, world.H, enabled, groupEnabled, onMove, onSelect, onGroupMove]);
  return bind;
}

/** Default spawn position for the i-th atom added by click. */
export function spawnPosition(i, world) {
  const col = i % 3; const row = Math.floor(i / 3) % 2; const shift = Math.floor(i / 6) * 28;
  return { x: world.W * (0.2 + 0.3 * col) + shift, y: world.H * (0.3 + 0.4 * row) + shift };
}
