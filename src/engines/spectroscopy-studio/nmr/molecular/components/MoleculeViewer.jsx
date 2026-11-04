import { Suspense, lazy, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Minus, Plus, Rotate3d, RotateCcw } from "lucide-react";
import MoleculeSVG from "./MoleculeSVG.jsx";
import { detectWebGL } from "./webgl.js";

// Rotatable molecule viewer: three.js / r3f scene (lazy-loaded) when WebGL exists, otherwise the interactive SVG projection.
// The parent owns the selection; the viewer only reports clicks. `ctx` = { selectedEnvId, identified:Set, coupledEnvIds, style, focusAtom }.
const MoleculeCanvas = lazy(() => import("./MoleculeCanvas.jsx"));

export default function MoleculeViewer({ molecule, ctx, showBonds = true, showLabels = true, onAtomClick, onBackgroundClick, reducedMotion = false, ariaLabel, compact = false, children, forceFallback = false, testId = "mol-stage" }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null); // 3D bridge ({ project, zoom, reset, rotate })
  const svgApi = useRef(null);
  const [size, setSize] = useState({ w: 400, h: 300 });
  const [auto, setAuto] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const webgl = useMemo(() => !forceFallback && detectWebGL(), [forceFallback]);

  useLayoutEffect(() => {
    const el = hostRef.current; if (!el) return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 1 && r.height > 1) setSize((s) => (Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: r.width, h: r.height })); };
    measure(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null; ro?.observe(el);
    el.__nmrMol = {
      project: (idx) => apiRef.current?.project(idx) ?? (() => { const n = el.querySelector(`[data-atom="${idx}"]`); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })(),
      webgl: () => webgl, distance: () => apiRef.current?.distance?.() ?? null,
    };
    return () => { ro?.disconnect(); delete el.__nmrMol; };
  }, [webgl]);

  const onReady = useCallback((api) => { apiRef.current = api; }, []);
  const zoom = (f) => (webgl ? apiRef.current?.zoom(f) : svgApi.current?.zoom(f));
  const reset = () => { if (webgl) { apiRef.current?.reset(); setResetToken((t) => t + 1); } else svgApi.current?.reset(); setAuto(false); };
  const autoOn = auto && !reducedMotion;

  return (
    <div ref={hostRef} className="nm-viewer" data-testid={testId} data-webgl={webgl ? "1" : "0"} data-selected-env={ctx.selectedEnvId ?? ""} data-style={ctx.style}
      data-highlighted={ctx.selectedEnvId ? molecule.environments.find((e) => e.id === ctx.selectedEnvId)?.atoms.join(",") ?? "" : ""} role="application" aria-label={ariaLabel ?? `Interactive 3D model of ${molecule.name}`}>
      {webgl ? (
        <Suspense fallback={<div className="nm-viewer-msg" role="status">Loading 3D view…</div>}>
          <MoleculeCanvas molecule={molecule} ctx={ctx} showBonds={showBonds} showLabels={showLabels} onAtomClick={onAtomClick} onBackgroundClick={onBackgroundClick} autoRotate={autoOn} onReady={onReady} resetToken={resetToken} />
        </Suspense>
      ) : (
        <>
          <MoleculeSVG molecule={molecule} ctx={ctx} showBonds={showBonds} showLabels={showLabels} onAtomClick={onAtomClick} onBackgroundClick={onBackgroundClick} width={size.w} height={size.h} apiRef={svgApi} />
          <div className="nm-nogl" data-testid="webgl-fallback" role="note"><Box size={14} aria-hidden="true" /> 3D unavailable on this device — showing a rotatable 2D projection (drag to rotate).</div>
        </>
      )}
      {children}
      <div className="nm-viewtools" role="group" aria-label="Molecule view controls">
        {webgl && !reducedMotion && <button type="button" className="sim-btn nm-iconbtn" aria-pressed={auto} onClick={() => setAuto((a) => !a)} title="Slow automatic rotation (drag to rotate by hand)" data-testid="vt-rotate"><Rotate3d size={16} aria-hidden="true" /><span>Spin</span></button>}
        <button type="button" className="sim-btn nm-iconbtn" onClick={() => zoom(0.8)} title="Zoom in (or scroll / pinch)" aria-label="Zoom in" data-testid="vt-zoom-in"><Plus size={16} aria-hidden="true" /></button>
        <button type="button" className="sim-btn nm-iconbtn" onClick={() => zoom(1.25)} title="Zoom out" aria-label="Zoom out" data-testid="vt-zoom-out"><Minus size={16} aria-hidden="true" /></button>
        <button type="button" className="sim-btn nm-iconbtn" onClick={reset} title="Reset the view" aria-label="Reset view" data-testid="vt-reset"><RotateCcw size={16} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
