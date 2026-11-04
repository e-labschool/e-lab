import { fmtMHz } from "./palette.js";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Minimize2, Minus, MoveVertical, Plus, RotateCcw, ScanSearch } from "lucide-react";
import { OPERATING_NOTE } from "../model/molecules.js";
import { defaultView, fullyVisible, cumulativeIntegral, niceTicks, panView, ppmOfX, sampleSignal, signalIntensity, viewForSignal, visiblePeakHeight, xOfPpm, zoomView } from "../model/spectrum.js";
import { THEME } from "./palette.js";

// Interactive NMR spectrum (SVG). Higher delta on the LEFT. True zoom/pan (wheel, drag, pinch, buttons, keys), multiplet selection,
// integration trace, assignments, splitting marks (J), full-screen presentation. Signals come pre-built (model/spectrum.js), so the
// plot only maps ppm -> pixels and draws. The trace is sampled per signal with peak-aware sampling so narrow lines keep their height.

const M = { top: 34, right: 14, bottom: 62, left: 14 };
const shapePath = (shape, r) => {
  switch (shape) {
    case "square": return `M${-r} ${-r}H${r}V${r}H${-r}Z`;
    case "diamond": return `M0 ${-r * 1.25}L${r * 1.25} 0L0 ${r * 1.25}L${-r * 1.25} 0Z`;
    case "triangle": return `M0 ${-r * 1.2}L${r * 1.15} ${r * 0.9}H${-r * 1.15}Z`;
    case "hexagon": return `M${-r} 0L${-r / 2} ${-r * 0.9}H${r / 2}L${r} 0L${r / 2} ${r * 0.9}H${-r / 2}Z`;
    default: return `M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
};
export function EnvBadge({ env, r = 8, x = 0, y = 0 }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <path d={shapePath(env.shape, r)} fill={env.color} stroke="#0a1330" strokeWidth="1.2" />
      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.15} fontWeight="800" fill="#0a1330" y={env.shape === "triangle" ? r * 0.2 : 0.5}>{env.letter}</text>
    </g>
  );
}

export default function SpectrumPlot({
  molecule, signals, freqMHz, selectedEnvId, coupledEnvIds = [], compareEnvId = null, showIntegration = false, showAssignments = true, showSplitting = false,
  onSelectEnv, resetToken = 0, emptyMessage, reducedMotion = false, interactive = true, testId = "spectrum", hideLabels = false, hideToolbar = false, focusToken = 0, labelMult = true, fixedView = null, integralLabel = null,
  children,
}) {
  const wrapRef = useRef(null); const svgRef = useRef(null); const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 640, h: 360 });
  const [viewState, setView] = useState(() => defaultView(molecule));
  const view = fixedView ?? viewState;
  const [yZoom, setYZoom] = useState(1);
  const [hover, setHover] = useState(null);
  const [cursorPpm, setCursorPpm] = useState(null);
  const [present, setPresent] = useState(false);
  const viewRef = useRef(view); viewRef.current = view;
  const raf = useRef(0);
  const dragRef = useRef(null); const moved = useRef(false);

  // ---- measuring ----
  useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 1 && r.height > 1) setBox((b) => (Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1 ? b : { w: r.width, h: r.height })); };
    measure(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null; ro?.observe(el); return () => ro?.disconnect();
  }, [present]);

  const margins = { ...M, top: hideLabels ? 14 : M.top, bottom: hideLabels ? 40 : M.bottom };
  const w = box.w; const h = box.h; const x0 = margins.left; const x1 = Math.max(x0 + 40, w - margins.right); const y0 = margins.top; const y1 = Math.max(y0 + 40, h - margins.bottom);
  const plotH = y1 - y0;

  // ---- view changes ----
  const setViewAnimated = useCallback((target) => {
    cancelAnimationFrame(raf.current);
    if (reducedMotion) { setView(target); return; }
    const from = viewRef.current; const t0 = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - t0) / 240); const e = 1 - (1 - u) * (1 - u);
      setView({ left: from.left + (target.left - from.left) * e, right: from.right + (target.right - from.right) * e });
      if (u < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [reducedMotion]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const reset = useCallback(() => { setViewAnimated(defaultView(molecule)); setYZoom(1); }, [molecule, setViewAnimated]);
  const lastKey = useRef(`${molecule.id}|${resetToken}`);
  useEffect(() => { const k = `${molecule.id}|${resetToken}`; if (lastKey.current !== k) { lastKey.current = k; cancelAnimationFrame(raf.current); setView(defaultView(molecule)); setYZoom(1); } }, [molecule, resetToken]);
  const zoomBy = useCallback((f, anchor) => setViewAnimated(zoomView(viewRef.current, f, anchor)), [setViewAnimated]);
  const panBy = useCallback((frac) => { const v = viewRef.current; setViewAnimated(panView(v, (v.left - v.right) * frac)); }, [setViewAnimated]);
  const selectedSignal = signals.find((s) => s.envId === selectedEnvId) ?? null;
  const zoomToSelection = useCallback(() => { if (selectedSignal) setViewAnimated(viewForSignal(selectedSignal)); }, [selectedSignal, setViewAnimated]);
  const lastFocus = useRef(focusToken);
  useEffect(() => { if (focusToken !== lastFocus.current) { lastFocus.current = focusToken; if (selectedSignal) setViewAnimated(viewForSignal(selectedSignal)); } }, [focusToken, selectedSignal, setViewAnimated]);

  // ---- wheel (non-passive) ----
  useEffect(() => {
    const el = svgRef.current; if (!el || !interactive) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(); const ppm = ppmOfX(viewRef.current, e.clientX - r.left, x0, x1);
      const f = Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.0022);
      setView(zoomView(viewRef.current, f, ppm));
    };
    el.addEventListener("wheel", onWheel, { passive: false }); return () => el.removeEventListener("wheel", onWheel);
  }, [interactive, x0, x1]);

  // ---- drag pan / pinch ----
  const pointers = useRef(new Map());
  const onPointerDown = (e) => {
    if (!interactive || (e.button !== undefined && e.button > 0)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragRef.current = { x: e.clientX, view: viewRef.current, pinch: pointers.current.size === 2 ? { d: Math.hypot(...[...pointers.current.values()].reduce((a, p, i, arr) => (i === 0 ? [0, 0] : [p.x - arr[0].x, p.y - arr[0].y]), [0, 0])), view: viewRef.current } : null };
    moved.current = false;
    const move = (ev) => {
      const p = pointers.current.get(ev.pointerId); if (!p) return;
      p.x = ev.clientX; p.y = ev.clientY;
      const rect = svgRef.current.getBoundingClientRect();
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        const dr = dragRef.current; if (!dr.pinch) dr.pinch = { d, view: viewRef.current };
        if (dr.pinch.d > 5) { moved.current = true; const mid = (a.x + b.x) / 2 - rect.left; setView(zoomView(dr.pinch.view, dr.pinch.d / Math.max(5, d), ppmOfX(dr.pinch.view, mid, x0, x1))); }
        return;
      }
      const dr = dragRef.current; if (!dr) return;
      const dx = ev.clientX - dr.x; if (!moved.current && Math.abs(dx) < 4) return;
      moved.current = true;
      const span = dr.view.left - dr.view.right;
      setView(panView(dr.view, (dx / (x1 - x0)) * span));
    };
    const up = (ev) => {
      pointers.current.delete(ev.pointerId);
      if (pointers.current.size === 0) { dragRef.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }
      else if (dragRef.current) { dragRef.current.pinch = null; const [only] = [...pointers.current.values()]; dragRef.current.x = only.x; dragRef.current.view = viewRef.current; }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  const onPointerMoveHover = (e) => {
    const r = svgRef.current.getBoundingClientRect(); const x = e.clientX - r.left;
    setCursorPpm(x >= x0 && x <= x1 ? ppmOfX(viewRef.current, x, x0, x1) : null);
  };

  const onKeyDown = (e) => {
    if (!interactive) return;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(0.7); } else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1.4); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); panBy(0.15); } else if (e.key === "ArrowRight") { e.preventDefault(); panBy(-0.15); }
    else if (e.key === "0" || e.key === "Home") { e.preventDefault(); reset(); }
  };

  // ---- fullscreen presentation ----
  useEffect(() => {
    const sync = () => { if (!document.fullscreenElement) setPresent((p) => (p && wrapRef.current && document.fullscreenEnabled === false ? p : false)); };
    document.addEventListener("fullscreenchange", sync); return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => { const k = (e) => { if (e.key === "Escape") setPresent(false); }; if (present) { window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); } return undefined; }, [present]);
  const togglePresent = () => {
    const next = !present; setPresent(next);
    try { if (next) wrapRef.current?.requestFullscreen?.().catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch { /* CSS presentation mode still applies */ }
  };

  // ---- drawing data ----
  const X = useCallback((ppm) => xOfPpm(view, ppm, x0, x1), [view, x0, x1]);
  const yMaxVis = useMemo(() => visiblePeakHeight(signals, view) || 1, [signals, view]);
  const yScale = ((plotH - 6) * 0.82 * yZoom) / yMaxVis;
  const Y = (v) => y1 - Math.min(v * yScale, plotH + 40);
  const ticks = useMemo(() => niceTicks(view, Math.max(4, Math.floor((x1 - x0) / 70))), [view, x0, x1]);

  const paths = useMemo(() => signals.map((s) => {
    const { ppm, y } = sampleSignal(s, view, freqMHz, x1 - x0);
    if (!ppm.length) return { id: s.envId, d: "" };
    let d = `M${X(ppm[0]).toFixed(1)} ${Y(0).toFixed(1)}`;
    for (let i = 0; i < ppm.length; i += 1) d += `L${X(ppm[i]).toFixed(2)} ${Y(y[i]).toFixed(1)}`;
    d += `L${X(ppm[ppm.length - 1]).toFixed(1)} ${Y(0).toFixed(1)}`;
    return { id: s.envId, d };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [signals, view, freqMHz, x0, x1, y1, yScale]);

  const integral = useMemo(() => {
    if (!showIntegration) return null;
    const vis = fullyVisible(signals, view); if (!vis.length) return null;
    const total = vis.reduce((s, x) => s + x.count, 0); const k = (plotH * 0.4) / total;
    const loHz = view.right * freqMHz; const hiHz = view.left * freqMHz; const n = Math.round(x1 - x0);
    let d = ""; const base = cumulativeIntegral(vis, hiHz);
    for (let i = 0; i <= n; i += 1) { const hz = hiHz - ((hiHz - loHz) * i) / n; const v = cumulativeIntegral(vis, hz) - base; d += `${i ? "L" : "M"}${(x0 + i).toFixed(1)} ${(y1 - 4 - v * k).toFixed(1)}`; }
    let acc = 0; const steps = [...vis].sort((a, b) => b.deltaPpm - a.deltaPpm).map((s) => { const mid = acc + s.count / 2; acc += s.count; return { s, y: y1 - 4 - (mid) * k, x: X(s.extentPpm[1] + s.skirtPpm) - 6 }; });
    return { d, steps };
  }, [showIntegration, signals, view, freqMHz, x0, x1, y1, plotH, X]);

  // label rows (avoid overlap)
  const labels = useMemo(() => {
    if (!showAssignments || hideLabels) return [];
    const items = signals.map((s) => {
      const text = `${s.label} · ${s.count}H${labelMult ? ` · ${s.multiplicity.abbr}` : ""}`;
      const cx = X((s.extentPpm[0] + s.extentPpm[1]) / 2); const wd = text.length * 6.6 + 30;
      let top = Infinity; for (const l of s.lines) top = Math.min(top, Y(signalIntensity(s, l.hz)));
      return { s, text, cx, wd, top };
    }).filter((it) => it.cx > x0 - 40 && it.cx < x1 + 40).sort((a, b) => a.cx - b.cx);
    const rows = [];
    for (const it of items) {
      let r = 0; while (rows[r] !== undefined && it.cx - it.wd / 2 < rows[r]) r += 1;
      rows[r] = it.cx + it.wd / 2; it.row = r;
    }
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, view, showAssignments, hideLabels, yScale, x0, x1, labelMult]);

  const tipText = hover ? (() => { const s = signals.find((q) => q.envId === hover); return s ? `${s.label}: δ ${s.deltaPpm.toFixed(2)} ppm, ${s.count} H, ${s.multiplicity.name}` : ""; })() : "";
  const empty = signals.length === 0;
  const cursorHz = cursorPpm === null ? null : cursorPpm * freqMHz;
  const envById = (id) => molecule.environments.find((e) => e.id === id);
  const selectPart = (envId, part, e) => { e?.stopPropagation?.(); if (moved.current) return; onSelectEnv?.(envId, part); };
  const keyAct = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); moved.current = false; fn(e); } };

  return (
    <div ref={wrapRef} className={`nm-plot${present ? " nm-plot--present" : ""}`} data-testid={testId} data-view-left={view.left.toFixed(4)} data-view-right={view.right.toFixed(4)} data-selected-env={selectedEnvId ?? ""} data-signals={signals.length} data-yzoom={yZoom.toFixed(2)}>
      {!hideToolbar && (
        <div className="nm-plot-tools" role="toolbar" aria-label="Spectrum view controls">
          <button type="button" className="sim-btn nm-iconbtn" onClick={() => zoomBy(0.6)} aria-label="Zoom in" title="Zoom in (scroll wheel, pinch or +)" data-testid="sp-zoom-in" disabled={!interactive}><Plus size={15} aria-hidden="true" /></button>
          <button type="button" className="sim-btn nm-iconbtn" onClick={() => zoomBy(1 / 0.6)} aria-label="Zoom out" title="Zoom out (or −)" data-testid="sp-zoom-out" disabled={!interactive}><Minus size={15} aria-hidden="true" /></button>
          <button type="button" className="sim-btn nm-iconbtn" onClick={() => panBy(0.25)} aria-label="Pan towards higher δ (left)" title="Pan left (higher δ)" data-testid="sp-pan-left" disabled={!interactive}><ChevronLeft size={15} aria-hidden="true" /></button>
          <button type="button" className="sim-btn nm-iconbtn" onClick={() => panBy(-0.25)} aria-label="Pan towards lower δ (right)" title="Pan right (lower δ)" data-testid="sp-pan-right" disabled={!interactive}><ChevronRight size={15} aria-hidden="true" /></button>
          <button type="button" className="sim-btn nm-iconbtn" onClick={() => setYZoom((z) => Math.min(8, z * 1.5))} aria-label="Increase vertical scale" title="Taller peaks" data-testid="sp-taller"><MoveVertical size={15} aria-hidden="true" /><span>+</span></button>
          <button type="button" className="sim-btn nm-iconbtn" onClick={() => setYZoom((z) => Math.max(0.25, z / 1.5))} aria-label="Decrease vertical scale" title="Shorter peaks" data-testid="sp-shorter"><MoveVertical size={15} aria-hidden="true" /><span>−</span></button>
          <button type="button" className="sim-btn nm-textbtn" onClick={zoomToSelection} disabled={!selectedSignal} title="Zoom to the selected multiplet" data-testid="sp-fit-selected"><ScanSearch size={15} aria-hidden="true" /><span>Zoom to selected</span></button>
          <button type="button" className="sim-btn nm-textbtn" onClick={reset} title="Reset zoom and position" data-testid="sp-reset"><RotateCcw size={15} aria-hidden="true" /><span>Reset view</span></button>
          <button type="button" className="sim-btn nm-textbtn" onClick={togglePresent} aria-pressed={present} title="Full-screen presentation of the spectrum (Esc to leave)" data-testid="sp-fullscreen">{present ? <Minimize2 size={15} aria-hidden="true" /> : <Expand size={15} aria-hidden="true" />}<span>{present ? "Exit full screen" : "Full screen"}</span></button>
          <span className="nm-plot-readout" aria-live="off" data-testid="sp-readout">{cursorPpm === null ? tipText || "Hover the spectrum" : `δ ${cursorPpm.toFixed(3)} ppm = ${cursorHz.toFixed(1)} Hz from TMS`}</span>
          {children}
        </div>
      )}
      <div ref={boxRef} className="nm-plot-box">
        <svg ref={svgRef} className="nm-plot-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="group" tabIndex={interactive ? 0 : -1} aria-label={`Predicted proton NMR spectrum of ${molecule.name}. Chemical shift axis in ppm, higher values on the left. ${signals.length} signal${signals.length === 1 ? "" : "s"} shown.`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMoveHover} onPointerLeave={() => setCursorPpm(null)} onKeyDown={onKeyDown} style={{ touchAction: "none", cursor: interactive ? "grab" : "default" }}>
          <defs><clipPath id={`clip-${testId}`}><rect x={x0 - 4} y={0} width={x1 - x0 + 8} height={h} /></clipPath></defs>
          {/* grid + axis */}
          <g clipPath={`url(#clip-${testId})`}>
            {ticks.ticks.map((t) => <line key={`g${t}`} x1={X(t)} x2={X(t)} y1={y0 - 6} y2={y1} stroke={THEME.gridline} />)}
            {view.left >= 0 && view.right <= 0 && (
              <g data-testid="tms-marker"><line x1={X(0)} x2={X(0)} y1={y0 - 6} y2={y1 + 8} stroke="#e8f0ff" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.85" />
                <text x={X(0)} y={y0 - 12 < 12 ? 12 : y0 - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e8f0ff" className="nm-svgtext">TMS (0)</text></g>
            )}
            {/* selection / compare bands */}
            {signals.map((s) => {
              const isSel = s.envId === selectedEnvId; const isCmp = s.envId === compareEnvId; const isCo = coupledEnvIds.includes(s.envId);
              if (!isSel && !isCmp && !isCo) return null;
              const env = s.env; const xa = X(s.extentPpm[1] + s.skirtPpm); const xb = X(s.extentPpm[0] - s.skirtPpm);
              const bw = Math.max(30, Math.abs(xb - xa) + 12); return <rect key={`band-${s.envId}`} x={(xa + xb) / 2 - bw / 2} width={bw} y={y0 - 4} height={plotH + 4} rx="6" fill={env.color} fillOpacity={isSel ? 0.15 : 0.08} stroke={isSel ? "none" : env.color} strokeWidth={1.5} strokeDasharray={isSel ? undefined : "5 4"} data-testid={isSel ? "band-selected" : isCo ? `band-coupled-${s.envId}` : "band-compare"} />;
            })}
            <line x1={x0} x2={x1} y1={Y(0)} y2={Y(0)} stroke="#cdd9f5" strokeWidth="1.5" />
            {/* hit targets (multiplets): below the traces and the interactive chips */}
          {interactive && signals.map((s) => {
            const xa = X(s.extentPpm[1] + s.skirtPpm); const xb = X(s.extentPpm[0] - s.skirtPpm); const cx = (xa + xb) / 2; const wd = Math.max(26, Math.abs(xb - xa) + 10);
            const env = envById(s.envId);
            return (
              <rect key={`hit-${s.envId}`} x={cx - wd / 2} y={y0 - 4} width={wd} height={plotH + 4} fill="transparent" role="button" tabIndex={0} data-testid={`peak-${s.envId}`} data-selected={s.envId === selectedEnvId ? "1" : "0"}
                aria-label={`Signal ${env.letter}: ${s.label}, ${s.deltaPpm.toFixed(2)} ppm, ${s.count} hydrogens, ${s.multiplicity.name}. Select to highlight in the molecule.`} aria-pressed={s.envId === selectedEnvId}
                style={{ cursor: "pointer" }} onClick={(e) => selectPart(s.envId, "peak", e)} onDoubleClick={() => setViewAnimated(viewForSignal(s))} onKeyDown={keyAct((e) => selectPart(s.envId, "peak", e))} onPointerEnter={() => setHover(s.envId)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(s.envId)} onBlur={() => setHover(null)}>
                <title>{`${s.label}: δ ${s.deltaPpm.toFixed(2)} ppm, ${s.count} H, ${s.multiplicity.name}`}</title>
              </rect>
            );
          })}
            {/* traces */}
            {signals.map((s, i) => {
              const isSel = s.envId === selectedEnvId; const dim = selectedEnvId && !isSel && !coupledEnvIds.includes(s.envId) && s.envId !== compareEnvId;
              return <path key={s.envId} d={paths[i]?.d ?? ""} fill={s.env.color} fillOpacity={isSel ? 0.28 : 0.1} stroke={s.env.color} strokeWidth={isSel ? 2.6 : 1.8} strokeLinejoin="round" opacity={dim ? 0.55 : 1} data-testid={`trace-${s.envId}`} pointerEvents="none" />;
            })}
            {/* splitting marks */}
            {showSplitting && signals.map((s) => {
              if (s.lines.length < 2 && !s.exchangeable) return null;
              const sel = s.envId === selectedEnvId || !selectedEnvId;
              const tops = s.lines.map((l) => Y(signalIntensity(s, l.hz)));
              const yJ = Math.max(12, Math.min(...tops) - 12 - (hideLabels ? 0 : 0));
              const xa = X(s.lines[0].ppm); const xb = X(s.lines[1]?.ppm ?? s.lines[0].ppm);
              return (
                <g key={`split-${s.envId}`} opacity={sel ? 1 : 0.35}>
                  {s.lines.map((l, i) => <g key={i}><line x1={X(l.ppm)} x2={X(l.ppm)} y1={Y(signalIntensity(s, l.hz)) - 3} y2={Y(signalIntensity(s, l.hz)) - 8} stroke={s.env.color} strokeWidth="2" /><text x={X(l.ppm)} y={Y(signalIntensity(s, l.hz)) - 11} fontSize="10" textAnchor="middle" fill={s.env.color} className="nm-svgtext" fontWeight="700">{i + 1}</text></g>)}
                  {s.lines.length > 1 && (
                    <g role="button" tabIndex={0} aria-label={`Splitting of ${s.label}: J = ${s.spins[0].J} hertz. Select to highlight the coupled neighbours.`} data-testid={`splitting-${s.envId}`} style={{ cursor: "pointer" }} onClick={(e) => selectPart(s.envId, "splitting", e)} onKeyDown={keyAct((e) => selectPart(s.envId, "splitting", e))}>
                      <path d={`M${xa} ${yJ + 5}V${yJ}H${xb}V${yJ + 5}`} fill="none" stroke="#e8f0ff" strokeWidth="1.6" />
                      <rect x={Math.min(xa, xb) - 4} y={yJ - 16} width={Math.abs(xb - xa) + 8} height="20" fill="transparent" />
                      {Math.abs(xb - xa) > 4 && <text x={(xa + xb) / 2} y={yJ - 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#e8f0ff" className="nm-svgtext" paintOrder="stroke" stroke="#0a1330" strokeWidth="3">J = {s.spins[0].J} Hz</text>}
                    </g>
                  )}
                </g>
              );
            })}
            {/* integration trace */}
            {integral && (
              <g data-testid="integration-trace">
                <path d={integral.d} fill="none" stroke="#f1f5ff" strokeWidth="1.8" strokeDasharray="1 0" opacity="0.8" pointerEvents="none" />
                {integral.steps.map(({ s, x, y }) => {
                  const sel = s.envId === selectedEnvId;
                  return (
                    <g key={s.envId} role="button" tabIndex={0} aria-label={integralLabel ? `Integral of the ${s.label} signal: ${integralLabel(s)}` : `Integration of ${s.label}: ${s.count} hydrogens`} data-testid={`integral-${s.envId}`} style={{ cursor: "pointer" }} onClick={(e) => selectPart(s.envId, "integral", e)} onKeyDown={keyAct((e) => selectPart(s.envId, "integral", e))}>
                      <rect x={x - 52} y={y - 11} width="56" height="22" rx="6" fill="#0a1330" fillOpacity="0.88" stroke={s.env.color} strokeWidth={sel ? 2.4 : 1.2} />
                      <text x={x - 24} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="12.5" fontWeight="800" fill={s.env.color} className="nm-svgtext">{integralLabel ? integralLabel(s) : `${s.count}H`}</text>
                    </g>
                  );
                })}
              </g>
            )}
          </g>
          {/* axis ticks and labels */}
          <g aria-hidden="true">
            {ticks.ticks.map((t) => (
              <g key={`t${t}`}><line x1={X(t)} x2={X(t)} y1={y1} y2={y1 + 6} stroke="#cdd9f5" strokeWidth="1.5" />
                <text x={X(t)} y={y1 + 19} textAnchor="middle" fontSize="11.5" fill="#dbe6ff" className="nm-svgtext">{t.toFixed(ticks.decimals)}</text></g>
            ))}
            {!hideLabels && <text x={(x0 + x1) / 2} y={y1 + 57} textAnchor="middle" fontSize="12" fontWeight="700" fill="#e8f0ff" className="nm-svgtext">δ (ppm)  ·  chemical shift relative to TMS</text>}
            {!hideLabels && <text x={x0} y={y1 + 57} textAnchor="start" fontSize="10.5" fill={THEME.muted} className="nm-svgtext">◀ downfield · deshielded</text>}
            {!hideLabels && <text x={x1} y={y1 + 57} textAnchor="end" fontSize="10.5" fill={THEME.muted} className="nm-svgtext">upfield · shielded ▶</text>}
          </g>
          {/* chemical-shift chips (click -> shielding explanation) */}
          {!hideLabels && (
            <g>
              {signals.map((s) => {
                const cx = X(s.deltaPpm); if (cx < x0 || cx > x1) return null; const sel = s.envId === selectedEnvId;
                return (
                  <g key={`shift-${s.envId}`} role="button" tabIndex={0} aria-label={`Chemical shift of ${s.label}: ${s.deltaPpm.toFixed(2)} ppm. Select for the shielding explanation.`} data-testid={`shift-${s.envId}`} style={{ cursor: "pointer" }} onClick={(e) => selectPart(s.envId, "shift", e)} onKeyDown={keyAct((e) => selectPart(s.envId, "shift", e))}>
                    <path d={`M${cx} ${y1 + 1}l-4 -5h8z`} fill={s.env.color} />
                    <rect x={cx - 21} y={y1 + 25} width="42" height="15" rx="4" fill="#0a1330" stroke={s.env.color} strokeWidth={sel ? 2 : 1} />
                    <text x={cx} y={y1 + 32.5} textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontWeight="700" fill={s.env.color} className="nm-svgtext">{s.deltaPpm.toFixed(2)}</text>
                  </g>
                );
              })}
            </g>
          )}
          {/* assignment labels */}
          {labels.map((it) => {
            const { s } = it; const sel = s.envId === selectedEnvId; const yy = Math.max(14, it.top - 22 - it.row * 19);
            const tw = it.wd;
            return (
              <g key={`lab-${s.envId}`} transform={`translate(${it.cx} ${yy})`} pointerEvents="none" data-testid={`label-${s.envId}`} opacity={selectedEnvId && !sel ? 0.8 : 1}>
                <rect x={-tw / 2} y={-10} width={tw} height="20" rx="10" fill="#0a1330" fillOpacity="0.9" stroke={s.env.color} strokeWidth={sel ? 2.2 : 1} />
                <EnvBadge env={s.env} r={7} x={-tw / 2 + 12} />
                <text x={-tw / 2 + 24} y={0.5} dominantBaseline="central" fontSize="11.5" fontWeight={sel ? 800 : 600} fill="#f1f5ff" className="nm-svgtext">{it.text}</text>
              </g>
            );
          })}
          {empty && <text x={(x0 + x1) / 2} y={(y0 + y1) / 2} textAnchor="middle" fontSize="14" fill={THEME.muted} className="nm-svgtext" data-testid="spectrum-empty">{emptyMessage ?? "No signals yet."}</text>}
        </svg>
      </div>
      <div className="nm-plot-note" data-testid="spectrum-note">{OPERATING_NOTE} Lorentzian lines, {fmtMHz(freqMHz)} MHz{hideLabels ? "" : ", first-order splitting"}.</div>
    </div>
  );
}
