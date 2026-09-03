// A simplified 1H NMR spectrum: chemical-shift axis running high-to-low
// (matching real NMR convention, ppm decreasing left to right), each
// signal drawn as its correct multiplicity (n+1 lines) with an
// integration label — signals, integration, and splitting are inherently
// one spectrum, so this single component covers all three named
// requirements rather than three separate ones.
const W = 340, H = 130, PAD_L = 16, PAD_B = 26, PAD_R = 16;
const X_MIN = 0, X_MAX = 12;
const LINES_FOR = { singlet: 1, doublet: 2, triplet: 3, quartet: 4, multiplet: 5 };

export default function NMRSpectrumChart({ signals }) {
  const plotW = W - PAD_L - PAD_R;
  const xFor = (shift) => PAD_L + ((X_MAX - shift) / (X_MAX - X_MIN)) * plotW;
  const baseline = H - PAD_B;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md text-[var(--color-ink)]" role="img" aria-label="1H NMR spectrum">
      <line x1={PAD_L} y1={baseline} x2={W - PAD_R} y2={baseline} stroke="currentColor" strokeWidth="1" />
      {signals.map((s, i) => {
        const n = LINES_FOR[s.multiplicity] ?? 1;
        const cx = xFor(s.shift);
        const spacing = 3.5;
        const start = -(n - 1) / 2;
        return (
          <g key={i}>
            {Array.from({ length: n }, (_, j) => {
              const x = cx + (start + j) * spacing;
              const h = 18 + (s.integration ?? 1) * 4;
              return <line key={j} x1={x} y1={baseline} x2={x} y2={baseline - h} stroke="currentColor" strokeWidth="1.25" />;
            })}
            <text x={cx} y={baseline + 12} fontSize="7" textAnchor="middle" fill="currentColor">{s.shift}</text>
            <text x={cx} y={baseline - (18 + (s.integration ?? 1) * 4) - 4} fontSize="7" textAnchor="middle" fill="var(--color-amber)">{s.integration}H</text>
          </g>
        );
      })}
      <text x={(PAD_L + W - PAD_R) / 2} y={H - 2} fontSize="8" textAnchor="middle" fill="currentColor">Chemical shift / ppm</text>
    </svg>
  );
}
