const W = 360;
const H = 200;
const PAD_L = 40;
const PAD_B = 30;
const PAD_T = 14;
const PAD_R = 14;

export default function BarChart({ xLabel = "", yLabel = "", bars }) {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const maxValue = Math.max(...bars.map((b) => b.value), 100);
  const barWidth = Math.min(48, (plotW / bars.length) * 0.5);
  const step = plotW / bars.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm text-[var(--color-ink)]" role="img" aria-label="Bar chart">
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.5" />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.5" />

      {bars.map((b, i) => {
        const barH = (b.value / maxValue) * plotH;
        const x = PAD_L + step * i + (step - barWidth) / 2;
        const y = H - PAD_B - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} fill="currentColor" opacity="0.7" />
            <text x={x + barWidth / 2} y={y - 4} fontSize="9" textAnchor="middle" fill="currentColor">{b.value}%</text>
            <text x={x + barWidth / 2} y={H - PAD_B + 14} fontSize="9" textAnchor="middle" fill="currentColor">{b.label}</text>
          </g>
        );
      })}

      <text x={(PAD_L + W - PAD_R) / 2} y={H - 2} fontSize="9" textAnchor="middle" fill="currentColor">{xLabel}</text>
      {yLabel && (
        <text x={10} y={PAD_T + plotH / 2} fontSize="9" textAnchor="middle" fill="currentColor" transform={`rotate(-90 10 ${PAD_T + plotH / 2})`}>{yLabel}</text>
      )}
    </svg>
  );
}
