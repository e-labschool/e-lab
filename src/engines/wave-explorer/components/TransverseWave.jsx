import { useMemo } from "react";
import { transverseWavePoints, pointsToSvgPath, crestPositions } from "../lib/waveShape.js";
import { useWavePhase } from "../lib/useWavePhase.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

const WIDTH = 400;
const HEIGHT = 200;
const MID_Y = 100;
const OBSERVATION_X = 320;

export default function TransverseWave({ wavelengthNm, wavelengthPx, amplitudePx, paused, emphasize }) {
  const reducedMotion = useReducedMotion();
  const { phase, cycleCount } = useWavePhase({ wavelengthNm, paused: paused || reducedMotion });

  const points = useMemo(() => transverseWavePoints(WIDTH, amplitudePx, wavelengthPx, phase), [amplitudePx, wavelengthPx, phase]);
  const path = useMemo(() => pointsToSvgPath(points), [points]);

  const crests = useMemo(() => crestPositions(wavelengthPx, phase, WIDTH), [wavelengthPx, phase]);
  // Amplitude arrow anchors to whichever crest is nearest the left
  // quarter of the view -- always a real crest, never a fixed x that
  // could drift out of alignment with the animated wave.
  const amplitudeCrestX = crests.reduce((best, x) => (Math.abs(x - WIDTH * 0.22) < Math.abs(best - WIDTH * 0.22) ? x : best), crests[0] ?? WIDTH * 0.22);
  // Wavelength arrow spans the first two consecutive crests fully
  // visible, so its length is always exactly one wavelength.
  const wavelengthCrestA = crests.find((x, i) => crests[i + 1] !== undefined) ?? crests[0];
  const wavelengthCrestB = wavelengthCrestA !== undefined ? wavelengthCrestA + wavelengthPx : undefined;

  // Observation point: the wave's y-value there, and a brief pulse
  // whenever a full cycle has just completed (cycleCount changed).
  const observationY = MID_Y - amplitudePx * Math.sin(((2 * Math.PI) / wavelengthPx) * OBSERVATION_X - phase);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Transverse wave showing crest, trough, amplitude and wavelength">
        <line x1="0" y1={MID_Y} x2={WIDTH} y2={MID_Y} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 4" />
        <path d={path} fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" transform={`translate(0 ${MID_Y})`} />

        {/* amplitude: vertical double-headed arrow, equilibrium to crest */}
        {crests.length > 0 && (
          <g className={emphasize === "amplitude" ? "wave-emphasis" : undefined}>
            <line x1={amplitudeCrestX} y1={MID_Y} x2={amplitudeCrestX} y2={MID_Y - amplitudePx} stroke="var(--color-teal)" strokeWidth="1.5" markerStart="url(#wave-arrow-teal)" markerEnd="url(#wave-arrow-teal)" />
            <text x={amplitudeCrestX + 6} y={MID_Y - amplitudePx / 2} fontSize="11" fontWeight="700" fill="var(--color-teal)">A</text>
          </g>
        )}

        {/* wavelength: horizontal double-headed arrow, crest to crest */}
        {wavelengthCrestA !== undefined && wavelengthCrestB !== undefined && (
          <g className={emphasize === "wavelength" ? "wave-emphasis" : undefined}>
            <line x1={wavelengthCrestA} y1={MID_Y - amplitudePx - 14} x2={wavelengthCrestB} y2={MID_Y - amplitudePx - 14} stroke="var(--color-violet)" strokeWidth="1.5" markerStart="url(#wave-arrow-violet)" markerEnd="url(#wave-arrow-violet)" />
            <text x={(wavelengthCrestA + wavelengthCrestB) / 2} y={MID_Y - amplitudePx - 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-violet)">{"\u03BB"}</text>
          </g>
        )}

        {/* observation point */}
        <g className={emphasize === "frequency" ? "wave-emphasis" : undefined}>
          <line x1={OBSERVATION_X} y1="10" x2={OBSERVATION_X} y2={HEIGHT - 10} stroke="var(--color-amber)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
          <circle cx={OBSERVATION_X} cy={observationY} r="5" fill="var(--color-amber)" key={cycleCount} className={reducedMotion || paused ? undefined : "wave-observation-pulse"} />
        </g>

        <defs>
          <marker id="wave-arrow-teal" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--color-teal)" /></marker>
          <marker id="wave-arrow-violet" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--color-violet)" /></marker>
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
