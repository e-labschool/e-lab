// Connected-line graph for successive ionization energies (or any
// increasing-then-jumping trend, e.g. first-IE-across-a-period). Supports
// an optional log y-scale since successive IE values can span orders of
// magnitude, per the batch's own note that a log axis may improve
// visibility.
const W = 320;
const H = 200;
const PAD_L = 42;
const PAD_B = 30;
const PAD_T = 14;
const PAD_R = 14;

export default function IonizationEnergyGraph({ points, xLabel = "", yLabel = "", logScale = false }) {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const values = points.map((p) => p.value);
  const scale = (v) => (logScale ? Math.log10(v) : v);
  const minV = Math.min(...values.map(scale));
  const maxV = Math.max(...values.map(scale));
  const xFor = (i) => PAD_L + (i / (points.length - 1 || 1)) * plotW;
  const yFor = (v) => H - PAD_B - ((scale(v) - minV) / (maxV - minV || 1)) * plotH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm text-[var(--color-ink)]" role="img" aria-label="Ionization energy graph">
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.5" />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.5" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(p.value)} r="3" fill="currentColor" />
          <text x={xFor(i)} y={H - PAD_B + 14} fontSize="9" textAnchor="middle" fill="currentColor">{p.label}</text>
        </g>
      ))}
      <text x={(PAD_L + W - PAD_R) / 2} y={H - 2} fontSize="9" textAnchor="middle" fill="currentColor">{xLabel}</text>
      <text x={10} y={PAD_T + plotH / 2} fontSize="9" textAnchor="middle" fill="currentColor" transform={`rotate(-90 10 ${PAD_T + plotH / 2})`}>{yLabel}{logScale ? " (log)" : ""}</text>
    </svg>
  );
}
