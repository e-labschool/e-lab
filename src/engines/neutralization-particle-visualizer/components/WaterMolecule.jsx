// A simple, recognizable water molecule: one oxygen atom (larger, warm
// red) bonded to two hydrogen atoms (smaller, white) in a bent
// arrangement — a real molecular model, not just a merged dot, so
// students actually see water being formed rather than the ions simply
// vanishing. `glowing` is a brief, subtle highlight right at the moment
// of formation — no explosions or sparks.
export default function WaterMolecule({ x, y, glowing = false }) {
  const oR = 7, hR = 4.5;
  const h1 = { x: x - 9, y: y + 7 };
  const h2 = { x: x + 9, y: y + 7 };

  return (
    <g style={glowing ? { filter: "drop-shadow(0 0 5px rgba(182,131,255,0.85))" } : undefined}>
      <line x1={x} y1={y} x2={h1.x} y2={h1.y} stroke="var(--color-ink-faint)" strokeWidth="1.5" />
      <line x1={x} y1={y} x2={h2.x} y2={h2.y} stroke="var(--color-ink-faint)" strokeWidth="1.5" />
      <circle cx={h1.x} cy={h1.y} r={hR} fill="white" stroke="var(--color-ink-faint)" strokeWidth="1" />
      <circle cx={h2.x} cy={h2.y} r={hR} fill="white" stroke="var(--color-ink-faint)" strokeWidth="1" />
      <circle cx={x} cy={y} r={oR} fill="#B85C4A" />
      <text x={h1.x} y={h1.y + 3} textAnchor="middle" fontSize="6" fill="var(--color-ink-soft)">H</text>
      <text x={h2.x} y={h2.y + 3} textAnchor="middle" fontSize="6" fill="var(--color-ink-soft)">H</text>
      <text x={x} y={y + 2.5} textAnchor="middle" fontSize="7" fill="white" fontWeight="700">O</text>
    </g>
  );
}
