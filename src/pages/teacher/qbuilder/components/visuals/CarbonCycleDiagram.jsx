// A short, simplified carbon-cycle loop of labelled boxes connected by
// directional arrows.
export default function CarbonCycleDiagram({ stages }) {
  const n = stages.length;
  const R = 65, CX = 90, CY = 75;
  const positions = stages.map((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  });

  return (
    <svg viewBox="0 0 180 150" className="w-full max-w-[220px] text-[var(--color-ink)]" role="img" aria-label="Carbon cycle diagram">
      <defs>
        <marker id="cc-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>
      {positions.map((p, i) => {
        const next = positions[(i + 1) % n];
        const dx = next.x - p.x, dy = next.y - p.y, len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const x1 = p.x + ux * 22, y1 = p.y + uy * 22, x2 = next.x - ux * 24, y2 = next.y - uy * 24;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.25" markerEnd="url(#cc-arrow)" />;
      })}
      {stages.map((s, i) => (
        <g key={i}>
          <rect x={positions[i].x - 20} y={positions[i].y - 10} width="40" height="20" rx="3" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1" />
          <text x={positions[i].x} y={positions[i].y + 3} fontSize="6.5" textAnchor="middle" fill="currentColor">{s}</text>
        </g>
      ))}
    </svg>
  );
}
