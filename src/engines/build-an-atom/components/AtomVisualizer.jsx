import { useMemo } from "react";
import Particle from "./Particle.jsx";
import { buildNucleusLayout } from "../lib/nucleusLayout.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

// Electron positions are split into up to two simple rings -- purely a
// VISUAL device for "electrons surround the nucleus", never real
// shell-capacity chemistry (detailed electron configuration is
// deliberately out of scope for S1.2). Ring membership is by index, so
// an individual electron's ring never changes just because OTHER
// electrons were added/removed elsewhere in the same ring.
const RING_1_CAPACITY = 8;


export default function AtomVisualizer({ protons, neutrons, electrons, highlightZ, highlightA, highlightCharge }) {
  const reducedMotion = useReducedMotion();
  const nucleusItems = useMemo(() => buildNucleusLayout(protons, neutrons), [protons, neutrons]);

  const ring1Count = Math.min(electrons, RING_1_CAPACITY);
  const ring2Count = Math.max(0, electrons - RING_1_CAPACITY);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]" role="img" aria-label={`Atom model with ${protons} protons, ${neutrons} neutrons, and ${electrons} electrons`}>
      <svg viewBox="-100 -100 200 200" className="h-full w-full overflow-visible">
        {/* electron ring guides -- faint, purely decorative */}
        <circle cx="0" cy="0" r="58" fill="none" stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.5" />
        {electrons > RING_1_CAPACITY && <circle cx="0" cy="0" r="78" fill="none" stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.4" />}

        {/* electrons, each ring gently rotating (paused under reduced motion) */}
        <g style={{ transformOrigin: "0px 0px", animation: reducedMotion ? "none" : "atom-ring-1-spin 18s linear infinite" }}>
          {Array.from({ length: ring1Count }).map((_, i) => {
            const angle = (i / RING_1_CAPACITY) * Math.PI * 2;
            const x = 58 * Math.cos(angle), y = 58 * Math.sin(angle);
            return (
              <g key={`e1-${i}`} transform={`translate(${x} ${y})`} className={highlightCharge ? "atom-highlight-pulse" : undefined}>
                <foreignObject x="-9" y="-9" width="18" height="18">
                  <Particle type="electron" size={18} showSymbol={false} />
                </foreignObject>
              </g>
            );
          })}
        </g>
        {ring2Count > 0 && (
          <g style={{ transformOrigin: "0px 0px", animation: reducedMotion ? "none" : "atom-ring-2-spin 26s linear infinite reverse" }}>
            {Array.from({ length: ring2Count }).map((_, i) => {
              const angle = (i / Math.max(1, ring2Count)) * Math.PI * 2;
              const x = 78 * Math.cos(angle), y = 78 * Math.sin(angle);
              return (
                <g key={`e2-${i}`} transform={`translate(${x} ${y})`} className={highlightCharge ? "atom-highlight-pulse" : undefined}>
                  <foreignObject x="-9" y="-9" width="18" height="18">
                    <Particle type="electron" size={18} showSymbol={false} />
                  </foreignObject>
                </g>
              );
            })}
          </g>
        )}

        {/* nucleus */}
        <g className={highlightZ || highlightA ? "atom-highlight-pulse" : undefined}>
          {nucleusItems.map((item) => (
            <foreignObject key={item.key} x={item.x - 11} y={item.y - 11} width="22" height="22">
              <Particle type={item.type} size={22} showSymbol={false} />
            </foreignObject>
          ))}
        </g>

        {protons === 0 && (
          <text x="0" y="4" textAnchor="middle" fontSize="9" fill="var(--color-ink-faint)">
            No nucleus yet
          </text>
        )}
      </svg>

      <style>{`
        @keyframes atom-ring-1-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes atom-ring-2-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes atom-highlight-pulse-kf { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 6px var(--color-indigo)); } }
        .atom-highlight-pulse { animation: atom-highlight-pulse-kf 700ms ease-in-out 1; }
      `}</style>
    </div>
  );
}
