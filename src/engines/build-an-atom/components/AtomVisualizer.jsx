import { useMemo } from "react";
import Particle from "./Particle.jsx";
import { buildNucleusLayout } from "../lib/nucleusLayout.js";
import { shellDistribution } from "../lib/electronShells.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

// Nucleus positions come UNCHANGED from the already-verified
// buildNucleusLayout() (its shared-counter bug fix is not touched here)
// -- only uniformly scaled up for a larger, more readable nucleus. A
// scale multiplier can never reintroduce that bug: it doesn't change
// WHICH position any given particle gets, only how far from the centre
// every position sits, applied identically to all of them.
const NUCLEUS_SCALE = 1.55;

// Shell radii for the simplified 1-20-electron model, plus overflow
// buckets beyond it (see electronShells.js for why this isn't a 2n^2
// filling rule). Alternating rotation direction per shell -- purely a
// visual device, not a claim about real electron motion.
const SHELL_RADII = [56, 82, 108, 132];
const SHELL_ROTATION_MS = [16000, 24000, 32000, 40000];

/** Fixed, evenly-spaced angles for `count` electrons on one shell --
 * computed ONCE per shell's electron count, then the whole shell
 * (all its electrons together) is wrapped in a single rotating group.
 * This is what keeps relative spacing constant while rotating: rotating
 * a rigid group of already-evenly-spaced points never bunches them,
 * since their angles relative to EACH OTHER never change, only the
 * group's overall orientation does. */
function evenAngles(count) {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => (i / count) * 360);
}

export default function AtomVisualizer({ protons, neutrons, electrons, highlightZ, highlightA, highlightCharge }) {
  const reducedMotion = useReducedMotion();

  const nucleusItems = useMemo(
    () => buildNucleusLayout(protons, neutrons).map((item) => ({ ...item, x: item.x * NUCLEUS_SCALE, y: item.y * NUCLEUS_SCALE })),
    [protons, neutrons]
  );

  const shells = useMemo(() => shellDistribution(electrons), [electrons]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]" role="img" aria-label={`Atom model with ${protons} protons, ${neutrons} neutrons, and ${electrons} electrons, distributed as ${shells.join(", ")} electrons per shell`}>
      <svg viewBox="-160 -160 320 320" className="h-full w-full overflow-visible">
        {/* faint shell guides */}
        {shells.map((_, shellIndex) => (
          <circle key={`guide-${shellIndex}`} cx="0" cy="0" r={SHELL_RADII[Math.min(shellIndex, SHELL_RADII.length - 1)] + (shellIndex >= SHELL_RADII.length ? (shellIndex - SHELL_RADII.length + 1) * 24 : 0)} fill="none" stroke="var(--color-indigo)" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.35" />
        ))}

        {/* each shell is ONE rotating group containing all its (already
            evenly-spaced) electrons -- never independently animated */}
        {shells.map((countOnShell, shellIndex) => {
          const radius = SHELL_RADII[Math.min(shellIndex, SHELL_RADII.length - 1)] + (shellIndex >= SHELL_RADII.length ? (shellIndex - SHELL_RADII.length + 1) * 24 : 0);
          const angles = evenAngles(countOnShell);
          const direction = shellIndex % 2 === 0 ? "normal" : "reverse";
          const duration = SHELL_ROTATION_MS[Math.min(shellIndex, SHELL_ROTATION_MS.length - 1)];
          return (
            <g
              key={`shell-${shellIndex}`}
              style={{ transformOrigin: "0px 0px", animation: reducedMotion ? "none" : `atom-shell-spin ${duration}ms linear infinite ${direction}` }}
            >
              {angles.map((angleDeg, i) => {
                const rad = (angleDeg * Math.PI) / 180;
                const x = radius * Math.cos(rad);
                const y = radius * Math.sin(rad);
                return (
                  <g key={`e-${shellIndex}-${i}`} transform={`translate(${x} ${y})`} className={highlightCharge ? "atom-highlight-pulse" : undefined}>
                    <foreignObject x="-11" y="-11" width="22" height="22">
                      <Particle type="electron" size={22} showSymbol={false} />
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* nucleus */}
        <g className={highlightZ || highlightA ? "atom-highlight-pulse" : undefined}>
          {nucleusItems.map((item) => (
            <foreignObject key={item.key} x={item.x - 15} y={item.y - 15} width="30" height="30">
              <Particle type={item.type} size={30} showSymbol />
            </foreignObject>
          ))}
        </g>

        {protons === 0 && (
          <text x="0" y="4" textAnchor="middle" fontSize="11" fill="var(--color-ink-faint)">
            No nucleus yet
          </text>
        )}
      </svg>

      <style>{`
        @keyframes atom-shell-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes atom-highlight-pulse-kf { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 6px var(--color-indigo)); } }
        .atom-highlight-pulse { animation: atom-highlight-pulse-kf 700ms ease-in-out 1; }
      `}</style>
    </div>
  );
}
