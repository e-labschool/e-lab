import { useMemo, useRef } from "react";
import { smoothedRate, binnedCounts, niceMax, WINDOW_S, RATE_WINDOW } from "../lib/rateMetrics.js";
import { useBox } from "../useBox.js";
import { CURVE, TEXT, MUTED } from "../theme.js";


/**
 * Measured rate against time, from the SAME successful-collision counts that drive the vessel.
 *  view "rate":     bars = successful collisions in each 1 s (raw, noisy); line = average over the last 10 s.
 *  view "products": cumulative products formed; rate = gradient (dashed tangent over the last 10 s).
 * Dashed vertical lines mark the moments conditions were changed.
 */
export default function RateGraph({ hist, marks, view }) {
  const wrap = useRef(null);
  const { w: W, h: H } = useBox(wrap, { w: 380, h: 190 });
  const padL = 46; const padR = 10; const padT = 10; const padB = 38;
  const pw = Math.max(40, W - padL - padR); const ph = Math.max(36, H - padT - padB);
  const tNow = hist.t.length ? hist.t[hist.t.length - 1] : 0;
  const t1 = Math.max(WINDOW_S, tNow);
  const data = useMemo(() => {
    const sm = smoothedRate(hist.t, hist.succ, RATE_WINDOW);
    const bins = binnedCounts(hist.t, hist.succ, 1);
    return { sm, bins };
  }, [hist]);
  const x = (t) => padL + ((t - (t1 - WINDOW_S)) / WINDOW_S) * pw;
  const prod = view === "products";
  let ymaxData = 0.5;
  const first = hist.t.findIndex((t) => t >= t1 - WINDOW_S - 1e-9);
  const from = first < 0 ? 0 : first;
  if (prod) { ymaxData = hist.succ.length ? hist.succ[hist.succ.length - 1] : 1; }
  else {
    for (let k = from; k < data.sm.length; k++) ymaxData = Math.max(ymaxData, data.sm[k]);
    for (let k = 0; k < data.bins.x.length; k++) if (data.bins.x[k] >= t1 - WINDOW_S) ymaxData = Math.max(ymaxData, data.bins.v[k]);
  }
  const ymax = niceMax(ymaxData * 1.1, prod ? 5 : 1);
  const y = (v) => padT + (1 - v / ymax) * ph;
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => f * ymax);
  const xt = []; for (let t = Math.ceil((t1 - WINDOW_S) / 10) * 10; t <= t1 + 1e-9; t += 10) xt.push(t);
  let linePath = ""; let barEls = null; let tangent = null;
  if (prod) {
    for (let k = from; k < hist.t.length; k++) linePath += `${linePath ? "L" : "M"}${x(hist.t[k]).toFixed(1)},${y(hist.succ[k]).toFixed(1)}`;
    const L = hist.t.length;
    if (L > 2) {
      let k0 = L - 1; while (k0 > 0 && hist.t[L - 1] - hist.t[k0 - 1] <= RATE_WINDOW + 1e-9) k0--;
      const dt = hist.t[L - 1] - hist.t[k0];
      if (dt > 0) { const slope = (hist.succ[L - 1] - hist.succ[k0]) / dt; const ta = hist.t[L - 1] - RATE_WINDOW; const tb = hist.t[L - 1]; const ya = hist.succ[L - 1] - slope * (tb - ta);
        tangent = { x1: x(Math.max(ta, t1 - WINDOW_S)), y1: y(ya + slope * (Math.max(ta, t1 - WINDOW_S) - ta)), x2: x(tb), y2: y(hist.succ[L - 1]) }; }
    }
  } else {
    for (let k = from; k < data.sm.length; k++) linePath += `${linePath ? "L" : "M"}${x(hist.t[k]).toFixed(1)},${y(data.sm[k]).toFixed(1)}`;
    barEls = data.bins.x.map((bx, k) => (bx >= t1 - WINDOW_S ? <rect key={k} x={x(bx - 1) + 0.5} y={y(data.bins.v[k])} width={Math.max(1, x(bx) - x(bx - 1) - 1)} height={Math.max(0, y(0) - y(data.bins.v[k]))} fill="#9db6e8" fillOpacity="0.6" /> : null));
  }
  const visMarks = marks.filter((m) => m.t >= t1 - WINDOW_S).slice(-4);
  const label = prod ? "Graph of products formed against simulated time." : "Graph of the measured rate of reaction against simulated time.";
  return (
    <div ref={wrap} className="ct-rate-plot" data-testid="rate-plot">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} data-testid="rate-svg">
        <defs><clipPath id="ct-rate-clip"><rect x={padL} y={padT} width={pw} height={ph} /></clipPath></defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={padL + pw} y1={y(v)} y2={y(v)} stroke="#d6e0f2" />
            <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{prod ? Math.round(v) : v < 10 ? v.toFixed(v < 1 ? 2 : 1) : Math.round(v)}</text>
          </g>
        ))}
        {xt.map((t) => (<g key={t}><line x1={x(t)} x2={x(t)} y1={padT + ph} y2={padT + ph + 4} stroke={MUTED} /><text x={x(t)} y={padT + ph + 16} textAnchor="middle" fontSize="11" fill={MUTED}>{Math.round(t)}</text></g>))}
        <line x1={padL} x2={padL} y1={padT} y2={padT + ph} stroke={MUTED} />
        <line x1={padL} x2={padL + pw} y1={padT + ph} y2={padT + ph} stroke={MUTED} />
        <text x={padL + pw / 2} y={H - 6} textAnchor="middle" fontSize="12" fill={TEXT}>Simulated time / s</text>
        <text transform={`translate(12 ${padT + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={TEXT}>{prod ? "Products formed" : ph >= 120 ? "Rate / reactions s⁻¹" : "Rate / s⁻¹"}</text>
        <g clipPath="url(#ct-rate-clip)">
          {barEls}
          {visMarks.map((m, i) => (<line key={i} x1={x(m.t)} x2={x(m.t)} y1={padT} y2={padT + ph} stroke="#7c3aed" strokeDasharray="4 3" />))}
          <path d={linePath} fill="none" stroke={CURVE} strokeWidth="2.4" data-testid="rate-line" />
          {tangent && <line {...tangent} stroke="#c2410c" strokeWidth="2" strokeDasharray="5 3" />}
        </g>
        {visMarks.map((m, i) => (<text key={i} x={Math.min(x(m.t) + 3, padL + pw - 4)} y={padT + 11 + (i % 2) * 12} fontSize="11" fill="#5b21b6" textAnchor={x(m.t) + 3 > padL + pw - 70 ? "end" : "start"}>{m.label}</text>))}
      </svg>
    </div>
  );
}
