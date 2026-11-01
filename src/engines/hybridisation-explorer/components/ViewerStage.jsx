import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Box, Maximize2, Minus, Plus } from "lucide-react";
import SceneContent, { fitDistance, CAMERA_DIR } from "../scene/Scene3D.jsx";
import { readTheme } from "../scene/theme.js";
import { disposeAll } from "../scene/geometry.js";
import { detectWebGL, isSoftwareGL } from "./webgl.js";
import { qMul, qFromAxisAngle, sub, dot, cross, normalize } from "../model/vec.js";

const MOVE_PX = 5;

function rayPlane(ray, p0, n) {
  const den = dot(ray.dir, n); if (Math.abs(den) < 1e-6) return null;
  const t = dot(sub(p0, ray.origin), n) / den; if (t < 0) return null;
  return [ray.origin[0] + ray.dir[0] * t, ray.origin[1] + ray.dir[1] * t, ray.origin[2] + ray.dir[2] * t];
}

/**
 * The 3D viewer shared by both tabs. Owns ALL pointer interaction: a press on an atom / orbital / rotation ring is captured in
 * the capture phase and stopPropagation()-ed so the orbit controls never see it; a press anywhere else orbits the camera.
 *   click on an orbital -> onOrbitalClick;  click on a nucleus -> onAtomClick
 *   drag (Move tool)    -> the atom moves in the plane through it that faces the camera
 *   drag (Rotate tool)  -> trackball rotation of the atom's orbitals, or rotation about a world axis when a gizmo ring is dragged
 */
