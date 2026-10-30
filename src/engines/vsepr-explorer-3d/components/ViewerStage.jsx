import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Box, Minus, Plus, Rotate3d, RotateCcw } from "lucide-react";
import SceneContent from "./Scene.jsx";
import { BOND_LEN, fitDistance } from "./sceneMath.js";
import { detectWebGL, isSoftwareGL } from "./webgl.js";
import { createSim, dragDomain, isSettled, releaseDomain, settleInstant, syncDomains } from "../model/geometry.js";
import { ELEMENTS } from "../model/elements.js";

const MOVE_THRESHOLD = 5; // px before a press on a domain becomes a drag (below it: a click that selects)
const LABEL_SLOTS = [0, 1, 2, 3, 4];

/**
 * The 3D viewer. Owns the relaxation simulation (one fixed central atom, up to six domains) and ALL pointer interaction:
 * a press on a surrounding atom, bond or lone pair is captured here (capture phase + stopPropagation) so it never reaches
 * the orbit controls; a press anywhere else orbits the camera.
 *
 * Imperative handle (for the toolbox drag-and-drop): hit(x, y), setPreview(item | null, x, y), zoom(f), resetView().
 */
export default function ViewerStage({
  model, resetKey = 0, view, angleEntries = [], interactive = true, selectedId = null, onSelect, onRemove, onDragActive,
  mini = false, children, ref, ariaLabel = "3D model of the electron domains around the central atom", fallback,
}) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [simInit] = useState(createSim); const simRef = useRef(simInit);
  const labelRefs = useRef([]);
  const gesture = useRef(null);
  const downEmpty = useRef(null);
  const hoverRef = useRef(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [auto, setAuto] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const webgl = useMemo(() => detectWebGL(), []);
  const aa = useMemo(() => !isSoftwareGL(), []);

  const mode = view.mode; const lpVisible = mode === "ed" ? true : view.showLP;
  const centralRadius = model.central ? ELEMENTS[model.central].r * 1.2 : 0.5;
  const live = useRef({});
  // everything the three scene reads each frame lives in this ref (no React re-render per frame)
  useLayoutEffect(() => {
    live.current = {
      ...live.current, sim: simRef.current, domains: model.domains, central: model.central, centralRadius, mode, lpVisible,
      showDomains: view.showDomains, showLP: view.showLP, showRepulsion: view.showRepulsion, showAngles: view.showAngles,
      selectedId, angleEntries, interactive, animate: !mini,
    };
  });

  // keep the simulation in step with the model (ids / kinds); settle instantly when the whole model was replaced
  const sig = model.domains.map((d) => `${d.id}:${d.kind}`).join("|");
  const lastSig = useRef(""); const lastKey = useRef(null);
  useLayoutEffect(() => {
    const sim = simRef.current;
    if (lastSig.current !== sig) {
      syncDomains(sim, model.domains.map((d) => d.id), model.domains.map((d) => d.kind), model.hints);
      lastSig.current = sig;
    }
    if (lastKey.current !== resetKey) { lastKey.current = resetKey; settleInstant(sim); sim.pulse = 0; }
    else if (mini) settleInstant(sim);
  }, [sig, resetKey, model.hints, model.domains, mini]);

  useLayoutEffect(() => {
    const el = containerRef.current; if (!el) return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 1 && r.height > 1) setSize((s) => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height })); };
    measure(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null; ro?.observe(el);
    el.__vsepr = { sim: simRef.current, api: () => apiRef.current, live: () => live.current };
    return () => { ro?.disconnect(); delete el.__vsepr; };
  }, []);

  const extent = model.central && model.domains.length ? BOND_LEN + 0.28 : 2.0;
  const camDistance = useMemo(() => fitDistance(extent, size.w / Math.max(1, size.h)), [extent, size.w, size.h]);

  // ----- pointer interaction -------------------------------------------------------------------------------------
  const setCursor = (c) => { const el = containerRef.current; if (el && el.dataset.cursor !== c) { el.dataset.cursor = c; } };
  const radiusFor = (g) => (g.kind === "lp" ? 1.0 : BOND_LEN);
  const onPointerDownCapture = useCallback((e) => {
    if (mini || !interactive || (e.button !== undefined && e.button > 0)) return;
    if (e.target.closest?.("button, select, input, label, .vx-selbar, .vx-viewtools")) return; // overlay controls handle their own clicks
    const api = apiRef.current; if (!api) return;
    const hit = api.pick(e.clientX, e.clientY);
    if (!hit || hit.kind === "central") { downEmpty.current = { x: e.clientX, y: e.clientY, central: !!hit }; return; } // orbit (and click-select) as usual
    e.stopPropagation();
    containerRef.current?.setPointerCapture?.(e.pointerId);
    gesture.current = { pid: e.pointerId, id: hit.id, kind: hit.kind, index: hit.index, x0: e.clientX, y0: e.clientY, started: false };
    downEmpty.current = null;
    containerRef.current?.focus({ preventScroll: true });
  }, [mini, interactive]);

  const onPointerMove = useCallback((e) => {
    const api = apiRef.current; if (!api || mini) return;
    const g = gesture.current; const sim = simRef.current;
    if (g && g.pid === e.pointerId) {
      if (!g.started && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > MOVE_THRESHOLD) { g.started = true; setCursor("grabbing"); onDragActive?.(true); }
      if (g.started) {
        const prev = sim.pin === g.index ? [sim.pinDir[0], sim.pinDir[1], sim.pinDir[2]] : [sim.dir[g.index * 3], sim.dir[g.index * 3 + 1], sim.dir[g.index * 3 + 2]];
        const d = api.sphereDir(e.clientX, e.clientY, radiusFor(g), prev);
        if (d) dragDomain(sim, g.index, d[0], d[1], d[2]);
      }
      return;
    }
    if (e.buttons) return;
    const hit = interactive ? api.pick(e.clientX, e.clientY) : null;
    const id = hit && hit.kind !== "central" ? hit.id : null;
    if (hoverRef.current !== id) { hoverRef.current = id; live.current.hoverId = id; setCursor(id ? "grab" : hit ? "pointer" : ""); }
  }, [mini, interactive, onDragActive]);

  const endGesture = useCallback((e, cancelled) => {
    const g = gesture.current; const sim = simRef.current;
    if (g && g.pid === e.pointerId) {
      gesture.current = null; containerRef.current?.releasePointerCapture?.(e.pointerId);
      if (g.started) { releaseDomain(sim); setCursor(""); onDragActive?.(false); }
      else if (!cancelled) onSelect?.(g.id);
      return;
    }
    const d = downEmpty.current; downEmpty.current = null;
    if (d && !cancelled && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= MOVE_THRESHOLD) onSelect?.(d.central ? "central" : null);
  }, [onSelect, onDragActive]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") { onSelect?.(null); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && selectedId && interactive) { e.preventDefault(); onRemove?.(selectedId); }
  };

  useImperativeHandle(ref, () => ({
    hit(x, y) {
      const api = apiRef.current; if (!api) return { inside: false };
      const r = containerRef.current.getBoundingClientRect(); const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (!inside) return { inside: false };
      return { inside, dir: api.sphereDir(x, y, BOND_LEN, null), pick: api.pick(x, y) };
    },
    setPreview(item, x, y) {
      const api = apiRef.current; const L = live.current; if (!api) return;
      if (!item) { L.preview = null; L.hoverId = hoverRef.current; return; }
      const r = containerRef.current.getBoundingClientRect(); const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (!inside) { L.preview = null; containerRef.current.dataset.dropping = "0"; return; }
      containerRef.current.dataset.dropping = "1";
      const pick = api.pick(x, y); const overStub = item.kind === "bond" && item.symbol && pick?.kind === "bond" && L.domains[pick.index] && !L.domains[pick.index].symbol;
      L.hoverId = pick && pick.kind !== "central" && item.symbol ? pick.id : null;
      L.preview = overStub || item.kind === "central" ? null : { kind: item.kind, symbol: item.symbol, order: item.order, dir: api.sphereDir(x, y, item.kind === "lp" ? 1 : BOND_LEN, null) };
    },
    clearPreview() { live.current.preview = null; live.current.hoverId = null; if (containerRef.current) containerRef.current.dataset.dropping = "0"; },
    zoom: (f) => apiRef.current?.zoom(f), resetView: () => setResetToken((t) => t + 1),
    sim: simRef.current,
  }), []);

  const onFrame = useCallback((sim) => {
    const el = containerRef.current; if (!el) return;
    const s = isSettled(sim, 0.01) ? "1" : "0"; if (el.dataset.settled !== s) el.dataset.settled = s;
    const p = sim.pin >= 0 ? "1" : "0"; if (el.dataset.dragging !== p) el.dataset.dragging = p;
  }, []);

  const cam = useMemo(() => ({ fov: 40, near: 0.1, far: 120, position: [0.55 * camDistance * 0.77, 0.42 * camDistance * 0.77, camDistance * 0.77] }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef} className="vx-stage" tabIndex={mini ? -1 : 0} role="application" aria-label={ariaLabel} data-testid={mini ? "vsepr-mini" : "vsepr-stage"} data-mode={mode} data-n={model.domains.length}
      data-settled="1" data-dragging="0" data-dropping="0" data-selected={selectedId ?? ""}
      onPointerDownCapture={onPointerDownCapture} onPointerMove={onPointerMove}
      onPointerUp={(e) => endGesture(e, false)} onPointerCancel={(e) => endGesture(e, true)} onKeyDown={onKeyDown}
    >
      {webgl ? (
        <Canvas flat dpr={mini ? 1.5 : [1, 1.75]} camera={cam} frameloop={mini ? "demand" : "always"} gl={{ antialias: aa, alpha: true, powerPreference: "low-power" }} style={{ touchAction: "none" }} resize={{ scroll: false }}>
          <SceneContent live={live} apiRef={apiRef} labelRefs={labelRefs} mini={mini} autoRotate={auto} camDistance={camDistance} resetToken={resetToken} onFrame={onFrame} />
        </Canvas>
      ) : (
        <div className="vx-nogl" data-testid="webgl-fallback" role="status"><Box size={22} aria-hidden="true" /><p><b>3D view unavailable on this device.</b></p><p>{fallback ?? "You can still build molecules with the toolbox; the information panel and Lewis structure update as usual."}</p></div>
      )}
      {!mini && webgl && (
        <>
          <div className="vx-angle-layer" aria-hidden="true">
            {LABEL_SLOTS.map((i) => <div key={i} ref={(el) => { labelRefs.current[i] = el; }} className="vx-angle-label" data-on="0" data-testid={`angle-label-${i}`} />)}
          </div>
          <div className="vx-viewtools" role="group" aria-label="3D view controls">
            <button type="button" className="vx-vt" aria-pressed={auto} onClick={() => setAuto((a) => !a)} title="Rotate: drag empty space to orbit, or toggle slow auto-rotation" data-testid="vt-rotate"><Rotate3d size={18} aria-hidden="true" /><span>Rotate</span></button>
            <button type="button" className="vx-vt" onClick={() => apiRef.current?.zoom(0.8)} title="Zoom in (or use the scroll wheel / pinch)" data-testid="vt-zoom-in"><Plus size={18} aria-hidden="true" /><span>Zoom in</span></button>
            <button type="button" className="vx-vt" onClick={() => apiRef.current?.zoom(1.25)} title="Zoom out" data-testid="vt-zoom-out"><Minus size={18} aria-hidden="true" /><span>Zoom out</span></button>
            <button type="button" className="vx-vt" onClick={() => setResetToken((t) => t + 1)} title="Reset the camera view" data-testid="vt-reset-view"><RotateCcw size={18} aria-hidden="true" /><span>Reset</span></button>
          </div>
        </>
      )}
      {children}
    </div>
  );
}
