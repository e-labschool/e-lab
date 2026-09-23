import { useMemo } from "react";
import Particle from "./Particle.jsx";
import { buildNucleusLayout } from "../lib/nucleusLayout.js";
import { shellDistribution } from "../lib/electronShells.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

// Nucleus positions come UNCHANGED from the already-verified, previously
// bug-fixed buildNucleusLayout() -- never touched here. Only a scale
// multiplier and the drawn sphere radius change, both purely visual.
// Verified numerically before use: at NUCLEUS_SCALE=1.3 with a 13-unit
// sphere radius, even Calcium-40 (40 nucleons, the worst realistic
// case) has its outer edge at ~74 units from centre, comfortably clear
// of the first shell at radius 100 (a ~26-unit gap) -- Carbon-12 and
// Oxygen-18 clear by even more (54 and 44 units respectively).
const NUCLEUS_SCALE = 1.3;
const NUCLEON_SPHERE_SIZE = 26; // ~13% smaller than the previous 30

// Shell radii enlarged specifically to keep the first shell clear of the
// largest nucleus this simulation reasonably needs to render (see above).
const SHELL_RADII = [100, 132, 164, 196];
const SHELL_ROTATION_MS = [16000, 24000, 32000, 40000];
const ELECTRON_SPHERE_SIZE = 19; // ~13% smaller than the previous 22

function evenAngles(count) {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => (i / count) * 360);
}

export default function AtomVisualizer({ protons, neutrons, electrons, highlightZ, highlightA, highlightCharge, nucleusWarning }) {
  const reducedMotion = useReducedMotion();

  const nucleusItems = useMemo(
    () => buildNucleusLayout(protons, neutrons).map((item) => ({ ...item, x: item.x * NUCLEUS_SCALE, y: item.y * NUCLEUS_SCALE })),
    [protons, neutrons]
  );

  const shells = useMemo(() => shellDistribution(electrons), [electrons]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[620px]" role="img" aria-label={`Atom model with ${protons} protons, ${neutrons} neutrons, and ${electrons} electrons, distributed as ${shells.join(", ")} electrons per shell`}>
      <svg viewBox="-230 -230 460 460" className="h-full w-full overflow-visible">
        {shells.map((_, shellIndex) => (
          <circle key={`guide-${shellIndex}`} cx="0" cy="0" r={SHELL_RADII[Math.min(shellIndex, SHELL_RADII.length - 1)] + (shellIndex >= SHELL_RADII.length ? (shellIndex - SHELL_RADII.length + 1) * 32 : 0)} fill="none" stroke="var(--color-indigo)" strokeWidth="0.6" strokeDasharray="2 4" opacity="0.35" />
        ))}

        {/* each shell is ONE rotating group containing all its
            (already evenly-spaced) electrons -- never independently
            animated, so relative spacing never drifts. */}
        {shells.map((countOnShell, shellIndex) => {
          const radius = SHELL_RADII[Math.min(shellIndex, SHELL_RADII.length - 1)] + (shellIndex >= SHELL_RADII.length ? (shellIndex - SHELL_RADII.length + 1) * 32 : 0);
          const angles = evenAngles(countOnShell);
          const direction = shellIndex % 2 === 0 ? "normal" : "reverse";
          const counterDirection = direction === "normal" ? "reverse" : "normal";
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
                    {/* Counter-rotates at the SAME rate, opposite
                        direction, as the parent shell -- this exactly
                        cancels the inherited rotation so the minus
                        symbol stays upright while the electron's
                        POSITION (set by the translate above, outside
                        this counter-rotation) still genuinely orbits. */}
                    <g style={{ transformOrigin: "0px 0px", animation: reducedMotion ? "none" : `atom-shell-spin ${duration}ms linear infinite ${counterDirection}` }}>
                      <foreignObject x={-ELECTRON_SPHERE_SIZE / 2} y={-ELECTRON_SPHERE_SIZE / 2} width={ELECTRON_SPHERE_SIZE} height={ELECTRON_SPHERE_SIZE}>
                        <Particle type="electron" size={ELECTRON_SPHERE_SIZE} showSymbol symbolOverride="−" />
                      </foreignObject>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* nucleus */}
        <g className={[highlightZ || highlightA ? "atom-highlight-pulse" : "", nucleusWarning ? (reducedMotion ? "atom-boundary-highlight" : "atom-nucleus-wobble") : ""].filter(Boolean).join(" ") || undefined}>
          {nucleusItems.map((item) => (
            <foreignObject key={item.key} x={item.x - NUCLEON_SPHERE_SIZE / 2} y={item.y - NUCLEON_SPHERE_SIZE / 2} width={NUCLEON_SPHERE_SIZE} height={NUCLEON_SPHERE_SIZE}>
              <Particle type={item.type} size={NUCLEON_SPHERE_SIZE} showSymbol />
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
        /* A restrained instability cue -- the whole nucleus group
           shifts/rotates a few pixels, never independent nucleon
           throwing, and never anything resembling decay/explosion. */
        @keyframes atom-nucleus-wobble-kf {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(-3px, 1px) rotate(-1deg); }
          40% { transform: translate(3px, -1px) rotate(1deg); }
          60% { transform: translate(-2px, -1px) rotate(-0.7deg); }
          80% { transform: translate(2px, 1px) rotate(0.7deg); }
        }
        .atom-nucleus-wobble { animation: atom-nucleus-wobble-kf 900ms ease-in-out 1; transform-origin: 0px 0px; }
        /* Reduced-motion fallback: no wobble, just a brief amber/red
           boundary highlight conveying the same "outside the curated
           range" feedback without any motion. */
        @keyframes atom-boundary-highlight-kf { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 8px var(--color-coral)); } }
        .atom-boundary-highlight { animation: atom-boundary-highlight-kf 900ms ease-in-out 1; }
      `}</style>
    </div>
  );
}