export default function ViewerStage({
  view, fit, interactive = true, tool = "move", getAtom, onOrbitalClick, onAtomClick, onHover, onGestureStart, onTransform, onGestureEnd, onMorphDone,
  tools, children, ariaLabel, testId = "hy-stage", fallback, themeVersion = 0, extraData,
}) {
  const containerRef = useRef(null); const apiRef = useRef(null); const viewRef = useRef(view);
  const gesture = useRef(null); const pending = useRef(null); const raf = useRef(0); const hoverRef = useRef(null);
  const [theme, setTheme] = useState(null); const [size, setSize] = useState({ w: 640, h: 420 });
  const [fitToken, setFitToken] = useState(0);
  const webgl = useMemo(() => detectWebGL(), []); const aa = useMemo(() => !isSoftwareGL(), []);
  viewRef.current = view;

  useLayoutEffect(() => {
    const el = containerRef.current; if (!el) return undefined;
    setTheme(readTheme(el.closest("[data-hy-root]") ?? el));
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 1 && r.height > 1) setSize((s) => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height })); };
    measure(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null; ro?.observe(el);
    el.__hy = { api: () => apiRef.current, view: () => viewRef.current, size: () => size };
    return () => { ro?.disconnect(); delete el.__hy; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeVersion]);
  useEffect(() => () => disposeAll(), []);

  const fitKey = `${fit.key}|${fitToken}`;
  const fitProp = useMemo(() => ({ ...fit, key: fitKey }), [fit.center?.join(","), fit.radius, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const camera = useMemo(() => { const d = fitDistance(fit.radius, size.w / Math.max(1, size.h)); const c = fit.center; return { fov: 40, near: 0.1, far: 220, up: [0, 0, 1], position: [c[0] + CAMERA_DIR[0] * d, c[1] + CAMERA_DIR[1] * d, c[2] + CAMERA_DIR[2] * d] }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(() => { raf.current = 0; const p = pending.current; pending.current = null; if (p) onTransform?.(p.id, p.patch); }, [onTransform]);
  const queue = (id, patch) => { pending.current = { id, patch }; if (!raf.current) raf.current = requestAnimationFrame(flush); };
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const setCursor = (c) => { const el = containerRef.current; if (el && el.dataset.cursor !== c) el.dataset.cursor = c; };

  const onPointerDownCapture = useCallback((e) => {
    if (!interactive || (e.button !== undefined && e.button > 0)) return;
    if (e.target.closest?.("button, select, input, label, .hy-viewtools, .hy-stage-tools")) return;
    const api = apiRef.current; if (!api) return;
    const hit = api.pick(e.clientX, e.clientY); if (!hit) return; // empty space: orbit controls take over
    e.stopPropagation();
    containerRef.current?.setPointerCapture?.(e.pointerId);
    const a = getAtom?.(hit.atomId); if (!a) return;
    const g = { pid: e.pointerId, hit, x0: e.clientX, y0: e.clientY, started: false, pos0: a.pos, quat0: a.quat, mode: hit.kind === "ring" ? "ring" : tool };
    const basis = api.basis(); g.basis = basis;
    if (g.mode === "move") { const p = rayPlane(api.ray(e.clientX, e.clientY), a.pos, basis.forward); g.grab = p ? sub(a.pos, p) : [0, 0, 0]; }
    if (g.mode === "ring") {
      const ax = hit.axis; const e1 = normalize(Math.abs(ax[2]) < 0.9 ? cross(ax, [0, 0, 1]) : cross(ax, [1, 0, 0])); const e2 = cross(ax, e1);
      const p = rayPlane(api.ray(e.clientX, e.clientY), a.pos, ax); g.ring = { ax, e1, e2, a0: p ? Math.atan2(dot(sub(p, a.pos), e2), dot(sub(p, a.pos), e1)) : 0 };
    }
    gesture.current = g; containerRef.current?.focus({ preventScroll: true });
  }, [interactive, tool, getAtom]);

  const onPointerMove = useCallback((e) => {
    const api = apiRef.current; if (!api) return;
    const g = gesture.current;
    if (g && g.pid === e.pointerId) {
      if (!g.started && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > MOVE_PX) { g.started = true; setCursor("grabbing"); onGestureStart?.(g.hit.atomId); }
      if (!g.started) return;
      const id = g.hit.atomId;
      if (g.mode === "move") {
        const basis = api.basis(); const p = rayPlane(api.ray(e.clientX, e.clientY), g.pos0, basis.forward);
        if (p) queue(id, { pos: [p[0] + g.grab[0], p[1] + g.grab[1], p[2] + g.grab[2]] });
      } else if (g.mode === "rotate") {
        const dx = e.clientX - g.x0; const dy = e.clientY - g.y0;
        const q = qMul(qFromAxisAngle(g.basis.up, dx * 0.012), qMul(qFromAxisAngle(g.basis.right, dy * 0.012), g.quat0));
        queue(id, { quat: q });
      } else if (g.mode === "ring") {
        const p = rayPlane(api.ray(e.clientX, e.clientY), g.pos0, g.ring.ax);
        if (p) { const ang = Math.atan2(dot(sub(p, g.pos0), g.ring.e2), dot(sub(p, g.pos0), g.ring.e1)); queue(id, { quat: qMul(qFromAxisAngle(g.ring.ax, ang - g.ring.a0), g.quat0) }); }
      }
      return;
    }
    if (e.buttons) return;
    const hit = interactive ? api.pick(e.clientX, e.clientY) : null;
    const next = hit && hit.kind === "orbital" ? `${hit.atomId}|${hit.orbId}` : null;
    if (hoverRef.current !== next) { hoverRef.current = next; onHover?.(hit && hit.kind === "orbital" ? { atomId: hit.atomId, orbId: hit.orbId } : null); }
    setCursor(hit ? (hit.kind === "ring" ? "grab" : "pointer") : "");
  }, [interactive, onHover, onGestureStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const endGesture = useCallback((e, cancelled) => {
    const g = gesture.current; if (!g || g.pid !== e.pointerId) return;
    gesture.current = null; containerRef.current?.releasePointerCapture?.(e.pointerId); setCursor("");
    if (g.started) { if (raf.current) { cancelAnimationFrame(raf.current); flush(); } onGestureEnd?.(); return; }
    if (cancelled) return;
    if (g.hit.kind === "orbital") onOrbitalClick?.(g.hit.atomId, g.hit.orbId); else if (g.hit.kind === "nucleus") onAtomClick?.(g.hit.atomId);
  }, [flush, onGestureEnd, onOrbitalClick, onAtomClick]);

  const dpr = useMemo(() => [1, 1.75], []); const glProps = useMemo(() => ({ antialias: aa, alpha: true, powerPreference: "low-power" }), [aa]);
  return (
    <div
      ref={containerRef} className="hy-stage" tabIndex={0} role="application" aria-label={ariaLabel} data-testid={testId} data-tool={tool}
      onPointerDownCapture={onPointerDownCapture} onPointerMove={onPointerMove} onPointerUp={(e) => endGesture(e, false)} onPointerCancel={(e) => endGesture(e, true)}
      {...extraData}
    >
      {webgl ? (
        <Canvas flat dpr={dpr} camera={camera} frameloop="demand" gl={glProps} style={{ touchAction: "none" }} resize={{ scroll: false }}>
          {theme && <SceneContent view={view} theme={theme} apiRef={apiRef} fit={fitProp} onMorphDone={onMorphDone} />}
        </Canvas>
      ) : (
        <div className="hy-nogl" data-testid="webgl-fallback" role="status"><Box size={22} aria-hidden="true" /><p><b>3D view unavailable on this device.</b></p><p>{fallback ?? "WebGL is not available, so the 3D orbitals cannot be drawn. The orbital diagram, controls and explanations still work."}</p></div>
      )}
      {webgl && (
        <div className="hy-viewtools" role="group" aria-label="3D view controls">
          {tools}
          <button type="button" className="hy-vt" onClick={() => apiRef.current?.zoom(0.8)} title="Zoom in (or use the scroll wheel / pinch)" data-testid="vt-zoom-in"><Plus size={16} aria-hidden="true" /><span>Zoom in</span></button>
          <button type="button" className="hy-vt" onClick={() => apiRef.current?.zoom(1.25)} title="Zoom out" data-testid="vt-zoom-out"><Minus size={16} aria-hidden="true" /><span>Zoom out</span></button>
          <button type="button" className="hy-vt" onClick={() => setFitToken((t) => t + 1)} title="Fit everything in view" data-testid="vt-fit"><Maximize2 size={16} aria-hidden="true" /><span>Fit</span></button>
        </div>
      )}
      {children}
    </div>
  );
}
