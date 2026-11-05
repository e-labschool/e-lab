import { useMemo } from "react";

// A small, dependency-free SVG line plot used by every graph of the physics stages (time plots, response vs offset, FID, spectrum).
// Series with many points are reduced to a min/max pair per pixel column, so peaks and fast oscillations are never lost.

export function niceTicks(lo, hi, target = 5) {
  if (!(hi > lo)) return [lo];
  const span = hi - lo; const raw = span / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw)); const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const out = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}
const fmt = (v, step) => {
  if (v === 0) return "0";
  const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  const s = v.toFixed(d); return s.replace("-", "−");
};

function pathFor(xs, ys, sx, sy, x0, x1, px) {
  const n = xs.length; if (!n) return "";
  const lo = Math.min(x0, x1); const hi = Math.max(x0, x1);
  // first / last index inside the domain (x ascending)
  let i0 = 0; let i1 = n - 1;
  { let a = 0; let b = n - 1; while (a < b) { const m = (a + b) >> 1; if (xs[m] < lo) a = m + 1; else b = m; } i0 = Math.max(0, a - 1); }
  { let a = 0; let b = n - 1; while (a < b) { const m = (a + b + 1) >> 1; if (xs[m] > hi) b = m - 1; else a = m; } i1 = Math.min(n - 1, b + 1); }
  const cnt = i1 - i0 + 1; if (cnt <= 0) return "";
  const parts = [];
  if (cnt <= px * 2.5) {
    for (let i = i0; i <= i1; i += 1) parts.push(`${i === i0 ? "M" : "L"}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`);
    return parts.join("");
  }
  // min/max per pixel column
  const cols = new Map();
  for (let i = i0; i <= i1; i += 1) {
    const c = Math.round(sx(xs[i])); const y = ys[i];
    const e = cols.get(c);
    if (!e) cols.set(c, { mn: y, mx: y, first: y, last: y }); else { if (y < e.mn) e.mn = y; if (y > e.mx) e.mx = y; e.last = y; }
  }
  const keys = [...cols.keys()].sort((a, b) => a - b); let started = false;
  for (const c of keys) {
    const e = cols.get(c); const a = sy(e.first); const b = sy(e.last);
    const ymin = sy(e.mx); const ymax = sy(e.mn); // screen y inverted
    const seq = a <= b ? [ymin, ymax] : [ymax, ymin];
    for (const y of seq) { parts.push(`${started ? "L" : "M"}${c},${y.toFixed(1)}`); started = true; }
  }
  return parts.join("");
}

/**
 * props: width, height (px), series [{x, y, color, width, dash, fillTo, opacity, label}], xDomain, yDomain, xLabel, yLabel, reverseX,
 * markers [{x, label, color, dash}], cursorX, xTicks, yTicks, ariaLabel, desc, overlay({sx, sy, plot}), margin; yLabel may be an array of lines
 */
