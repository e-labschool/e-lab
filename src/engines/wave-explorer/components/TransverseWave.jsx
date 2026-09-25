import { useMemo } from "react";
import { transverseWavePoints, pointsToSvgPath, crestPositions } from "../lib/waveShape.js";
import { useWavePhase } from "../lib/useWavePhase.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

const WIDTH = 400;
const HEIGHT = 155;
const MID_Y = 75;
const OBSERVATION_X = 320;

export default function TransverseWave({ wavelengthNm, wavelengthPx, amplitudePx, paused, emphasize }) {
  const reducedMotion = useReducedMotion();
  const { phase, cycleCount } = useWavePhase({ wavelengthNm, paused: paused || reducedMotion });

  const points = useMemo(() => transverseWavePoints(WIDTH, amplitudePx, wavelengthPx, phase), [amplitudePx, wavelengthPx, phase]);
  const path = useMemo(() => pointsToSvgPath(points), [points]);

  const crests = useMemo(() => crestPositions(wavelengthPx, phase, WIDTH), [wavelengthPx, phase]);
  const amplitudeCrestX = crests.reduce((best, x) => (Math.abs(x - WIDTH * 0.22) < Math.abs(best - WIDTH * 0.22) ? x : best), crests[0] ?? WIDTH * 0.22);
  const troughX = amplitudeCrestX + wavelengthPx / 2;
  const wavelengthCrestA = crests.find((x, i) => crests[i + 1] !== undefined) ?? crests[0];
  const wavelengthCrestB = wavelengthCrestA !== undefined ? wavelengthCrestA + wavelengthPx : undefined;

  const observationY = MID_Y - amplitudePx * Math.sin(((2 * Math.PI) / wavelengthPx) * OBSERVATION_X - phase);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Transverse wave showing crest, trough, amplitude and wavelength">
        {/* equilibrium line kept as a subtle visual reference -- the
            "Equilibrium position" TEXT label was removed entirely, it
            was visually interfering with the wave and isn't needed for
            the amplitude/wavelength annotations to make sense on their own. */}
        <line x1="0" y1={MID_Y} x2={WIDTH} y2={MID_Y} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 4" />
        <path d={path} fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" transform={`translate(0 ${MID_Y})`} />

        {/* one labelled crest, one labelled trough -- subtle: small
            font, thin short leader line, not competing with the wave */}
        <text x={amplitudeCrestX} y={MID_Y - amplitudePx - 18} textAnchor="middle" fontSize="8.5" fontWeight="500" fill="var(--color-ink-faint)">Crest</text>
        <line x1={amplitudeCrestX} y1={MID_Y - amplitudePx - 14} x2={amplitudeCrestX} y2={MID_Y - amplitudePx - 4} stroke="var(--color-ink-faint)" strokeWidth="0.75" />
        <text x={troughX} y={MID_Y + amplitudePx + 19} textAnchor="middle" fontSize="8.5" fontWeight="500" fill="var(--color-ink-faint)">Trough</text>
        <line x1={troughX} y1={MID_Y + amplitudePx + 4} x2={troughX} y2={MID_Y + amplitudePx + 14} stroke="var(--color-ink-faint)" strokeWidth="0.75" />

        {/* amplitude: thin scientific dimension line, equilibrium to
            crest, SMALL arrowheads (the previous large filled
            triangles competed visually with the wave itself) */}
        {crests.length > 0 && (
          <g className={emphasize === "amplitude" ? "wave-emphasis" : undefined}>
            <line x1={amplitudeCrestX} y1={MID_Y} x2={amplitudeCrestX} y2={MID_Y - amplitudePx} stroke="var(--color-teal)" strokeWidth="1" markerStart="url(#wave-tick-teal)" markerEnd="url(#wave-tick-teal)" />
            <text x={amplitudeCrestX + 6} y={MID_Y - amplitudePx / 2} fontSize="10" fontWeight="700" fill="var(--color-teal)">A</text>
          </g>
        )}

        {/* wavelength: thin scientific dimension line, crest to crest,
            with small vertical guide ticks dropping to each crest so
            the measured span is unambiguous */}
        {wavelengthCrestA !== undefined && wavelengthCrestB !== undefined && (
          <g className={emphasize === "wavelength" ? "wave-emphasis" : undefined}>
            <line x1={wavelengthCrestA} y1={MID_Y - amplitudePx - 12} x2={wavelengthCrestA} y2={MID_Y - amplitudePx - 4} stroke="var(--color-violet)" strokeWidth="0.75" opacity="0.6" />
            <line x1={wavelengthCrestB} y1={MID_Y - amplitudePx - 12} x2={wavelengthCrestB} y2={MID_Y - amplitudePx - 4} stroke="var(--color-violet)" strokeWidth="0.75" opacity="0.6" />
            <line x1={wavelengthCrestA} y1={MID_Y - amplitudePx - 8} x2={wavelengthCrestB} y2={MID_Y - amplitudePx - 8} stroke="var(--color-violet)" strokeWidth="1" markerStart="url(#wave-tick-violet)" markerEnd="url(#wave-tick-violet)" />
            <text x={(wavelengthCrestA + wavelengthCrestB) / 2} y={MID_Y - amplitudePx - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-violet)">{"\u03BB"}</text>
          </g>
        )}

        {/* observation point -- kept because it's used meaningfully (a
            visible pulse each time a full cycle passes it, the
            frequency demonstration), now with a small explanatory
            label rather than an unexplained dot */}
        <g className={emphasize === "frequency" ? "wave-emphasis" : undefined}>
          <line x1={OBSERVATION_X} y1="8" x2={OBSERVATION_X} y2={HEIGHT - 8} stroke="var(--color-amber)" strokeWidth="1" strokeDasharray="2 3" opacity="0.55" />
          <circle cx={OBSERVATION_X} cy={observationY} r="5" fill="var(--color-amber)" key={cycleCount} className={reducedMotion || paused ? undefined : "wave-observation-pulse"} />
          <text x={OBSERVATION_X} y={HEIGHT - 2} textAnchor="middle" fontSize="8" fill="var(--color-amber)">Observation point</text>
        </g>

        <defs>
          <marker id="wave-tick-teal" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0.5,0.5 L4.5,4.5 M4.5,0.5 L0.5,4.5" stroke="var(--color-teal)" strokeWidth="0.9" /></marker>
          <marker id="wave-tick-violet" markerWidth="4" markerHeight="8" refX="2" refY="4" orient="auto"><path d="M0.5,0.5 L3.5,7.5" stroke="var(--color-violet)" strokeWidth="0.9" /></marker>
        </defs>
      </svg>
      <style>{`
        @keyframes wave-observation-pulse-kf { 0% { r: 5; opacity: 1; } 100% { r: 11; opacity: 0; } }
        .wave-observation-pulse { animation: wave-observation-pulse-kf 500ms ease-out 1; }
        @keyframes wave-emphasis-kf { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 4px currentColor); } }
        .wave-emphasis { animation: wave-emphasis-kf 700ms ease-in-out 2; }
      `}</style>
    </div>
  );
}
