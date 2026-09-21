import { useMemo } from "react";
import { mapRange } from "../../lib/simulationTimeline.js";
import { makeParticleLayout } from "../../lib/particleLayout.js";
import { resolveAnchor } from "../separation-engine/assetConfig.js";
import SeparationStage from "../separation-engine/SeparationStage.jsx";
import LiquidLayer from "../separation-engine/LiquidLayer.jsx";
import ParticleLayer from "../separation-engine/ParticleLayer.jsx";
import StreamLayer from "../separation-engine/StreamLayer.jsx";
import LabelLayer from "../separation-engine/LabelLayer.jsx";
import StepIndicator from "../StepIndicator.jsx";
import { RETORT_STAND, CLAMP, FUNNEL, FILTER_PAPER, RECEIVING_BEAKER, mixtureBeakerConfig, MIXTURE_BEAKER_START, MIXTURE_BEAKER_POUR_POS, MAX_TILT_DEGREES } from "../../data/filtrationAssetConfig.js";

// Phase windows matching the brief's requested sequence (0-15% setup,
// 15-30% position/tilt-in, 30-70% pour+filter, 70-88% drain, 88-100%
// final) -- deliberately overlapping where the real process overlaps,
// each read independently via mapRange, never a single phase enum.
const SETUP = [0, 0.15];
const POSITION = [0.15, 0.3];
const POUR_FILTER = [0.3, 0.7];
const DRAIN = [0.7, 0.88];
const FINAL = [0.88, 1];

const TOTAL_SAND = 30;
const LIQUID_COLOR = "#8FB4E8";
const SAND_COLOR = "#C2996A";

const STEPS = [
  { label: "Setup", start: 0, end: SETUP[1] },
  { label: "Position", start: SETUP[1], end: POSITION[1] },
  { label: "Pour & filter", start: POSITION[1], end: DRAIN[0] },
  { label: "Drain", start: DRAIN[0], end: FINAL[0] },
  { label: "Separated", start: FINAL[0], end: 1.01 },
];

