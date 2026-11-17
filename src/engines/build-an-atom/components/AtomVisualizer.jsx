import { useId, useMemo } from "react";
import { PARTICLE_STYLES } from "./Particle.jsx";
import { buildNucleusLayout } from "../lib/nucleusLayout.js";
import { shellDistribution } from "../lib/electronShells.js";
import { shellRadii } from "../lib/shellRadii.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { nucleusScaling } from "../lib/nucleusScaling.js";

// Nucleus positions come UNCHANGED from the already-verified, previously
// bug-fixed buildNucleusLayout() -- never touched here. Only a scale
// multiplier and the drawn sphere radius change, both purely visual.
// Verified numerically before use: at NUCLEUS_SCALE=1.3 with a 13-unit
// sphere radius, even Calcium-40 (40 nucleons, the worst realistic
// case) has its outer edge at ~74 units from centre, comfortably clear
// of the first shell at radius 100 (a ~26-unit gap) -- Carbon-12 and
// Oxygen-18 clear by even more (54 and 44 units respectively).
// Shell radii enlarged specifically to keep the first shell clear of the
// largest nucleus this simulation reasonably needs to render (see above).
const SHELL_ROTATION_MS = [16000, 24000, 32000, 40000, 48000];
const ELECTRON_SPHERE_SIZE = 19; // ~13% smaller than the previous 22

function evenAngles(count) {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => (i / count) * 360);
}

// SIZING: the visualiser fills whatever box its parent gives it (the parent
// must be `position: relative` with a definite size) and the SVG's own
// viewBox (preserveAspectRatio "meet") scales the whole atom uniformly to the
// smaller of that box's width and height -- so it always fits and can never
// grow past its area onto the controls. No transform/zoom scaling involved.
/** BA-10: plain SVG circles that share ONE set of gradients (the old build nested a whole <svg> inside a <foreignObject> per particle). */
function Dot({ type, r, uid, symbol, showSymbol }) {
  const st = PARTICLE_STYLES[type];
  return (
    <g>
      <circle r={r} fill={`url(#${uid}-${type})`} />
      <ellipse cx={-r * 0.28} cy={-r * 0.45} rx={r * 0.3} ry={r * 0.19} fill="rgba(255,255,255,0.4)" />
      {showSymbol && <text y={r * 0.32} textAnchor="middle" fontSize={r * 0.95} fontWeight="700" fill="rgba(255,255,255,0.95)">{symbol ?? st.symbol}</text>}
    </g>
  );
}

export default function AtomVisualizer({ protons, neutrons, electrons, highlightZ, highlightA, highlightCharge, nucleusWarning }) {
  const reducedMotion = useReducedMotion();
  const uid = `av${useId().replace(/:/g, "")}`;

  const { scale: nucleusScale, sphere: nucleonSize } = useMemo(() => nucleusScaling(protons, neutrons), [protons, neutrons]);
  const nucleusItems = useMemo(
    () => buildNucleusLayout(protons, neutrons).map((item) => ({ ...item, x: item.x * nucleusScale, y: item.y * nucleusScale })),
    [protons, neutrons, nucleusScale]
  );

  const shells = useMemo(() => shellDistribution(electrons), [electrons]);
  const radii = shellRadii(shells.length);

  return (
    <div
      className="absolute inset-0"
      data-testid="atom-visualizer"
      role="img"
      aria-label={`Atom model with ${protons} protons, ${neutrons} neutrons, and ${electrons} electrons, with the electron arrangement ${shells.join(",") || "none"}`}
    >
      <svg viewBox="-230 -230 460 460" preserveAspectRatio="xMidYMid meet" className="block h-full w-full" data-testid="atom-svg">
        <title>A model: electrons do not literally orbit the nucleus like planets, and the nucleus is not drawn to scale.</title>
        <defs>
          {Object.entries(PARTICLE_STYLES).map(([type, st]) => (
            <radialGradient key={type} id={`${uid}-${type}`} cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor={st.light} /><stop offset="55%" stopColor={st.base} /><stop offset="100%" stopColor={st.dark} /></radialGradient>
          ))}
        </defs>
        {shells.map((_, shellIndex) => (
          <circle key={`guide-${shellIndex}`} cx="0" cy="0" r={radii[shellIndex]} fill="none" stroke="var(--color-indigo)" strokeWidth="0.6" strokeDasharray="2 4" opacity="0.35" />
        ))}

        {/* each shell is ONE rotating group containing all its
            (already evenly-spaced) electrons -- never independently
            animated, so relative spacing never drifts. ALL shells
            rotate in the SAME direction (orbit direction is not the
            visual device for distinguishing shells here -- the
            per-electron spin ring below is). */}
        {shells.map((countOnShell, shellIndex) => {
          const radius = radii[shellIndex];
          const angles = evenAngles(countOnShell);
          const duration = SHELL_ROTATION_MS[shellIndex];
          return (
            <g
              key={`shell-${shellIndex}`}
              style={{ transformOrigin: "0px 0px", animation: reducedMotion ? "none" : `atom-shell-spin ${duration}ms linear infinite` }}
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
                    <g style={{ transformOrigin: "0px 0px", animation: reducedMotion ? "none" : `atom-shell-spin ${duration}ms linear infinite reverse` }}>
                      <Dot type="electron" r={ELECTRON_SPHERE_SIZE * 0.43} uid={uid} symbol="−" showSymbol />
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
            <g key={item.key} transform={`translate(${item.x} ${item.y})`}><Dot type={item.type} r={nucleonSize * 0.43} uid={uid} showSymbol={nucleonSize >= 16} /></g>
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
