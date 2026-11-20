import { memo, useMemo, useRef, useState } from "react";
import { useElementSize } from "./hooks.js";
import { nearestIndex, niceAxis, tickLabel } from "./scale.js";

const M = { l: 46, r: 10, t: 14, b: 38 };

/**
 * One time-series graph drawn from REAL model history (never a prerecorded curve).
 *   series: [{ key, label, color, dash, x: number[], y: (number|null)[] }]
 *   marks:  [{ t, kind: "disturb" | "eq", label, n }]       ghost: [{ key, y, color, label }] dotted reference levels (before a disturbance)
 * Hover / pointer or arrow keys read exact values; Enter or click pins the read-out; curves can be shown / hidden.
 */
function GraphImpl({ testId, title, ariaLabel, series, hidden, onToggle, xLabel, yLabel, xMin = 10, yFloor = 0, marks = [], ghost = [], formatY = tickLabel, height = 190, empty = null }) {
  const wrapRef = useRef(null); const { width } = useElementSize(wrapRef);
  const W = Math.max(220, Math.round(width)); const H = height;
  const [cursor, setCursor] = useState(null); const [pinned, setPinned] = useState(false);
  const visible = useMemo(() => series.filter((s) => !hidden?.has(s.key)), [series, hidden]);
  const geo = useMemo(() => {
    let tmax = xMin; let ymax = 0;
    for (const s of visible) { if (s.x.length) tmax = Math.max(tmax, s.x[s.x.length - 1]); for (const v of s.y) if (v != null && v > ymax) ymax = v; }
    for (const g of ghost) if (!hidden?.has(g.key) && g.y > ymax) ymax = g.y;
    const ax = niceAxis(yFloor, ymax * 1.06 || 1, 4); const xa = niceAxis(0, tmax, 5);
    return { ax, xa };
  }, [visible, ghost, hidden, xMin, yFloor]);
  const pw = W - M.l - M.r; const ph = H - M.t - M.b;
  const X = (t) => M.l + (t / geo.xa.max) * pw; const Y = (v) => M.t + ph - ((v - geo.ax.min) / (geo.ax.max - geo.ax.min)) * ph;
  const paths = useMemo(() => visible.map((s) => {
    let d = ""; let pen = false;
    for (let i = 0; i < s.x.length; i += 1) { const v = s.y[i]; if (v == null || !Number.isFinite(v)) { pen = false; continue; } d += `${pen ? "L" : "M"}${X(s.x[i]).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; }
    return { key: s.key, d };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [visible, W, H, geo]);

  const primary = visible[0]; const idx = cursor != null && primary ? Math.min(cursor, primary.x.length - 1) : null;
  const tCur = idx != null && idx >= 0 ? primary.x[idx] : null;
  const onMove = (e) => {
    if (pinned || !primary || !primary.x.length) return;
    const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
    const tv = ((px - M.l) / pw) * geo.xa.max; setCursor(Math.max(0, nearestIndex(primary.x, tv)));
  };
  const onKey = (e) => {
    if (!primary || !primary.x.length) return; const n = primary.x.length;
    const step = e.shiftKey ? 10 : 1; let c = cursor ?? n - 1;
    if (e.key === "ArrowRight") c = Math.min(n - 1, c + step); else if (e.key === "ArrowLeft") c = Math.max(0, c - step);
    else if (e.key === "Home") c = 0; else if (e.key === "End") c = n - 1;
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPinned((p) => !p); setCursor(c); return; }
    else if (e.key === "Escape") { setPinned(false); setCursor(null); return; } else return;
    e.preventDefault(); setCursor(c);
  };
  const readout = tCur == null ? null : visible.map((s) => ({ key: s.key, label: s.label, color: s.color, v: s.y[Math.min(idx, s.y.length - 1)] }));

  return (
    <div className="eq-graph" data-testid={testId} ref={wrapRef}>
      <div className="eq-graph-head"><h4>{title}</h4>
        <div className="eq-legend" role="group" aria-label={`${title}: show or hide curves`}>
          {series.map((s) => (
            <button key={s.key} type="button" className={"eq-legend-btn" + (hidden?.has(s.key) ? " is-off" : "")} aria-pressed={!hidden?.has(s.key)} onClick={() => onToggle?.(s.key)} data-testid={`${testId}-toggle-${s.key}`} title={`${hidden?.has(s.key) ? "Show" : "Hide"} ${s.label}`}>
              <svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash || undefined} strokeLinecap="round" /></svg>
              <span>{s.label}</span>
            </button>))}
        </div>
      </div>
      <svg className="eq-graph-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" tabIndex={0} aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => { if (!pinned) setCursor(null); }}
        onClick={() => { if (tCur != null) setPinned((p) => !p); }} onKeyDown={onKey} onBlur={() => { if (!pinned) setCursor(null); }} data-testid={`${testId}-svg`}>
        <rect x={M.l} y={M.t} width={pw} height={ph} className="eq-plot" />
        {geo.ax.ticks.map((v) => (<g key={`y${v}`}><line x1={M.l} x2={M.l + pw} y1={Y(v)} y2={Y(v)} className="eq-grid" /><text x={M.l - 6} y={Y(v) + 4} textAnchor="end" className="eq-tick">{formatY(v)}</text></g>))}
        {geo.xa.ticks.map((v) => (<g key={`x${v}`}><line x1={X(v)} x2={X(v)} y1={M.t + ph} y2={M.t + ph + 4} className="eq-axis" /><text x={X(v)} y={H - 20} textAnchor="middle" className="eq-tick">{tickLabel(v)}</text></g>))}
        <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + ph} className="eq-axis" /><line x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} className="eq-axis" />
        <text x={M.l + pw / 2} y={H - 1} textAnchor="middle" className="eq-axlabel">{xLabel}</text>
        <text transform={`translate(11 ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="eq-axlabel">{yLabel}</text>
        {marks.filter((m) => m.kind === "eq").map((m, i) => (<g key={`eq${i}`}><rect x={X(m.t)} y={M.t} width={Math.max(0, M.l + pw - X(m.t))} height={ph} className="eq-eqband" /><line x1={X(m.t)} x2={X(m.t)} y1={M.t} y2={M.t + ph} className="eq-eqline" /></g>))}
        {marks.filter((m) => m.kind === "disturb").map((m, i) => (<g key={`d${i}`}><line x1={X(m.t)} x2={X(m.t)} y1={M.t} y2={M.t + ph} className="eq-distline" /><circle cx={X(m.t)} cy={M.t + 7} r="7" className="eq-distdot" /><text x={X(m.t)} y={M.t + 10.5} textAnchor="middle" className="eq-disttxt">{m.n}</text></g>))}
        {ghost.filter((g) => !hidden?.has(g.key)).map((g) => (<line key={`g${g.key}`} x1={M.l} x2={M.l + pw} y1={Y(g.y)} y2={Y(g.y)} stroke={g.color} strokeWidth="1.6" strokeDasharray="2 4" opacity="0.8"><title>{g.label}</title></line>))}
        {paths.map((p) => { const s = visible.find((v) => v.key === p.key); return <path key={p.key} d={p.d} fill="none" stroke={s.color} strokeWidth="2.4" strokeDasharray={s.dash || undefined} strokeLinejoin="round" strokeLinecap="round" />; })}
        {tCur != null && (<g><line x1={X(tCur)} x2={X(tCur)} y1={M.t} y2={M.t + ph} className="eq-cursor" />{readout.map((r) => (r.v != null ? <circle key={r.key} cx={X(tCur)} cy={Y(r.v)} r="4" fill={r.color} stroke="#fff" strokeWidth="1.5" /> : null))}</g>)}
        {series.length > 0 && visible.length === 0 && <text x={M.l + pw / 2} y={M.t + ph / 2} textAnchor="middle" className="eq-tick">All curves hidden</text>}
        {empty && primary && primary.x.length < 2 && <text x={M.l + pw / 2} y={M.t + ph / 2} textAnchor="middle" className="eq-tick">{empty}</text>}
      </svg>
      <div className="eq-readout" aria-live="off" data-testid={`${testId}-readout`}>
        {readout ? (<><span className="eq-readout-t">t = {tickLabel(tCur)}{pinned ? " (pinned)" : ""}</span>{readout.map((r) => (<span key={r.key} className="eq-readout-v"><i style={{ background: r.color }} aria-hidden="true" />{r.label}: <b>{r.v == null ? "–" : formatY(r.v)}</b></span>))}</>)
          : <span className="eq-readout-hint">Hover, touch or use ← → to read values. Enter pins the reading.</span>}
      </div>
    </div>
  );
}
export default memo(GraphImpl);
