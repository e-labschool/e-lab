// A Hess's-law cycle: labelled species nodes connected by directional
// arrows, each carrying a delta-H value (or "?" for the unknown target of
// the question) — a triangle for a 3-node cycle, or a simple vertical
// two-step path.
export default function HessCycle({ nodes, arrows }) {
  const positions = nodes.length === 3
    ? [{ x: 90, y: 16 }, { x: 20, y: 90 }, { x: 160, y: 90 }]
    : nodes.map((_, i) => ({ x: 90, y: 16 + i * 55 }));

  const nodeAt = (id) => {
    const idx = nodes.findIndex((n) => n.id === id);
    return positions[idx] ?? { x: 90, y: 16 };
  };

  return (
    <svg viewBox="0 0 180 160" className="w-full max-w-[220px] text-[var(--color-ink)]" role="img" aria-label="Hess's law cycle">
      <defs>
        <marker id="hess-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>
      {arrows.map((a, i) => {
        const from = nodeAt(a.from), to = nodeAt(a.to);
        const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
        return (
          <g key={i}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeWidth="1.25" markerEnd="url(#hess-arrow)" />
            <text x={mx + (a.labelOffsetX ?? 8)} y={my} fontSize="8" fill="var(--color-amber)">{a.label}</text>
          </g>
        );
      })}
      {nodes.map((n, i) => (
        <g key={n.id}>
          <circle cx={positions[i].x} cy={positions[i].y} r="4" fill="currentColor" />
          <text x={positions[i].x} y={positions[i].y - 8} fontSize="9" textAnchor="middle" fill="currentColor">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}