export default function FiltrationSimulationAssets({ progress }) {
  const setupProgress = mapRange(progress, ...SETUP);
  const positionProgress = mapRange(progress, ...POSITION);
  const finalProgress = mapRange(progress, ...FINAL);

  const arrivalEase = positionProgress * positionProgress * (3 - 2 * positionProgress);
  const beakerX = MIXTURE_BEAKER_START.x + (MIXTURE_BEAKER_POUR_POS.x - MIXTURE_BEAKER_START.x) * arrivalEase;
  const beakerY = MIXTURE_BEAKER_START.y + (MIXTURE_BEAKER_POUR_POS.y - MIXTURE_BEAKER_START.y) * arrivalEase;
  // A smooth "dip" (0 -> max -> 0) across the pour+filter window's
  // FIRST portion (pouring itself finishes well before filtering does,
  // since filtering continues after the beaker returns upright) --
  // pourSubProgress isolates just the tilt-relevant part.
  const pourSubProgress = mapRange(progress, POSITION[1], POSITION[1] + (POUR_FILTER[1] - POSITION[1]) * 0.55);
  const tiltAngle = progress >= POSITION[1] ? MAX_TILT_DEGREES * Math.sin(Math.PI * Math.min(1, pourSubProgress)) : 0;

  const mixtureBeaker = useMemo(() => mixtureBeakerConfig({ x: beakerX, y: beakerY, rotation: tiltAngle }), [beakerX, beakerY, tiltAngle]);

  const beakerLip = useMemo(() => resolveAnchor(mixtureBeaker, "lip"), [mixtureBeaker]);
  const funnelOpening = useMemo(() => resolveAnchor(FUNNEL, "opening"), []);
  const funnelStemEnd = useMemo(() => resolveAnchor(FUNNEL, "stemEnd"), []);
  const receiverInterior = useMemo(() => {
    const tl = resolveAnchor(RECEIVING_BEAKER, "interiorTopLeft");
    const br = resolveAnchor(RECEIVING_BEAKER, "interiorBottomRight");
    return { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  }, []);
  const sourceInterior = useMemo(() => {
    const tl = resolveAnchor(mixtureBeaker, "interiorTopLeft");
    const br = resolveAnchor(mixtureBeaker, "interiorBottomRight");
    return { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  }, [mixtureBeaker]);

  // Material conservation: sand leaves the source beaker across the
  // pour window, arrives as residue with a natural transport lag across
  // the (later, overlapping) filter window -- both derived from the
  // SAME total so grains are never invented or lost. Liquid levels
  // follow the same pour->drain relationship.
  const pourEase = mapRange(progress, POSITION[1], POSITION[1] + (POUR_FILTER[1] - POSITION[1]) * 0.6);
  const filterEase = mapRange(progress, POSITION[1] + (POUR_FILTER[1] - POSITION[1]) * 0.25, DRAIN[1]);
  const sandRemainingInSource = Math.round(TOTAL_SAND * (1 - pourEase));
  const sandOnFilterPaper = Math.round(TOTAL_SAND * filterEase);

  const sourceLiquidLevel = positionProgress > 0 ? 0.62 * (1 - pourEase * 0.97) : 0;
  const filtrateLevel = 0.55 * filterEase;

  const sandLayoutSource = useMemo(
    () => makeParticleLayout(TOTAL_SAND, 501, { x: 8, y: 14, w: 80, h: 78 }, { settleBias: 0.7 }),
    []
  );
  const sandLayoutResidue = useMemo(() => makeParticleLayout(TOTAL_SAND, 733, { x: 18, y: 16, w: 64, h: 66 }, {}), []);

  const streamVisibility = pourEase <= 0 || pourEase >= 1 ? 0 : pourEase < 0.15 ? mapRange(pourEase, 0, 0.15) : pourEase > 0.85 ? 1 - mapRange(pourEase, 0.85, 1) : 1;
  const showFinalLabels = finalProgress > 0.3;

  const assets = [
    { ...RETORT_STAND, opacity: setupProgress },
    { ...CLAMP, opacity: setupProgress },
    { ...FUNNEL, opacity: Math.min(1, setupProgress * 1.4) },
    { ...FILTER_PAPER, opacity: Math.min(1, setupProgress * 1.4) },
    { ...RECEIVING_BEAKER, opacity: Math.min(1, setupProgress * 1.6) },
    ...(positionProgress > 0 ? [mixtureBeaker] : []),
  ];

  // A scaled-down interior region matching where the filter paper's
  // cone actually sits, so accumulating residue reads as "on the
  // paper" rather than floating over the whole funnel.
  const residueRegion = { x: 46, y: 24, width: 10, height: 12 };

  return (
    <div>
      <SeparationStage
        ariaLabel="Filtration of sand and water: apparatus with a source beaker, funnel, filter paper and receiving beaker"
        assets={assets}
        overlay={
          <>
            {sourceLiquidLevel > 0 && <LiquidLayer interior={sourceInterior} level={sourceLiquidLevel} color={LIQUID_COLOR} turbidity={sandRemainingInSource > 2 ? 0.6 : 0} clipId="mse-source-liquid" />}
            {sandRemainingInSource > 0 && positionProgress > 0 && <ParticleLayer layout={sandLayoutSource} visibleCount={sandRemainingInSource} color={SAND_COLOR} clipId="mse-source-particles" />}
            {filtrateLevel > 0 && <LiquidLayer interior={receiverInterior} level={filtrateLevel} color={LIQUID_COLOR} clipId="mse-receiver-liquid" />}
            {sandOnFilterPaper > 0 && <ParticleLayer layout={sandLayoutResidue.map((p) => ({ ...p, x: residueRegion.x + (p.x / 100) * residueRegion.width, y: residueRegion.y + (p.y / 100) * residueRegion.height }))} visibleCount={sandOnFilterPaper} color={SAND_COLOR} />}
            {streamVisibility > 0 && beakerLip && funnelOpening && <StreamLayer from={beakerLip} to={funnelOpening} progress={streamVisibility} liquidColor={LIQUID_COLOR} particleColor={SAND_COLOR} />}
            {showFinalLabels && funnelOpening && funnelStemEnd && (
              <LabelLayer
                labels={[
                  { from: { x: residueRegion.x + residueRegion.width / 2, y: residueRegion.y + residueRegion.height * 0.6 }, textPos: { x: 30, y: 20 }, text: "Residue \u2014 sand", anchor: "end" },
                  { from: funnelOpening, textPos: { x: 62, y: 20 }, text: "Filter paper", anchor: "start" },
                  { from: { x: receiverInterior.x + receiverInterior.width / 2, y: receiverInterior.y + receiverInterior.height * 0.5 }, textPos: { x: 62, y: 55 }, text: "Filtrate \u2014 water", anchor: "start" },
                ]}
              />
            )}
          </>
        }
      />
      <div className="mt-2 pb-1">
        <StepIndicator steps={STEPS} progress={progress} />
      </div>
      <p className="mt-1 text-center text-[10px] text-[var(--color-ink-faint)]">
        Apparatus artwork shown here is a placeholder for integration testing, not final art.
      </p>
    </div>
  );
}
