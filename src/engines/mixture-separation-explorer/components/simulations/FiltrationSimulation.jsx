import { useMemo } from "react";
import { mapRange } from "../../lib/simulationTimeline.js";
import { makeParticleLayout } from "../../lib/particleLayout.js";
import Beaker from "../apparatus/Beaker.jsx";
import RetortStand from "../apparatus/RetortStand.jsx";
import Clamp from "../apparatus/Clamp.jsx";
import Funnel from "../apparatus/Funnel.jsx";
import FilterPaper from "../apparatus/FilterPaper.jsx";
import PourStream from "../visuals/PourStream.jsx";

// Phase windows as fractions of the shared timeline `progress`, exactly
// matching the brief's suggested sequence. Windows deliberately overlap
// (pouring and filtering both partly active at once) -- every value
// below is derived from `progress` via mapRange, never from a separate
// timer, so pause/replay/reset can never desync the apparatus from each
// other.
const SETUP = [0, 0.12];
const MIXTURE_ARRIVES = [0.12, 0.25];
const POURING = [0.25, 0.55];
const FILTERING = [0.4, 0.82];
const FINAL = [0.82, 1];

const TOTAL_SAND = 26;
const LIQUID_COLOR = "#8FB4E8";
const SAND_COLOR = "#C9A876";

// Scene layout (a fixed 700x400 viewBox -- nothing draggable, matching
// the brief's explicit "select -> observe", not PhET-style assembly).
const STAND_ROD_X = 430;
const STAND_BASE_Y = 340;
const STAND_ROD_HEIGHT = 230;
const CLAMP_Y = 150;
const FUNNEL_X = 395, FUNNEL_Y = 156, FUNNEL_TOP_W = 70, FUNNEL_CONE_H = 60, FUNNEL_STEM_H = 34;
const RECEIVING_BEAKER = { x: 385, y: 262, width: 90, height: 70 };
const MIXTURE_BEAKER_SIZE = { width: 76, height: 58 };
const MIXTURE_BEAKER_START = { x: 90, y: 210 };
const MIXTURE_BEAKER_POUR_POS = { x: 300, y: 130 };

