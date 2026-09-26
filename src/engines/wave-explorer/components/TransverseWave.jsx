import { useMemo } from "react";
import { transverseWavePoints, pointsToSvgPath, crestPositions } from "../lib/waveShape.js";
import { useWavePhase } from "../lib/useWavePhase.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

const WIDTH = 400;
const HEIGHT = 175;
const MID_Y = 95; // equilibrium line, with generous room above for the
// wavelength arrow + crest label, and below for the trough label
const OBSERVATION_X = 320;

/** Annotation anchors are deliberately spread apart, verified
 * numerically before use (25px+ separation even at the shortest
 * wavelength): amplitude uses the FIRST of the two measured crests,
 * the Crest label uses the SECOND (a full wavelength away), and the
 * Trough label uses the trough BETWEEN them -- so no two annotations
 * ever compete for the same region, regardless of the current
 * wavelength. */
export default function TransverseWave({ wavelengthNm, wavelengthPx, amplitudePx, paused, emphasize }) {
  const reducedMotion = useReducedMotion();
  const { phase, cycleCount } = useWavePhase({ wavelengthNm, paused: paused || reducedMotion });

  const points = useMemo(() => transverseWavePoints(WIDTH, amplitudePx, wavelengthPx, phase), [amplitudePx, wavelengthPx, phase]);
  const path = useMemo(() => pointsToSvgPath(points), [points]);

  const crests = useMemo(() => crestPositions(wavelengthPx, phase, WIDTH), [wavelengthPx, phase]);
  const crestA = crests.find((x, i) => crests[i + 1] !== undefined) ?? crests[0] ?? WIDTH * 0.18;
  const crestB = crestA + wavelengthPx; // exactly one wavelength from crestA
  const troughX = crestA + wavelengthPx / 2; // the trough BETWEEN the two measured crests

  const observationY = MID_Y - amplitudePx * Math.sin(((2 * Math.PI) / wavelengthPx) * OBSERVATION_X - phase);

  const WAVELENGTH_ARROW_Y = 22;
  const WAVELENGTH_LABEL_Y = 12;
  const CREST_LABEL_Y = WAVELENGTH_ARROW_Y + 14; // clear gap below the wavelength arrow, not stacked on it

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Transverse wave showing crest, trough, equilibrium, amplitude and wavelength, each labelled in its own region">
        <line x1="0" y1={MID_Y} x2={WIDTH} y2={MID_Y} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 4" />
        <path d={path} fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" transform={`translate(0 ${MID_Y})`} />

        {/* Wavelength: high above the wave, crest-to-crest, small ticks */}
        <g className={emphasize === "wavelength" ? "wave-emphasis" : undefined}>
          <line x1={crestA} y1={WAVELENGTH_ARROW_Y + 6} x2={crestA} y2={WAVELENGTH_ARROW_Y - 3} stroke="var(--color-violet)" strokeWidth="0.75" opacity="0.6" />
          <line x1={crestB} y1={WAVELENGTH_ARROW_Y + 6} x2={crestB} y2={WAVELENGTH_ARROW_Y - 3} stroke="var(--color-violet)" strokeWidth="0.75" opacity="0.6" />
          <line x1={crestA} y1={WAVELENGTH_ARROW_Y} x2={crestB} y2={WAVELENGTH_ARROW_Y} stroke="var(--color-violet)" strokeWidth="1" markerStart="url(#wave-tick-violet)" markerEnd="url(#wave-tick-violet)" />
          <text x={(crestA + crestB) / 2} y={WAVELENGTH_LABEL_Y} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--color-violet)">{"Wavelength (\u03BB)"}</text>
        </g>

        {/* Crest: only the SECOND measured crest, well below the
            wavelength label so it never crowds it */}
        <g>
          <circle cx={crestB} cy={MID_Y - amplitudePx} r="2" fill="var(--color-ink)" />
          <line x1={crestB} y1={MID_Y - amplitudePx} x2={crestB + 14} y2={CREST_LABEL_Y + 2} stroke="var(--color-ink-faint)" strokeWidth="0.75" />
          <text x={crestB + 17} y={CREST_LABEL_Y + 4} fontSize="9" fontWeight="600" fill="var(--color-ink-soft)">Crest</text>
        </g>

        {/* Amplitude: equilibrium to the FIRST measured crest, label to the SIDE */}
        <g className={emphasize === "amplitude" ? "wave-emphasis" : undefined}>
          <line x1={crestA} y1={MID_Y} x2={crestA} y2={MID_Y - amplitudePx} stroke="var(--color-teal)" strokeWidth="1" markerStart="url(#wave-tick-teal)" markerEnd="url(#wave-tick-teal)" />
          <text x={crestA - 8} y={MID_Y - amplitudePx / 2 - 4} textAnchor="end" fontSize="9" fontWeight="700" fill="var(--color-teal)">Amplitude</text>
          <text x={crestA - 8} y={MID_Y - amplitudePx / 2 + 6} textAnchor="end" fontSize="9" fontWeight="700" fill="var(--color-teal)">(A)</text>
        </g>

        {/* Trough: the trough BETWEEN the two measured crests -- always
            spatially separate from the amplitude label (different
            crest/side) and the Crest label (different vertical band). */}
        <g>
          <circle cx={troughX} cy={MID_Y + amplitudePx} r="2" fill="var(--color-ink)" />
          <line x1={troughX} y1={MID_Y + amplitudePx} x2={troughX} y2={MID_Y + amplitudePx + 16} stroke="var(--color-ink-faint)" strokeWidth="0.75" />
          <text x={troughX} y={MID_Y + amplitudePx + 26} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--color-ink-soft)">Trough</text>
        </g>

        {/* Observation point: isolated on the right, far from the
            wavelength/amplitude/crest/trough cluster */}
        <g className={emphasize === "frequency" ? "wave-emphasis" : undefined}>
          <line x1={OBSERVATION_X} y1="6" x2={OBSERVATION_X} y2={HEIGHT - 6} stroke="var(--color-amber)" strokeWidth="1" strokeDasharray="2 3" opacity="0.55" />
          <circle cx={OBSERVATION_X} cy={observationY} r="5" fill="var(--color-amber)" key={cycleCount} className={reducedMotion || paused ? undefined : "wave-observation-pulse"} />
          <text x={OBSERVATION_X + 8} y={HEIGHT - 16} fontSize="8.5" fontWeight="600" fill="var(--color-amber)">Observation</text>
          <text x={OBSERVATION_X + 8} y={HEIGHT - 6} fontSize="8.5" fontWeight="600" fill="var(--color-amber)">point</text>
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
