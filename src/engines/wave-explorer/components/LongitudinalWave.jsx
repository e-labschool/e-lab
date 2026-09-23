import { useMemo } from "react";
import { restPositions, longitudinalDisplacement, compressionRarefactionCentres } from "../lib/waveShape.js";
import { useWavePhase } from "../lib/useWavePhase.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

const WIDTH = 400;
const HEIGHT = 150; // reduced ~25% from the previous 200 -- there is no
// need for much vertical room since particles only move horizontally;
// height now only needs to fit the compression/rarefaction labels
// above/below the particle line plus the wavelength arrow.
const MID_Y = 58; // the particle line, positioned to leave clearly
// unequal but deliberate space: less above (for the compression label)
// and more below (for the rarefaction label + wavelength arrow), so
// nothing is fighting for the same vertical band.
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
  // Label anchor positions follow the SAME displacement as the
  // particles there, so labels stay attached to the actual
  // bunched/spread region as the wave animates, never a fixed x.
  const compressionAnchorX = compressionX0 + longitudinalDisplacement(compressionX0, amplitudePx, wavelengthPx, phase);
  const rarefactionAnchorX = rarefactionX0 + longitudinalDisplacement(rarefactionX0, amplitudePx, wavelengthPx, phase);
  // The label TEXT is clamped to stay fully inside the viewBox (the
  // anchor can legitimately sit near x=0 or x=WIDTH at some phases,
  // which would otherwise clip a centred, ~60px-wide word off the
  // edge) -- the leader line still points at the TRUE anchor, so the
  // line goes slightly diagonal in that case rather than the label
  // itself becoming unreadable.
  const LABEL_MARGIN = 42; // >= half the widest label's measured width
  // ("Compression" measured at 76.4px wide, so needs >=38.2px of
  // clearance from each edge; 42 gives real margin, verified against
  // the actual rendered text bounding box, not guessed)
  const clampLabelX = (x) => Math.min(WIDTH - LABEL_MARGIN, Math.max(LABEL_MARGIN, x));
  const compressionLabelX = clampLabelX(compressionAnchorX);
  const rarefactionLabelX = clampLabelX(rarefactionAnchorX);

  const observationDisplacement = longitudinalDisplacement(OBSERVATION_X, amplitudePx, wavelengthPx, phase);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Longitudinal wave showing particles oscillating to form compressions and rarefactions">
        {actual.map((x, i) => (
          <circle key={i} cx={x} cy={MID_Y} r={PARTICLE_RADIUS} fill="var(--color-indigo)" opacity="0.85" />
        ))}

        {/* Compression label sits ABOVE the particle line, Rarefaction
            BELOW it -- opposite sides guarantee the two labels can
            never overlap regardless of how close their x-positions get
            (at a short wavelength they can be quite close), rather than
            relying on horizontal spacing alone. Each gets a short
            leader line down/up to the actual cluster it names. */}
        <g>
          <text x={compressionLabelX} y={MID_Y - 22} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--color-coral)">Compression</text>
          <line x1={compressionLabelX} y1={MID_Y - 17} x2={compressionAnchorX} y2={MID_Y - PARTICLE_RADIUS - 3} stroke="var(--color-coral)" strokeWidth="1" opacity="0.6" />
        </g>
        <g>
          <text x={rarefactionLabelX} y={MID_Y + 30} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--color-teal)">Rarefaction</text>
          <line x1={rarefactionAnchorX} y1={MID_Y + PARTICLE_RADIUS + 3} x2={rarefactionLabelX} y2={MID_Y + 22} stroke="var(--color-teal)" strokeWidth="1" opacity="0.6" />
        </g>

        {/* wavelength, compression-centre to compression-centre */}
        <g className={emphasize === "wavelength" ? "wave-emphasis" : undefined}>
          <line x1={compressionAnchorX} y1={HEIGHT - 20} x2={compressionAnchorX + wavelengthPx} y2={HEIGHT - 20} stroke="var(--color-violet)" strokeWidth="1.5" markerStart="url(#lw-arrow)" markerEnd="url(#lw-arrow)" />
          <text x={clampLabelX(compressionAnchorX + wavelengthPx / 2)} y={HEIGHT - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--color-violet)">{"\u03BB"}</text>
        </g>

        {/* observation point -- displacement of the particle nearest it */}
        <g className={emphasize === "frequency" ? "wave-emphasis" : undefined}>
          <line x1={OBSERVATION_X} y1="8" x2={OBSERVATION_X} y2={MID_Y - 8} stroke="var(--color-amber)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
          <circle cx={OBSERVATION_X + observationDisplacement} cy={MID_Y} r="6" fill="none" stroke="var(--color-amber)" strokeWidth="1.5" key={cycleCount} className={reducedMotion || paused ? undefined : "wave-observation-pulse"} />
        </g>

        <defs>
          <marker id="lw-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--color-violet)" /></marker>
        </defs>
      </svg>
    </div>
  );
}
