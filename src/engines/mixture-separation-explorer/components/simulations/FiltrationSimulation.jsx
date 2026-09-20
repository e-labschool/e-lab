import { useMemo } from "react";
import { mapRange } from "../../lib/simulationTimeline.js";
import { makeParticleLayout } from "../../lib/particleLayout.js";
import { getBeakerAnchors, getFunnelAnchors } from "../../lib/geometry.js";
import Beaker from "../apparatus/Beaker.jsx";
import RetortStand from "../apparatus/RetortStand.jsx";
import Clamp from "../apparatus/Clamp.jsx";
import Funnel from "../apparatus/Funnel.jsx";
import FilterPaper from "../apparatus/FilterPaper.jsx";
import PourStream from "../visuals/PourStream.jsx";
import StepIndicator from "../StepIndicator.jsx";

// Phase windows as fractions of the shared timeline `progress` --
// deliberately overlapping (pouring and filtering both partly active
// at once), each read independently via mapRange, never a single
// discrete phase enum.
const SETUP = [0, 0.12];
const MIXTURE_ARRIVES = [0.12, 0.25];
const POURING = [0.25, 0.55];
const FILTERING = [0.4, 0.82];
const FINAL = [0.82, 1];

const TOTAL_SAND = 30;
const LIQUID_COLOR = "#8FB4E8";
const SAND_COLOR = "#C2996A";

// Scene layout -- a 760x460 viewBox, with the apparatus itself sized to
// occupy most of it (per the explicit 70-85% coverage requirement),
// not a small diagram in a large empty canvas.
const STAND_ROD_X = 470;
const STAND_BASE_Y = 400;
const STAND_ROD_HEIGHT = 290;
const CLAMP_Y = 175;
const FUNNEL_X = 415, FUNNEL_Y = 182, FUNNEL_TOP_W = 108, FUNNEL_CONE_H = 88, FUNNEL_STEM_H = 46;
const RECEIVING_BEAKER = { x: 400, y: 322, width: 130, height: 96 };
const MIXTURE_BEAKER_SIZE = { width: 106, height: 80 };
const MIXTURE_BEAKER_START = { x: 60, y: 250 };
const MIXTURE_BEAKER_POUR_POS = { x: 290, y: 150 };
// Pivot on the SAME side as the pour lip (near the base, right side) --
// verified numerically before use: this is what makes rotation swing
// the lip DOWN AND TOWARD the funnel rather than away from it. The
// earlier version of this file had the pivot on the opposite side,
// which was the root cause of the reported misalignment.
const BEAKER_PIVOT_OFFSET_X = MIXTURE_BEAKER_SIZE.width * 0.85;
const MAX_TILT_DEGREES = 62;

const STEPS = [
  { label: "Setup", start: 0, end: MIXTURE_ARRIVES[0] },
  { label: "Pour mixture", start: MIXTURE_ARRIVES[0], end: POURING[1] },
  { label: "Filtration", start: POURING[1], end: FINAL[0] },
  { label: "Separated", start: FINAL[0], end: 1.01 },
];

