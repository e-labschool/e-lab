// One flexible grid-of-particles renderer covering four named
// requirements from the brief: IonicLatticeDiagram (alternating +/-),
// MetallicLatticeDiagram (cation grid + delocalized electron sea),
// AlloyParticleDiagram (mixed particle sizes vs a uniform pure-metal
// grid), and NetworkCovalentDiagram (grid of atoms linked by bonds to
// every neighbour) — one `mode` prop selects the variant rather than four
// separate components.
const CELL = 26;

function seeded(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export default function IonGridDiagram({ mode = "ionic-alternating", rows = 3, cols = 4, variant = "pure" }) {
  const W = cols * CELL + 20, H = rows * CELL + 20;
  const rand = seeded(rows * 31 + cols);

  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push({ r, c, x: 10 + c * CELL + CELL / 2, y: 10 + r * CELL + CELL / 2 });
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[220px] text-[var(--color-ink)]" role="img" aria-label={`${mode} particle grid`}>
      {mode === "covalent-network" &&
        cells.map((cell, i) => {
          const right = cells.find((o) => o.r === cell.r && o.c === cell.c + 1);
          const down = cells.find((o) => o.r === cell.r + 1 && o.c === cell.c);
          return (
            <g key={`bonds-${i}`}>
              {right && <line x1={cell.x} y1={cell.y} x2={right.x} y2={right.y} stroke="currentColor" strokeWidth="1" opacity="0.6" />}
              {down && <line x1={cell.x} y1={cell.y} x2={down.x} y2={down.y} stroke="currentColor" strokeWidth="1" opacity="0.6" />}
            </g>
          );
        })}

      {mode === "metallic-sea" &&
        Array.from({ length: rows * cols * 3 }, (_, i) => (
          <circle key={`e-${i}`} cx={10 + rand() * (W - 20)} cy={10 + rand() * (H - 20)} r="1" fill="var(--color-amber)" opacity="0.6" />
        ))}

      {cells.map((cell, i) => {
        if (mode === "ionic-alternating") {
          const isCation = (cell.r + cell.c) % 2 === 0;
          return (
            <g key={i}>
              <circle cx={cell.x} cy={cell.y} r="8" fill={isCation ? "var(--color-indigo-soft)" : "var(--color-amber-soft)"} stroke="currentColor" strokeWidth="1" />
              <text x={cell.x} y={cell.y + 3} fontSize="8" textAnchor="middle" fill="currentColor">{isCation ? "+" : "\u2212"}</text>
            </g>
          );
        }
        if (mode === "metallic-sea") {
          const isDifferent = variant === "alloy" && (cell.r * cols + cell.c) % 5 === 2;
          return <circle key={i} cx={cell.x} cy={cell.y} r={isDifferent ? "5" : "7.5"} fill={isDifferent ? "var(--color-amber-soft)" : "var(--color-indigo-soft)"} stroke="currentColor" strokeWidth="1" />;
        }
        return <circle key={i} cx={cell.x} cy={cell.y} r="6" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1.25" />;
      })}
    </svg>
  );
}