export default function LinePlot({
  width, height, series, xDomain, yDomain, xLabel, yLabel, reverseX = false, markers = [], cursorX, xTicks, yTicks,
  ariaLabel, desc, overlay, margin, xFormat, yFormat, showYAxis = true, testId,
}) {
  const m = margin ?? { l: showYAxis ? 44 : 10, r: 10, t: 8, b: 30 };
  const W = Math.max(40, width); const H = Math.max(40, height);
  const pw = Math.max(8, W - m.l - m.r); const ph = Math.max(8, H - m.t - m.b);
  const [x0, x1] = xDomain; const [y0, y1] = yDomain;
  const sx = useMemo(() => (reverseX ? (x) => m.l + ((x1 - x) / (x1 - x0)) * pw : (x) => m.l + ((x - x0) / (x1 - x0)) * pw), [reverseX, m.l, pw, x0, x1]);
  const sy = useMemo(() => (y) => m.t + (1 - (y - y0) / (y1 - y0)) * ph, [m.t, ph, y0, y1]);
  const xt = xTicks ?? niceTicks(x0, x1, Math.max(3, Math.floor(pw / 90)));
  const yt = yTicks ?? niceTicks(y0, y1, Math.max(3, Math.floor(ph / 45)));
  const xs = xt.length > 1 ? Math.abs(xt[1] - xt[0]) : 1; const ys = yt.length > 1 ? Math.abs(yt[1] - yt[0]) : 1;
  const paths = series.map((s) => (s && s.x && s.x.length ? pathFor(s.x, s.y, sx, sy, x0, x1, pw) : ""));
  const clipId = useMemo(() => `lp-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} data-testid={testId} className="ss-plot">
      {desc && <desc>{desc}</desc>}
      <clipPath id={clipId}><rect x={m.l} y={m.t} width={pw} height={ph} /></clipPath>
      <rect x={m.l} y={m.t} width={pw} height={ph} className="ss-plot-bg" />
      {yt.map((v) => <line key={`gy${v}`} x1={m.l} x2={m.l + pw} y1={sy(v)} y2={sy(v)} className="ss-grid" />)}
      {xt.map((v) => <line key={`gx${v}`} y1={m.t} y2={m.t + ph} x1={sx(v)} x2={sx(v)} className="ss-grid" />)}
      <g clipPath={`url(#${clipId})`}>
        {series.map((s, i) => s && paths[i] && (
          <g key={i}>
            {s.fillTo !== undefined && <path d={`${paths[i]}L${sx(s.x[s.x.length - 1]).toFixed(1)},${sy(s.fillTo)}L${sx(s.x[0]).toFixed(1)},${sy(s.fillTo)}Z`} fill={s.color} opacity={0.18} />}
            <path d={paths[i]} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.6} strokeDasharray={s.dash} opacity={s.opacity ?? 1} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
        {markers.map((mk, i) => (
          <line key={`mk${i}`} x1={sx(mk.x)} x2={sx(mk.x)} y1={m.t} y2={m.t + ph} stroke={mk.color ?? "var(--ss-accent2)"} strokeWidth={1.4} strokeDasharray={mk.dash ?? "5 4"} />
        ))}
        {cursorX !== undefined && cursorX !== null && <line x1={sx(cursorX)} x2={sx(cursorX)} y1={m.t} y2={m.t + ph} className="ss-cursor" />}
        {overlay?.({ sx, sy, plot: { l: m.l, t: m.t, w: pw, h: ph } })}
      </g>
      <rect x={m.l} y={m.t} width={pw} height={ph} fill="none" className="ss-axis" />
      {xt.map((v) => (
        <g key={`tx${v}`}>
          <line x1={sx(v)} x2={sx(v)} y1={m.t + ph} y2={m.t + ph + 4} className="ss-axis" />
          <text x={sx(v)} y={m.t + ph + 16} textAnchor="middle" className="ss-tick">{xFormat ? xFormat(v) : fmt(v, xs)}</text>
        </g>
      ))}
      {showYAxis && yt.map((v) => (
        <g key={`ty${v}`}>
          <line x1={m.l - 4} x2={m.l} y1={sy(v)} y2={sy(v)} className="ss-axis" />
          <text x={m.l - 7} y={sy(v) + 4} textAnchor="end" className="ss-tick">{yFormat ? yFormat(v) : fmt(v, ys)}</text>
        </g>
      ))}
      {xLabel && <text x={m.l + pw / 2} y={H - 3} textAnchor="middle" className="ss-axis-label">{xLabel}</text>}
      {yLabel && (Array.isArray(yLabel)
        ? <text transform={`translate(11 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="ss-axis-label">{yLabel.map((line, i) => <tspan key={i} x="0" dy={i === 0 ? 0 : "1.25em"}>{i < yLabel.length - 1 ? `${line} ` : line}</tspan>)}</text>
        : <text transform={`translate(11 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="ss-axis-label">{yLabel}</text>)}
    </svg>
  );
}
