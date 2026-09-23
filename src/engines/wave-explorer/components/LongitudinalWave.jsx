import { useMemo } from "react";
import { restPositions, longitudinalDisplacement, compressionRarefactionCentres } from "../lib/waveShape.js";
import { useWavePhase } from "../lib/useWavePhase.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

const WIDTH = 400;
const HEIGHT = 200;
const MID_Y = 100;
const PARTICLE_COUNT = 34;
const PARTICLE_RADIUS = 4.5;
const OBSERVATION_X = 320;

export default function LongitudinalWave({ wavelengthNm, wavelengthPx, amplitudePx, paused, emphasize }) {
  const reducedMotion = useReducedMotion();
  const { phase, cycleCount } = useWavePhase({ wavelengthNm, paused: paused || reducedMotion });

  const rest = useMemo(() => restPositions(PARTICLE_COUNT, WIDTH), []);
  const actual = useMemo(
    () => rest.map((x0) => x0 + longitudinalDisplacement(x0, amplitudePx, wavelengthPx, phase)),
    [rest, amplitudePx, wavelengthPx, phase]
  );

  const { compressionX0, rarefactionX0 } = useMemo(() => compressionRarefactionCentres(wavelengthPx, phase), [wavelengthPx, phase]);
  // Label positions follow the SAME displacement as the particles there,
  // so the "Compression"/"Rarefaction" text stays attached to the actual
  // bunched/spread region as the wave animates, not a fixed x.
  const compressionLabelX = compressionX0 + longitudinalDisplacement(compressionX0, amplitudePx, wavelengthPx, phase);
  const rarefactionLabelX = rarefactionX0 + longitudinalDisplacement(rarefactionX0, amplitudePx, wavelengthPx, phase);

  const observationDisplacement = longitudinalDisplacement(OBSERVATION_X, amplitudePx, wavelengthPx, phase);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Longitudinal wave showing particles oscillating to form compressions and rarefactions">
        {actual.map((x, i) => (
          <circle key={i} cx={x} cy={MID_Y} r={PARTICLE_RADIUS} fill="var(--color-indigo)" opacity="0.85" />
        ))}

        <g className={emphasize === "wavelength" ? "wave-emphasis" : undefined}>
          <line x1={compressionLabelX} y1={MID_Y + 30} x2={compressionLabelX + wavelengthPx} y2={MID_Y + 30} stroke="var(--color-violet)" strokeWidth="1.5" markerStart="url(#lw-arrow)" markerEnd="url(#lw-arrow)" />
          <text x={compressionLabelX + wavelengthPx / 2} y={MID_Y + 44} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-violet)">{"\u03BB"}</text>
        </g>

        <text x={compressionLabelX} y={MID_Y - 24} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-coral)">Compression</text>
        <text x={rarefactionLabelX} y={MID_Y - 24} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-teal)">Rarefaction</text>

        {/* observation point -- displacement of the particle nearest it */}
        <g className={emphasize === "frequency" ? "wave-emphasis" : undefined}>
          <line x1={OBSERVATION_X} y1="20" x2={OBSERVATION_X} y2={HEIGHT - 20} stroke="var(--color-amber)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
          <circle cx={OBSERVATION_X + observationDisplacement} cy={MID_Y} r="6" fill="none" stroke="var(--color-amber)" strokeWidth="1.5" key={cycleCount} className={reducedMotion || paused ? undefined : "wave-observation-pulse"} />
        </g>

        <defs>
          <marker id="lw-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--color-violet)" /></marker>
        </defs>
      </svg>
    </div>
  );
}
