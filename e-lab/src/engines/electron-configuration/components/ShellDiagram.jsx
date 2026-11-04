// A compact, non-decorative shell (Bohr-style) diagram: concentric rings
// labelled with the electron count in each principal shell, nucleus labelled
// with the proton count. Purpose is conceptual — connecting atomic number to
// shell structure — not a detailed physical model.

const RING_GAP = 20;
const BASE_RADIUS = 26;
const CENTER = 150;

export default function ShellDiagram({ shells, protonCount, revealCount }) {
  const visibleShells = typeof revealCount === "number" ? shells.slice(0, revealCount) : shells;
  const size = CENTER * 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label="Electron shell diagram">
      {visibleShells.map((count, i) => {
        const radius = BASE_RADIUS + i * RING_GAP;
        return (
          <g key={i}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={radius}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth="1.5"
              strokeDasharray="2 3"
            />
            <g>
              <circle cx={CENTER} cy={CENTER - radius} r="11" fill="var(--color-paper)" stroke="var(--color-indigo)" strokeWidth="1.5" />
              <text
                x={CENTER}
                y={CENTER - radius}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--color-indigo)"
              >
                {count}
              </text>
            </g>
          </g>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r="16" fill="var(--color-ink)" />
      <text
        x={CENTER}
        y={CENTER}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontFamily="var(--font-mono)"
        fill="var(--color-paper)"
      >
        {protonCount}+
      </text>
    </svg>
  );
}
