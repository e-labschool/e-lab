// Shell (Bohr-style) diagram that draws the ACTUAL electrons: each ring carries its electrons as dots at even angles, the
// nucleus shows the proton count and net charge. A conceptual model (not to scale, electrons do not orbit like planets).
// A newly revealed shell fades in (180 ms) unless the user prefers reduced motion.
import { useReducedMotion } from "../logic/useReducedMotion.js";

const RING_GAP = 20;
const BASE_RADIUS = 28;
const CENTER = 150;

export default function ShellDiagram({ shells, protonCount, revealCount, charge = 0 }) {
  const reduced = useReducedMotion();
  const visibleShells = typeof revealCount === "number" ? shells.slice(0, revealCount) : shells;
  const size = CENTER * 2;
  const total = visibleShells.reduce((a, b) => a + b, 0);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label={`Electron shell diagram: ${visibleShells.join(", ") || "no electrons"} electrons in successive shells, ${total} electrons in total`}>
      {visibleShells.map((count, i) => {
        const radius = BASE_RADIUS + i * RING_GAP;
        return (
          <g key={i} style={reduced ? undefined : { animation: "ec-drop 180ms ease-out" }}>
            <circle cx={CENTER} cy={CENTER} r={radius} fill="none" stroke="var(--color-line-strong, var(--color-line))" strokeWidth="1.2" />
            {Array.from({ length: count }, (_, k) => {
              const a = (k / count) * 2 * Math.PI - Math.PI / 2;
              return <circle key={k} cx={CENTER + radius * Math.cos(a)} cy={CENTER + radius * Math.sin(a)} r="4.2" fill="var(--color-indigo)" />;
            })}
            <text x={CENTER + radius + 3} y={CENTER - 3} fontSize="9" fill="var(--color-ink-soft)" fontFamily="var(--font-mono)">{count}</text>
          </g>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r="16" fill="var(--color-ink)" />
      <text x={CENTER} y={CENTER} textAnchor="middle" dominantBaseline="central" fontSize="11" fontFamily="var(--font-mono)" fill="var(--color-paper)">{protonCount}+</text>
    </svg>
  );
}
