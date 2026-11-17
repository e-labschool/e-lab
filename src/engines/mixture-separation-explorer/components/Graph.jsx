// Temperature-time graph drawn from run.series ([labSeconds, potT, headT|null]). Reference lines mark the boiling points.
import { useMemo } from "react";

const W = 320; const H = 210; const M = { l: 40, r: 10, t: 14, b: 34 };
const niceMax = (v) => { const steps = [60, 120, 180, 240, 300, 420, 600, 900, 1200, 1800, 2400, 3600, 5400, 7200]; return steps.find((s) => s >= v) ?? Math.ceil(v / 600) * 600; };
const fmtMin = (s) => (s >= 120 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

export default function Graph({ series, bps = [], showHead = false, tMaxHint = 100, caption, testId = "ms-graph" }) {
  // run.series is appended to in place, so its length (not its identity) is what changes
  const n = series.length;
  const data = useMemo(() => series.filter((r) => Number.isFinite(r[0]) && Number.isFinite(r[1])), [series, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const tEnd = niceMax(Math.max(60, data.length ? data[data.length - 1][0] : 0));
  const Tmax = Math.max(tMaxHint, ...data.map((r) => Math.max(r[1], r[2] ?? 0)), ...bps.map((b) => b.T)) * 1.08;
  const Tm = Math.ceil(Tmax / 20) * 20;
  const x = (t) => M.l + (t / tEnd) * (W - M.l - M.r);
  const y = (T) => H - M.b - (T / Tm) * (H - M.t - M.b);
  const path = (i) => data.filter((r) => r[i] != null).map((r, k) => `${k ? "L" : "M"}${x(r[0]).toFixed(1)},${y(r[i]).toFixed(1)}`).join(" ");
  const yTicks = []; for (let T = 0; T <= Tm; T += Tm > 200 ? 100 : 20) yTicks.push(T);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * tEnd);
  return (
    <figure className="ms-graph" data-testid={testId}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption ?? "Temperature against time"} preserveAspectRatio="xMidYMid meet">
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="var(--ms-plot-bg)" stroke="var(--ms-line)" />
        {yTicks.map((T) => <g key={T}><line x1={M.l} x2={W - M.r} y1={y(T)} y2={y(T)} stroke="var(--ms-grid)" /><text x={M.l - 5} y={y(T) + 3.5} textAnchor="end" className="ms-axis">{T}</text></g>)}
        {xTicks.map((t, i) => <text key={t} x={x(t)} y={H - M.b + 14} textAnchor={i === xTicks.length - 1 ? "end" : "middle"} className="ms-axis">{fmtMin(t)}</text>)}
        <text x={12} y={(M.t + H - M.b) / 2} transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`} textAnchor="middle" className="ms-axis">Temperature (°C)</text>
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" className="ms-axis">Time (lab time)</text>
        {bps.map((b) => (
          <g key={b.label}><line x1={M.l} x2={W - M.r} y1={y(b.T)} y2={y(b.T)} stroke={b.colour} strokeDasharray="5 4" strokeWidth="1.4" /><text x={W - M.r - 2} y={y(b.T) - 3} textAnchor="end" className="ms-axis" fill={b.colour}>{b.label} {Math.round(b.T)} °C</text></g>
        ))}
        {data.length > 1 && <path d={path(1)} fill="none" stroke="#c2410c" strokeWidth="2.2" strokeLinejoin="round" />}
        {showHead && data.some((r) => r[2] != null) && <path d={path(2)} fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinejoin="round" />}
        {data.length > 0 && <circle cx={x(data[data.length - 1][0])} cy={y(data[data.length - 1][1])} r="3.6" fill="#c2410c" />}
        {showHead && data.length > 0 && data[data.length - 1][2] != null && <circle cx={x(data[data.length - 1][0])} cy={y(data[data.length - 1][2])} r="3.6" fill="#1d4ed8" />}
      </svg>
      <figcaption className="ms-graph-key">
        <span><i style={{ background: "#c2410c" }} aria-hidden="true" />{showHead ? "Flask (liquid)" : "Temperature of the contents"}</span>
        {showHead && <span><i style={{ background: "#1d4ed8" }} aria-hidden="true" />Thermometer in the vapour</span>}
      </figcaption>
    </figure>
  );
}