export default function FiltrationSimulation({ progress }) {
  const sandLayoutBeaker = useMemo(() => makeParticleLayout(TOTAL_SAND, 501, { x: 6, y: MIXTURE_BEAKER_SIZE.height * 0.55, w: MIXTURE_BEAKER_SIZE.width - 12, h: MIXTURE_BEAKER_SIZE.height * 0.4 }), []);
  const sandLayoutResidue = useMemo(() => makeParticleLayout(TOTAL_SAND, 733, { x: FUNNEL_X + 6, y: FUNNEL_Y + 6, w: FUNNEL_TOP_W - 12, h: FUNNEL_CONE_H - 14 }), []);

  const setupProgress = mapRange(progress, ...SETUP);
  const mixtureArrival = mapRange(progress, ...MIXTURE_ARRIVES);
  const pourProgress = mapRange(progress, ...POURING);
  const filterProgress = mapRange(progress, ...FILTERING);
  const finalProgress = mapRange(progress, ...FINAL);

  // Beaker position: eases from its starting spot to its pour-ready
  // position during MIXTURE_ARRIVES, then stays put -- rotation is a
  // smooth "dip" (0 -> max -> 0) across the pouring window, so it tilts
  // in, holds while pouring, and returns upright, all from one formula.
  const arrivalEase = mixtureArrival * mixtureArrival * (3 - 2 * mixtureArrival); // smoothstep
  const beakerX = MIXTURE_BEAKER_START.x + (MIXTURE_BEAKER_POUR_POS.x - MIXTURE_BEAKER_START.x) * arrivalEase;
  const beakerY = MIXTURE_BEAKER_START.y + (MIXTURE_BEAKER_POUR_POS.y - MIXTURE_BEAKER_START.y) * arrivalEase;
  const tiltAngle = progress >= MIXTURE_ARRIVES[1] ? -62 * Math.sin(Math.PI * pourProgress) : 0;

  // Sand leaves the mixture beaker across the pouring window, arrives
  // as residue across the (later, overlapping) filtering window -- a
  // natural transport lag, both driven by the same total count so
  // atoms/grains are never created or destroyed.
  const sandRemainingInBeaker = Math.round(TOTAL_SAND * (1 - pourProgress));
  const sandOnFilterPaper = Math.round(TOTAL_SAND * filterProgress);

  const mixtureLiquidLevel = mixtureArrival > 0 ? 0.62 * (1 - pourProgress * 0.97) : 0;
  const filtrateLevel = 0.55 * filterProgress;

  const beakerSpoutX = beakerX + MIXTURE_BEAKER_SIZE.width * 0.85;
  const beakerSpoutY = beakerY + MIXTURE_BEAKER_SIZE.height * 0.15;
  const funnelRimX = FUNNEL_X + FUNNEL_TOP_W * 0.5;

  const showFinalLabels = finalProgress > 0.35;

  return (
    <svg viewBox="0 0 700 400" className="h-full w-full" role="img" aria-label="Filtration of sand and water: apparatus and a separated residue and filtrate at completion">
      <rect x="0" y="0" width="700" height="400" fill="var(--color-paper)" />
      <ellipse cx="350" cy="365" rx="320" ry="14" fill="rgba(20,25,35,0.05)" />

      <g opacity={setupProgress}>
        <RetortStand baseX={STAND_ROD_X} baseY={STAND_BASE_Y} rodHeight={STAND_ROD_HEIGHT} rodX={STAND_ROD_X} />
        <Clamp rodX={STAND_ROD_X} y={CLAMP_Y} jawReachX={funnelRimX + 4} />
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
          rotation={tiltAngle} pivotX={beakerX + MIXTURE_BEAKER_SIZE.width * 0.15} pivotY={beakerY + MIXTURE_BEAKER_SIZE.height}
          label={mixtureArrival >= 1 && pourProgress <= 0 ? "Mixture" : undefined}
        />
      )}

      {pourProgress > 0 && pourProgress < 1 && (
        <PourStream
          fromX={beakerSpoutX} fromY={beakerSpoutY + 8} toX={funnelRimX} toY={FUNNEL_Y - 2}
          progress={pourProgress < 0.15 ? mapRange(pourProgress, 0, 0.15) : pourProgress > 0.85 ? 1 - mapRange(pourProgress, 0.85, 1) : 1}
          liquidColor={LIQUID_COLOR} particleColor={SAND_COLOR}
        />
      )}

      {showFinalLabels && (
        <g fontSize="9.5" fontWeight="600" fill="var(--color-ink)">
          <line x1={FUNNEL_X + 14} y1={FUNNEL_Y + 30} x2={FUNNEL_X - 30} y2={FUNNEL_Y + 12} stroke="var(--color-ink-faint)" strokeWidth="0.75" />
          <text x={FUNNEL_X - 32} y={FUNNEL_Y + 10} textAnchor="end">{"Residue \u2014 sand"}</text>

          <line x1={FUNNEL_X + FUNNEL_TOP_W - 6} y1={FUNNEL_Y + 20} x2={FUNNEL_X + FUNNEL_TOP_W + 34} y2={FUNNEL_Y + 6} stroke="var(--color-ink-faint)" strokeWidth="0.75" />
          <text x={FUNNEL_X + FUNNEL_TOP_W + 36} y={FUNNEL_Y + 4}>Filter paper</text>

          <line x1={RECEIVING_BEAKER.x + RECEIVING_BEAKER.width + 2} y1={RECEIVING_BEAKER.y + 40} x2={RECEIVING_BEAKER.x + RECEIVING_BEAKER.width + 32} y2={RECEIVING_BEAKER.y + 55} stroke="var(--color-ink-faint)" strokeWidth="0.75" />
          <text x={RECEIVING_BEAKER.x + RECEIVING_BEAKER.width + 34} y={RECEIVING_BEAKER.y + 58}>{"Filtrate \u2014 water"}</text>
        </g>
      )}
    </svg>
  );
}
