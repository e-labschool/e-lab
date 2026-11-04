// Horizontal energy levels (n = 1, 2, 3...) with labelled transition
// arrows. When `converge` is true, level spacing follows an inverse-square
// pattern (matching the real -1/n^2 energy relationship) so higher levels
// are visibly closer together, as the hydrogen spectrum requires; when
// false, levels are evenly spaced (used where convergence isn't the point
// of the question).
const W = 300;
const H = 200;
const PAD_X = 50;
const TOP = 16;
const BOTTOM = H - 16;

export default function EnergyLevelDiagram({ levels, transitions = [], converge = true }) {
  const maxN = Math.max(...levels);
  // y position: converge=true uses 1/n^2 spacing (levels bunch up near the top); else evenly spaced.
  function yFor(n) {
    if (!converge) {
      return BOTTOM - ((n - 1) / (maxN - 1)) * (BOTTOM - TOP);
    }
    const frac = (n) => 1 - 1 / (n * n);
    const minFrac = frac(1);
    const maxFrac = frac(maxN);
    return BOTTOM - ((frac(n) - minFrac) / (maxFrac - minFrac)) * (BOTTOM - TOP);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs text-[var(--color-ink)]" role="img" aria-label="Energy level diagram">
      {levels.map((n) => (
        <g key={n}>
          <line x1={PAD_X} y1={yFor(n)} x2={W - 16} y2={yFor(n)} stroke="currentColor" strokeWidth="1.5" />
          <text x={PAD_X - 8} y={yFor(n) + 3} fontSize="10" textAnchor="end" fill="currentColor">n={n}</text>
        </g>
      ))}
      {transitions.map((t, i) => {
        const x = PAD_X + 24 + i * ((W - PAD_X - 40) / Math.max(transitions.length - 1, 1));
        const y1 = yFor(t.from);
        const y2 = yFor(t.to);
        return (
          <g key={i}>
            <defs>
              <marker id={`arrow-${i}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
              </marker>
            </defs>
            <line x1={x} y1={y1} x2={x} y2={y2 - 6} stroke="currentColor" strokeWidth="1.5" markerEnd={`url(#arrow-${i})`} />
            <text x={x + 5} y={(y1 + y2) / 2} fontSize="9" fill="currentColor">{t.label ?? ""}</text>
          </g>
        );
      })}
    </svg>
  );
}
