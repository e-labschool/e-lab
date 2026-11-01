import { useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Box } from "lucide-react";
import ImfScene from "./ImfScene.jsx";
import { detectWebGL, isSoftwareGL } from "./webgl.js";
import { MOLECULES } from "../model/molecules.js";
import { qFromAxisAngle, qMul, qNorm } from "../model/vec.js";
import { BOUND, clampPos, cloneAll } from "../model/workspace.js";

export const DND_TYPE = "application/x-imf-molecule";
const MOVE_PX = 3;

/**
 * The interactive 3D workspace (Explore and Learn). Owns ALL pointer interaction: a press on a molecule is captured here (capture phase,
 * stopPropagation) so it never reaches the orbit controls; a press anywhere else orbits the camera. Poses are mutated live in
 * `molsRef.current` and committed (onCommit) when the gesture ends.
 */
export default function ImfStage({
  molsRef, revision, opts, simRef, interactive = true, onSelect, onCommit, onDropMolecule, onSummary, onRemove, onLive, onSeparate, ariaLabel, children, ref, fallback,
}) {
  const containerRef = useRef(null); const apiRef = useRef(null); const gesture = useRef(null); const downEmpty = useRef(null);
  const optsRef = useRef(opts); optsRef.current = opts;
  const [resetToken, setResetToken] = useState(0);
  const webgl = useMemo(() => detectWebGL(), []);
  const aa = useMemo(() => !isSoftwareGL(), []);
  const setCursor = (c) => { const el = containerRef.current; if (el && el.dataset.cursor !== c) el.dataset.cursor = c; };
  const repaint = () => apiRef.current?.invalidate?.();

  const onPointerDownCapture = useCallback((e) => {
    if (!interactive || (e.button !== undefined && e.button > 0)) return;
    if (e.target.closest?.("button, select, input, label, a, [data-imf-ui]")) return;
    const api = apiRef.current; if (!api) return;
    const hit = api.pick(e.clientX, e.clientY);
    if (!hit) { downEmpty.current = { x: e.clientX, y: e.clientY }; return; }
    e.stopPropagation(); containerRef.current?.setPointerCapture?.(e.pointerId); containerRef.current?.focus({ preventScroll: true });
    const m = molsRef.current.find((x) => x.uid === hit.uid); if (!m) return;
    const through = [...m.pos]; const p0 = api.planePoint(e.clientX, e.clientY, through);
    gesture.current = { pid: e.pointerId, uid: hit.uid, mode: e.shiftKey || e.ctrlKey ? "rotate" : optsRef.current.mode, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, started: false, through, off: [m.pos[0] - p0[0], m.pos[1] - p0[1], m.pos[2] - p0[2]], axes: api.cameraAxes() };
    downEmpty.current = null; onSelect?.(hit.uid);
  }, [interactive, molsRef, onSelect]);

  const onPointerMove = useCallback((e) => {
    const api = apiRef.current; if (!api) return; const g = gesture.current;
    if (g && g.pid === e.pointerId) {
      if (!g.started && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > MOVE_PX) { g.started = true; setCursor("grabbing"); if (containerRef.current) containerRef.current.dataset.dragging = g.mode; }
      if (!g.started) return;
      const m = molsRef.current.find((x) => x.uid === g.uid); if (!m) return;
      if (g.mode === "rotate") {
        const dx = e.clientX - g.lx; const dy = e.clientY - g.ly; const q1 = qFromAxisAngle(g.axes.up, dx * 0.014); const q2 = qFromAxisAngle(g.axes.right, dy * 0.014);
        m.quat = qNorm(qMul(q1, qMul(q2, m.quat)));
      } else {
        const p = api.planePoint(e.clientX, e.clientY, g.through); m.pos = clampPos([p[0] + g.off[0], p[1] + g.off[1], p[2] + g.off[2]]);
      }
      g.lx = e.clientX; g.ly = e.clientY; repaint(); onLive?.();
      return;
    }
    if (e.buttons || !interactive) return;
    const hit = api.pick(e.clientX, e.clientY); setCursor(hit ? (optsRef.current.mode === "rotate" ? "rotate" : "grab") : "");
  }, [interactive, molsRef, onLive]);

  const endGesture = useCallback((e, cancelled) => {
    const g = gesture.current;
    if (g && g.pid === e.pointerId) {
      gesture.current = null; containerRef.current?.releasePointerCapture?.(e.pointerId); setCursor(""); if (containerRef.current) containerRef.current.dataset.dragging = "";
      if (g.started) onCommit?.(cloneAll(molsRef.current));
      return;
    }
    const d = downEmpty.current; downEmpty.current = null;
    if (d && !cancelled && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= MOVE_PX) onSelect?.(null);
  }, [molsRef, onCommit, onSelect]);

  // keyboard: arrows move the selected molecule in the screen plane, Shift+arrows rotate it, +/- change the separation, [ ] cycle selection
  const onKeyDown = (e) => {
    const sel = optsRef.current.selectedUid; const list = molsRef.current; const api = apiRef.current; if (!interactive) return;
    if (e.key === "Escape") { onSelect?.(null); return; }
    if (e.key === "[" || e.key === "]") { e.preventDefault(); if (!list.length) return; const i = list.findIndex((m) => m.uid === sel); onSelect?.(list[(i + (e.key === "]" ? 1 : -1) + list.length) % list.length].uid); return; }
    if ((e.key === "+" || e.key === "=") ) { e.preventDefault(); onSeparate?.(-0.5); return; }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); onSeparate?.(0.5); return; }
    if (sel == null || !api) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onRemove?.(sel); return; }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!dir) return;
    e.preventDefault(); const ax = api.cameraAxes(); const m = list.find((x) => x.uid === sel); if (!m) return;
    if (e.shiftKey) { const q = qMul(qFromAxisAngle(ax.up, dir[0] * 0.2618), qMul(qFromAxisAngle(ax.right, -dir[1] * 0.2618), m.quat)); m.quat = qNorm(q); }
    else m.pos = clampPos([m.pos[0] + (ax.right[0] * dir[0] + ax.up[0] * dir[1]) * 0.5, m.pos[1] + (ax.right[1] * dir[0] + ax.up[1] * dir[1]) * 0.5, m.pos[2] + (ax.right[2] * dir[0] + ax.up[2] * dir[1]) * 0.5]);
    repaint(); onCommit?.(cloneAll(list));
  };

  // HTML5 drag and drop from the tray (mouse); touch / pen use the tray's pointer ghost and call dropAtClient
  const onDragOver = (e) => { if (e.dataTransfer?.types?.includes(DND_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (containerRef.current) containerRef.current.dataset.dropping = "1"; } };
  const onDragLeave = () => { if (containerRef.current) containerRef.current.dataset.dropping = "0"; };
  const dropAtClient = useCallback((id, x, y) => {
    const api = apiRef.current; if (containerRef.current) containerRef.current.dataset.dropping = "0";
    const pos = api ? api.planePoint(x, y, [0, 0, 0]) : null; onDropMolecule?.(id, pos ? clampPos(pos) : null);
  }, [onDropMolecule]);
  const onDrop = (e) => { const id = e.dataTransfer?.getData(DND_TYPE) || e.dataTransfer?.getData("text/plain"); if (!id || !MOLECULES[id]) return; e.preventDefault(); dropAtClient(id, e.clientX, e.clientY); };

  useImperativeHandle(ref, () => ({
    el: () => containerRef.current, dropAtClient, resetView: () => setResetToken((t) => t + 1), zoom: (f) => apiRef.current?.zoom(f), invalidate: repaint,
    contains(x, y) { const r = containerRef.current?.getBoundingClientRect(); return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; },
  }), [dropAtClient]);

  const setContainer = (el) => { containerRef.current = el; if (el) el.__imf = { api: () => apiRef.current, mols: () => molsRef.current, sim: () => simRef.current, bound: BOUND }; };
  return (
    <div
      ref={setContainer} className="imf-stage" tabIndex={0} role="application" aria-label={ariaLabel} aria-describedby="imf-stage-help" data-testid="imf-stage" data-mode={opts.mode} data-dragging="" data-dropping="0"
      onPointerDownCapture={onPointerDownCapture} onPointerMove={onPointerMove} onPointerUp={(e) => endGesture(e, false)} onPointerCancel={(e) => endGesture(e, true)}
      onKeyDown={onKeyDown} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {webgl ? (
        <Canvas flat dpr={[1, 1.75]} frameloop="demand" camera={{ fov: 38, near: 0.5, far: 160, position: [0, 3, 15] }} gl={{ antialias: aa, alpha: true, powerPreference: "low-power" }} style={{ touchAction: "none" }} resize={{ scroll: false }}>
          <ImfScene storeRef={molsRef} optsRef={optsRef} simRef={simRef} apiRef={apiRef} onSummary={onSummary} revision={revision} resetViewToken={resetToken} interactive={interactive} />
        </Canvas>
      ) : (
        <div className="imf-nogl" data-testid="webgl-fallback" role="status"><Box size={22} aria-hidden="true" /><p><b>3D view unavailable on this device.</b></p><p>{fallback ?? "The molecule list, force selector and explanations still work; the 3D drawing needs WebGL."}</p></div>
      )}
      <p id="imf-stage-help" className="imf-sr">Drag a molecule to move it, or switch to Rotate to turn it. Drag empty space to orbit the camera. With the workspace focused: arrow keys move the selected molecule, Shift plus arrows rotate it, plus and minus change the separation, and the square bracket keys cycle the selection.</p>
      {children}
    </div>
  );
}