export default function FiltrationSimulation({ progress }) {
  const sandLayoutBeaker = useMemo(
    () => makeParticleLayout(TOTAL_SAND, 501, { x: 8, y: MIXTURE_BEAKER_SIZE.height * 0.25, w: MIXTURE_BEAKER_SIZE.width - 16, h: MIXTURE_BEAKER_SIZE.height * 0.7 }, { settleBias: 0.7 }),
    []
  );
  const sandLayoutResidue = useMemo(
    () => makeParticleLayout(TOTAL_SAND, 733, { x: FUNNEL_X + 10, y: FUNNEL_Y + 10, w: FUNNEL_TOP_W - 20, h: FUNNEL_CONE_H - 22 }),
    []
  );

  const setupProgress = mapRange(progress, ...SETUP);
  const mixtureArrival = mapRange(progress, ...MIXTURE_ARRIVES);
  const pourProgress = mapRange(progress, ...POURING);
  const filterProgress = mapRange(progress, ...FILTERING);
  const finalProgress = mapRange(progress, ...FINAL);

  const arrivalEase = mixtureArrival * mixtureArrival * (3 - 2 * mixtureArrival); // smoothstep
  const beakerX = MIXTURE_BEAKER_START.x + (MIXTURE_BEAKER_POUR_POS.x - MIXTURE_BEAKER_START.x) * arrivalEase;
  const beakerY = MIXTURE_BEAKER_START.y + (MIXTURE_BEAKER_POUR_POS.y - MIXTURE_BEAKER_START.y) * arrivalEase;
  // A smooth "dip" (0 -> max -> 0) across the pouring window: tilts in,
  // holds while pouring, returns upright -- from one formula, no
  // separate sub-phase bookkeeping needed.
  const tiltAngle = progress >= MIXTURE_ARRIVES[1] ? MAX_TILT_DEGREES * Math.sin(Math.PI * pourProgress) : 0;

  const pivotX = beakerX + BEAKER_PIVOT_OFFSET_X;
  const pivotY = beakerY + MIXTURE_BEAKER_SIZE.height;
  const beakerAnchors = useMemo(
    () => getBeakerAnchors({ x: beakerX, y: beakerY, width: MIXTURE_BEAKER_SIZE.width, height: MIXTURE_BEAKER_SIZE.height, rotation: tiltAngle, pivotX, pivotY }),
    [beakerX, beakerY, tiltAngle, pivotX, pivotY]
  );
  const funnelAnchors = useMemo(() => getFunnelAnchors({ x: FUNNEL_X, y: FUNNEL_Y, topWidth: FUNNEL_TOP_W, coneHeight: FUNNEL_CONE_H, stemHeight: FUNNEL_STEM_H }), []);

  // Sand leaves the mixture beaker across the pouring window, arrives
  // as residue across the later, overlapping filtering window -- a
  // natural transport lag, both derived from the same total count so
  // grains are never created or destroyed (verified: paper count never
  // exceeds what has left the beaker by more than the transient
  // "in the stream" amount, and both converge to TOTAL_SAND by the end).
  const sandRemainingInBeaker = Math.round(TOTAL_SAND * (1 - pourProgress));
  const sandOnFilterPaper = Math.round(TOTAL_SAND * filterProgress);

  const mixtureLiquidLevel = mixtureArrival > 0 ? 0.6 * (1 - pourProgress * 0.97) : 0;
  const filtrateLevel = 0.5 * filterProgress;

  const showFinalLabels = finalProgress > 0.3;

  // The pour stream ramps in, holds fully formed, then ramps out across
  // the pouring window -- and its two endpoints are ALWAYS the real
  // computed anchors (beaker lip, funnel opening), never a separately
  // guessed coordinate, which is what guarantees the stream visibly
  // enters the funnel regardless of the beaker's exact position/tilt.
  const streamVisibility = pourProgress <= 0 || pourProgress >= 1 ? 0 : pourProgress < 0.15 ? mapRange(pourProgress, 0, 0.15) : pourProgress > 0.85 ? 1 - mapRange(pourProgress, 0.85, 1) : 1;

  return (
    <div>
      <svg viewBox="0 0 760 460" className="h-full w-full" role="img" aria-label="Filtration of sand and water: apparatus and a separated residue and filtrate at completion">
        <defs>
          <linearGradient id="mse-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-paper-raised)" />
            <stop offset="100%" stopColor="var(--color-paper)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="760" height="460" fill="url(#mse-bg)" />
        <ellipse cx="390" cy="420" rx="340" ry="16" fill="rgba(20,25,35,0.06)" />

        <g opacity={setupProgress}>
          <RetortStand baseX={STAND_ROD_X} baseY={STAND_BASE_Y} rodHeight={STAND_ROD_HEIGHT} rodX={STAND_ROD_X} />
          <Clamp rodX={STAND_ROD_X} y={CLAMP_Y} jawReachX={funnelAnchors.opening.x + 6} />
        </g>

        {setupProgress > 0.15 && (
          <Beaker
            x={RECEIVING_BEAKER.x} y={RECEIVING_BEAKER.y} width={RECEIVING_BEAKER.width} height={RECEIVING_BEAKER.height}
            liquidLevel={filtrateLevel} liquidColor={LIQUID_COLOR}
            label={showFinalLabels ? "Filtrate" : undefined}
          />
        )}

        {setupProgress > 0.3 && (
          <>
            <Funnel x={FUNNEL_X} y={FUNNEL_Y} topWidth={FUNNEL_TOP_W} coneHeight={FUNNEL_CONE_H} stemHeight={FUNNEL_STEM_H} settleProgress={Math.min(1, setupProgress * 1.6)} />
            <FilterPaper x={FUNNEL_X} y={FUNNEL_Y} topWidth={FUNNEL_TOP_W} coneHeight={FUNNEL_CONE_H} residueLayout={sandLayoutResidue} residueCount={sandOnFilterPaper} />
          </>
        )}

        {mixtureArrival > 0 && (
          <Beaker
            x={beakerX} y={beakerY} width={MIXTURE_BEAKER_SIZE.width} height={MIXTURE_BEAKER_SIZE.height}
            liquidLevel={mixtureLiquidLevel} liquidColor={LIQUID_COLOR}
            particleLayout={sandLayoutBeaker} particleCount={sandRemainingInBeaker} particleColor={SAND_COLOR}
            turbidity={sandRemainingInBeaker > 2 ? 0.6 : 0}
            rotation={tiltAngle} pivotX={pivotX} pivotY={pivotY}
            label={mixtureArrival >= 1 && pourProgress <= 0 ? "Sand + water" : undefined}
          />
        )}

        {streamVisibility > 0 && (
          <PourStream
            fromX={beakerAnchors.lip.x} fromY={beakerAnchors.lip.y}
            toX={funnelAnchors.opening.x} toY={funnelAnchors.opening.y}
            progress={streamVisibility}
            liquidColor={LIQUID_COLOR} particleColor={SAND_COLOR}
          />
        )}

        {showFinalLabels && (
          <g fontSize="13" fontWeight="600" fill="var(--color-ink)">
            <line x1={FUNNEL_X + 20} y1={FUNNEL_Y + 45} x2={FUNNEL_X - 40} y2={FUNNEL_Y + 20} stroke="var(--color-ink-faint)" strokeWidth="1" />
            <text x={FUNNEL_X - 42} y={FUNNEL_Y + 16} textAnchor="end">{"Residue \u2014 sand"}</text>

            <line x1={FUNNEL_X + FUNNEL_TOP_W - 10} y1={FUNNEL_Y + 30} x2={FUNNEL_X + FUNNEL_TOP_W + 46} y2={FUNNEL_Y + 8} stroke="var(--color-ink-faint)" strokeWidth="1" />
            <text x={FUNNEL_X + FUNNEL_TOP_W + 48} y={FUNNEL_Y + 6}>Filter paper</text>

            <line x1={RECEIVING_BEAKER.x + RECEIVING_BEAKER.width + 4} y1={RECEIVING_BEAKER.y + 55} x2={RECEIVING_BEAKER.x + RECEIVING_BEAKER.width + 42} y2={RECEIVING_BEAKER.y + 74} stroke="var(--color-ink-faint)" strokeWidth="1" />
            <text x={RECEIVING_BEAKER.x + RECEIVING_BEAKER.width + 44} y={RECEIVING_BEAKER.y + 78}>{"Filtrate \u2014 water"}</text>
          </g>
        )}
      </svg>
      <div className="mt-2 pb-1">
        <StepIndicator steps={STEPS} progress={progress} />
      </div>
    </div>
  );
}
