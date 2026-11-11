import { useMemo } from "react";
import { useSize } from "../../components/useSize.js";
import { cumulativeIntegral, fullyVisible, niceTicks, ppmOfX, sampleSignal, signalIntensity, visiblePeakHeight, xOfPpm } from "../../nmr/molecular/model/spectrum.js";

// ¹H NMR spectrum: chemical shift DECREASING to the right, TMS at 0 ppm. Peak-aware sampling of the Lorentzian lines (the NMR workspace's own model), so a line only
// a fraction of a pixel wide is drawn at its true height. Optional integration curve and integration values. No assignment labels.
const M = { l: 12, r: 14, t: 26, b: 46 };
const pathOf = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");

export default function NmrPlot({ signals, regions, view, freqMHz, showIntegral, integText, selectedId, onSelect, cursor, onCursor, expanded }) {
  const [ref, size] = useSize();
  const W = Math.max(260, size.width || 520); const H = Math.max(170, size.height || 300);
  const pw = W - M.l - M.r; const ph = H - M.t - M.b; const base = M.t + ph;
  const sx = (ppm) => xOfPpm(view, ppm, M.l, M.l + pw);
  const tms = useMemo(() => {
    const tallest = Math.max(...signals.map((s) => Math.max(...s.lines.map((l) => signalIntensity(s, l.hz)))));
    const w = 1.2; const h = 0.14 * tallest;
    return { id: "tms", lines: [{ hz: 0, ppm: 0, rel: 1, area: (h * Math.PI * w) / 2 }], widthHz: w, extentHz: [0, 0], extentPpm: [0, 0], skirtPpm: (w * 4) / freqMHz };
  }, [signals, freqMHz]);
  const peakMax = Math.max(visiblePeakHeight(signals, view), visiblePeakHeight([tms], view), 1e-9);
  const sy = (h) => base - (h / peakMax) * ph * 0.84;
  const curves = useMemo(() => signals.map((s) => ({ s, pts: sampleSignal(s, view, freqMHz, pw) })), [signals, view, freqMHz, pw]);
  const tmsPts = sampleSignal(tms, view, freqMHz, pw);
  const xt = niceTicks(view, Math.max(4, Math.floor(pw / 70)));
  const fmt = (v) => v.toFixed(xt.decimals).replace("-", "−");
  // integration curve over the signals that are completely inside the view
  const integ = useMemo(() => {
    if (!showIntegral) return null;
    const vis = fullyVisible(signals, view); if (!vis.length) return null;
    const total = vis.reduce((a, s) => a + s.area, 0); const xs = new Set();
    const n = Math.round(pw * 1.5); for (let i = 0; i <= n; i += 1) xs.add(((view.left - (i / n) * (view.left - view.right)) * freqMHz));
    for (const s of vis) for (const l of s.lines) for (const k of [0.4, 1, 2, 4, 8, 16, 40]) { xs.add(l.hz + k * s.widthHz); xs.add(l.hz - k * s.widthHz); }
    const hzs = [...xs].filter((hz) => hz / freqMHz <= view.left && hz / freqMHz >= view.right).sort((a, b) => b - a);
    return pts(hzs, vis, total);
    function pts(list, v, tot) { return list.map((hz) => [M.l + ((view.left - hz / freqMHz) / (view.left - view.right)) * pw, base - ph * 0.05 - (cumulativeIntegral(v, hz) / tot) * ph * 0.5]); }
  }, [showIntegral, signals, view, freqMHz, pw, ph, base]);
  const selRegion = regions.find((r) => r.id === selectedId) ?? null;
  const selSignals = selRegion ? signals.filter((s) => selRegion.ids.includes(s.id)) : [];
  const span = view.left - view.right;
  const move = (e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; const ppm = ppmOfX(view, x, M.l, M.l + pw); onCursor(ppm <= view.left && ppm >= view.right ? ppm : null); };
  return (
    <div ref={ref} className="st-plotfill">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="st-nmr" role="group" aria-label="Proton NMR spectrum of the unknown: signal intensity against chemical shift in ppm, decreasing from left to right, TMS at 0 ppm" data-testid="nmr-spectrum"
        data-left={view.left.toFixed(3)} data-right={view.right.toFixed(3)} onPointerMove={move} onPointerLeave={() => onCursor(null)}>
        <defs><clipPath id="st-nmr-clip"><rect x={M.l} y={M.t - 4} width={pw} height={ph + 4} /></clipPath></defs>
        <rect x={M.l} y={M.t} width={pw} height={ph} className="ss-plot-bg" />
        {xt.ticks.map((v) => <line key={`g${v}`} x1={sx(v)} x2={sx(v)} y1={M.t} y2={base} className="ss-grid" />)}
        <g clipPath="url(#st-nmr-clip)">
          {selRegion && <rect x={Math.max(M.l, sx(selRegion.hi))} y={M.t} width={Math.max(10, sx(selRegion.lo) - sx(selRegion.hi))} height={ph} className="st-selband" data-testid="nmr-selected-band" />}
          {integ && <path d={pathOf(integ)} fill="none" className="st-integ" strokeWidth="1.8" data-testid="integration-curve" />}
          <path d={pathOf(tmsPts.ppm.map((p, i) => [sx(p), sy(tmsPts.y[i])]))} fill="none" className="st-tms" strokeWidth="1.6" data-testid="tms-peak" />
          {curves.map(({ s, pts: p }) => {
            const reg = regions.find((r) => r.ids.includes(s.id)); const on = reg?.id === selectedId;
            return <path key={s.id} d={pathOf(p.ppm.map((v, i) => [sx(v), sy(p.y[i])]))} fill="none" className={`st-trace${on ? " is-sel" : ""}`} strokeWidth={on ? 2.3 : 1.7} strokeLinejoin="round" data-testid={`trace-${s.id}`} data-ppm={s.shift} />;
          })}
          {expanded && selSignals.map((s) => s.lines.map((l, i) => <line key={`${s.id}${i}`} x1={sx(l.ppm)} x2={sx(l.ppm)} y1={base - 1} y2={base - 9} className="st-linetick" data-testid="line-tick" />))}
          {cursor != null && <line x1={sx(cursor)} x2={sx(cursor)} y1={M.t} y2={base} className="ss-cursor" data-testid="nmr-cursor" />}
        </g>
        <rect x={M.l} y={M.t} width={pw} height={ph} fill="none" className="ss-axis" />
        {regions.map((r) => {
          const x1 = sx(r.hi); const x2 = sx(r.lo); const w = Math.max(18, x2 - x1); const x = Math.max(M.l, (x1 + x2) / 2 - w / 2);
          if (x2 < M.l || x1 > M.l + pw) return null;
          return (
            <g key={r.id} className="st-hit" role="button" tabIndex={0} aria-label={`${r.overlapped ? "Overlapping signals" : "Signal"} near ${r.centre.toFixed(1)} ppm`} aria-pressed={r.id === selectedId} data-testid={`signal-${r.id}`} data-ppm={r.centre.toFixed(2)}
              onClick={() => onSelect(r.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(r.id); } }}>
              <rect x={x} y={M.t} width={Math.min(w, pw)} height={ph} className="st-hitrect" />
            </g>
          );
        })}
        {showIntegral && integText && regions.map((r) => {
          const cx = sx(r.centre); if (cx < M.l + 6 || cx > M.l + pw - 6) return null;
          return <text key={`it${r.id}`} x={cx} y={M.t + 14} textAnchor="middle" className="st-integtext" data-testid={`integral-${r.id}`}>{integText[r.id]?.text}</text>;
        })}
        {xt.ticks.map((v) => <g key={`t${v}`}><line x1={sx(v)} x2={sx(v)} y1={base} y2={base + 5} className="ss-axis" /><text x={sx(v)} y={base + 19} textAnchor="middle" className="ss-tick st-tick">{fmt(v)}</text></g>)}
        {0 >= view.right && 0 <= view.left && <text x={sx(0)} y={sy(tms.lines[0].area * 2 / (Math.PI * tms.widthHz)) - 6} textAnchor="middle" className="st-tmslabel" data-testid="tms-label">TMS</text>}
        {cursor != null && <text x={Math.min(W - 70, Math.max(M.l + 4, sx(cursor) + 6))} y={M.t + 28} className="st-cursortext" data-testid="nmr-cursor-label">{cursor.toFixed(span < 0.5 ? 3 : 2)} ppm</text>}
        <text x={M.l + pw / 2} y={H - 6} textAnchor="middle" className="ss-axis-label st-axlabel">Chemical shift δ (ppm)</text>
      </svg>
    </div>
  );
}
