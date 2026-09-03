// A proper stick mass spectrum: vertical lines from baseline to abundance
// height at each m/z, not a bar or a smoothed curve. Monochrome, high
// contrast, scales automatically to the supplied peak data (auto-scales
// so this same component works whether it's called with 2 peaks or 6).
const W = 420;
const H = 220;
const PAD_L = 46;
const PAD_B = 34;
const PAD_T = 16;
const PAD_R = 16;

export default function MassSpectrumChart({ xLabel = "m/z", yLabel = "Relative abundance / %", peaks }) {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const mzs = peaks.map((p) => p.mz);
  const minMz = Math.min(...mzs);
  const maxMz = Math.max(...mzs);
  const range = Math.max(maxMz - minMz, 1);
  const xFor = (mz) => PAD_L + ((mz - minMz + 1) / (range + 2)) * plotW;
  const maxAbundance = Math.max(...peaks.map((p) => p.abundance), 100);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md text-[var(--color-ink)]" role="img" aria-label="Mass spectrum">
      {/* axes */}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.5" />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.5" />

      {/* y-axis ticks at 0/50/100 */}
      {[0, 50, 100].map((v) => {
        const y = H - PAD_B - (v / maxAbundance) * plotH;
        return (
          <g key={v}>
            <line x1={PAD_L - 4} y1={y} x2={PAD_L} y2={y} stroke="currentColor" strokeWidth="1" />
            <text x={PAD_L - 8} y={y + 4} fontSize="9" textAnchor="end" fill="currentColor">{v}</text>
          </g>
        );
      })}

      {/* sticks */}
      {peaks.map((p, i) => {
        const x = xFor(p.mz);
        const y = H - PAD_B - (p.abundance / maxAbundance) * plotH;
        return (
          <g key={i}>
            <line x1={x} y1={H - PAD_B} x2={x} y2={y} stroke="currentColor" strokeWidth="2" />
            <text x={x} y={H - PAD_B + 16} fontSize="10" textAnchor="middle" fill="currentColor">{p.mz}</text>
            {p.molecularIon && <text x={x} y={y - 4} fontSize="8" textAnchor="middle" fill="var(--color-amber)">M+</text>}
          </g>
        );
      })}

      <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} fontSize="10" textAnchor="middle" fill="currentColor">{xLabel}</text>
      <text x={12} y={PAD_T + plotH / 2} fontSize="10" textAnchor="middle" fill="currentColor" transform={`rotate(-90 12 ${PAD_T + plotH / 2})`}>{yLabel}</text>
    </svg>
  );
}
