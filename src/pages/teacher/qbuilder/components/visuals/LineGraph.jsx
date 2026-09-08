// A qualitative TREND diagram — not a plotted dataset. No numerical
// scale or data points are invented; only the shape of the trend
// (increasing/decreasing/rise-then-cool) is represented, matching what
// this stimulus type's stored data actually contains.
const W = 300, H = 190, PAD_L = 44, PAD_B = 34, PAD_T = 16, PAD_R = 16;

const TREND_PATHS = {
  increasing: `M ${PAD_L} ${H - PAD_B} C ${PAD_L + 60} ${H - PAD_B - 20}, ${W - PAD_R - 60} ${PAD_T + 30}, ${W - PAD_R} ${PAD_T}`,
  decreasing: `M ${PAD_L} ${PAD_T} C ${PAD_L + 60} ${PAD_T + 30}, ${W - PAD_R - 60} ${H - PAD_B - 20}, ${W - PAD_R} ${H - PAD_B}`,
  "rise-then-cool": `M ${PAD_L} ${H - PAD_B} C ${PAD_L + 50} ${PAD_T + 10}, ${PAD_L + 110} ${PAD_T}, ${W / 2 + 20} ${PAD_T + 15} S ${W - PAD_R - 30} ${PAD_T + 40}, ${W - PAD_R} ${PAD_T + 55}`,
};

export default function LineGraph({ trend, xLabel = "", yLabel = "", context, extrapolation = false }) {
  const path = TREND_PATHS[trend] ?? TREND_PATHS.increasing;

  return (
    <div className="flex flex-col items-start gap-1.5 text-[var(--color-ink)]">
      {context && <p className="text-xs text-[var(--color-ink-faint)]">{context}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" role="img" aria-label={`Qualitative trend graph: ${yLabel} is ${trend} with ${xLabel}`}>
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.25" />
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.25" />
        <path d={path} fill="none" stroke="var(--color-indigo)" strokeWidth="2.25" strokeLinecap="round" />
        {extrapolation && (
          <path d={path} fill="none" stroke="var(--color-indigo)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" transform={`translate(${(W - PAD_R - PAD_L) * 0.15}, 0)`} />
        )}
        <text x={W / 2} y={H - 4} fontSize="10" textAnchor="middle" fill="currentColor">{xLabel}</text>
        <text x={12} y={H / 2} fontSize="10" textAnchor="middle" fill="currentColor" transform={`rotate(-90 12 ${H / 2})`}>{yLabel}</text>
      </svg>
    </div>
  );
}
