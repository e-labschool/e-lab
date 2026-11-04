// A paper chromatogram: baseline, solvent front, and spots positioned
// proportionally between them — the data a student needs to calculate Rf.
export default function Chromatogram({ baselineToFront, spots }) {
  const H = 160, W = 90;
  const top = 12, bottom = H - 12;
  const yFor = (distFromBaseline) => bottom - (distFromBaseline / baselineToFront) * (bottom - top);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-24 text-[var(--color-ink)]" role="img" aria-label="Paper chromatogram">
      <rect x="20" y={top} width="50" height={bottom - top} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="15" y1={top} x2="75" y2={top} stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <text x="78" y={top + 3} fontSize="6" fill="currentColor">front</text>
      <line x1="15" y1={bottom} x2="75" y2={bottom} stroke="currentColor" strokeWidth="1.25" />
      <text x="78" y={bottom + 3} fontSize="6" fill="currentColor">start</text>
      {spots.map((s, i) => (
        <g key={i}>
          <circle cx={45} cy={yFor(s.distance)} r="4" fill="var(--color-amber)" opacity="0.7" />
          <text x="8" y={yFor(s.distance) + 3} fontSize="7" textAnchor="end" fill="currentColor">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}
