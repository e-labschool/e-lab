import { mapRange } from "../../lib/simulationTimeline.js";
import { getBeakerAnchors } from "../../lib/geometry.js";
import SeparatingFunnel from "../apparatus/SeparatingFunnel.jsx";
import RetortStand from "../apparatus/RetortStand.jsx";
import Clamp from "../apparatus/Clamp.jsx";
import Beaker from "../apparatus/Beaker.jsx";
import PourStream from "../visuals/PourStream.jsx";
import StepIndicator from "../StepIndicator.jsx";

const SETTLE = [0, 0.3];
const DRAIN = [0.3, 0.78];
const FINAL = [0.85, 1];

const WATER_COLOR = "#6F9FE0";
const OIL_COLOR = "#E8C463";

const FUNNEL = { x: 300, y: 90, width: 130, bodyHeight: 150, stemHeight: 46 };
const RECEIVER = { x: 320, y: 320, width: 95, height: 80 };

const INITIAL_LOWER = 0.42; // water
const INITIAL_UPPER = 0.4; // oil

const STEPS = [
  { label: "Layers settle", start: 0, end: SETTLE[1] },
  { label: "Drain lower layer", start: SETTLE[1], end: DRAIN[1] },
  { label: "Separated", start: DRAIN[1], end: 1.01 },
];

export default function SeparatingFunnelSimulation({ progress }) {
  const settleProgress = mapRange(progress, ...SETTLE);
  const drainProgress = mapRange(progress, ...DRAIN);
  const finalProgress = mapRange(progress, ...FINAL);

  // The lower (denser, water) layer drains while the upper (oil) layer
  // stays completely unchanged -- this is what guarantees "the lower
  // layer leaves first", not merely a label claiming it.
  const lowerLevel = INITIAL_LOWER * settleProgress * (1 - drainProgress);
  const upperLevel = INITIAL_UPPER * settleProgress;
  const stopcockOpen = drainProgress > 0 && drainProgress < 1;

  const stemEnd = { x: FUNNEL.x + FUNNEL.width / 2, y: FUNNEL.y + FUNNEL.bodyHeight + FUNNEL.stemHeight };
  const receiverAnchors = getBeakerAnchors({ x: RECEIVER.x, y: RECEIVER.y, width: RECEIVER.width, height: RECEIVER.height });
  const receivedLevel = 0.55 * drainProgress;

  const streamVisibility = drainProgress <= 0 || drainProgress >= 1 ? 0 : drainProgress < 0.15 ? mapRange(drainProgress, 0, 0.15) : drainProgress > 0.85 ? 1 - mapRange(drainProgress, 0.85, 1) : 1;
  const showFinalLabels = finalProgress > 0.3;

  return (
    <div>
      <svg viewBox="0 0 640 440" className="h-full w-full" role="img" aria-label="Separating funnel: oil and water settle into layers, then the denser lower layer is drained">
        <rect x="0" y="0" width="640" height="440" fill="var(--color-paper)" />
        <ellipse cx="330" cy="400" rx="270" ry="14" fill="rgba(20,25,35,0.06)" />

        <RetortStand baseX={200} baseY={400} rodHeight={300} rodX={200} />
        <Clamp rodX={200} y={130} jawReachX={FUNNEL.x + 8} />

        <SeparatingFunnel
          x={FUNNEL.x} y={FUNNEL.y} width={FUNNEL.width} bodyHeight={FUNNEL.bodyHeight} stemHeight={FUNNEL.stemHeight}
          lowerLevel={lowerLevel} upperLevel={upperLevel}
          lowerColor={WATER_COLOR} upperColor={OIL_COLOR}
          stopcockOpen={stopcockOpen}
        />

        <Beaker x={RECEIVER.x} y={RECEIVER.y} width={RECEIVER.width} height={RECEIVER.height} liquidLevel={receivedLevel} liquidColor={WATER_COLOR} label={showFinalLabels ? "Water (drained)" : undefined} />

        {streamVisibility > 0 && (
          <PourStream fromX={stemEnd.x} fromY={stemEnd.y} toX={receiverAnchors.lip.x} toY={receiverAnchors.lip.y - 30} progress={streamVisibility} liquidColor={WATER_COLOR} particleColor={WATER_COLOR} />
        )}

        {showFinalLabels && (
          <g fontSize="13" fontWeight="600" fill="var(--color-ink)">
            <line x1={FUNNEL.x + FUNNEL.width * 0.5} y1={FUNNEL.y + 20} x2={FUNNEL.x + FUNNEL.width + 30} y2={FUNNEL.y + 5} stroke="var(--color-ink-faint)" strokeWidth="1" />
            <text x={FUNNEL.x + FUNNEL.width + 32} y={FUNNEL.y + 3}>Oil (upper layer, remains)</text>
          </g>
        )}
      </svg>
      <div className="mt-2 pb-1">
        <StepIndicator steps={STEPS} progress={progress} />
      </div>
    </div>
  );
}
