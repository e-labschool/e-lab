import { useMemo } from "react";
import { mapRange } from "../../lib/simulationTimeline.js";
import { getBeakerAnchors } from "../../lib/geometry.js";
import Beaker from "../apparatus/Beaker.jsx";
import PourStream from "../visuals/PourStream.jsx";
import StepIndicator from "../StepIndicator.jsx";

const SETTLING = [0, 0.45];
const TILT_POUR = [0.45, 0.85];
const FINAL = [0.85, 1];

const TOTAL_PARTICLES = 26;
const LIQUID_COLOR = "#B79A6B";
const PARTICLE_COLOR = "#8A6D45";

const SOURCE = { x: 260, y: 150, width: 120, height: 130 };
const RECEIVER = { x: 470, y: 260, width: 120, height: 90 };
const PIVOT_OFFSET_X = SOURCE.width * 0.85;
const MAX_TILT = 58;

const STEPS = [
  { label: "Suspension", start: 0, end: SETTLING[1] },
  { label: "Settling", start: SETTLING[0], end: TILT_POUR[0] },
  { label: "Decant", start: TILT_POUR[0], end: FINAL[0] },
  { label: "Separated", start: FINAL[0], end: 1.01 },
];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function SedimentationSimulation({ progress }) {
  // Each particle has BOTH a dispersed (initial) and settled (final)
  // position -- interpolated live by settlingProgress, so particles
  // genuinely move downward over time rather than swapping between two
  // static layouts.
  const particles = useMemo(() => {
    const rand = seededRandom(911);
    const list = [];
    const innerX = SOURCE.width * 0.08;
    const innerW = SOURCE.width * 0.84;
    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      list.push({
        x: innerX + rand() * innerW,
        dispersedY: SOURCE.height * 0.15 + rand() * SOURCE.height * 0.65,
        settledY: SOURCE.height * 0.78 + rand() * SOURCE.height * 0.16,
        r: 1.2 + rand() * 1,
        wobble: rand() * 6.28,
      });
    }
    return list;
  }, []);

  const settlingProgress = mapRange(progress, ...SETTLING);
  const eased = settlingProgress * settlingProgress * (3 - 2 * settlingProgress);
  const tiltProgress = mapRange(progress, ...TILT_POUR);
  const finalProgress = mapRange(progress, ...FINAL);

  const tiltAngle = MAX_TILT * Math.sin(Math.PI * Math.min(1, tiltProgress * 1.15));
  const pivotX = SOURCE.x + PIVOT_OFFSET_X;
  const pivotY = SOURCE.y + SOURCE.height;
  const sourceAnchors = getBeakerAnchors({ x: SOURCE.x, y: SOURCE.y, width: SOURCE.width, height: SOURCE.height, rotation: tiltAngle, pivotX, pivotY });
  const receiverAnchors = getBeakerAnchors({ x: RECEIVER.x, y: RECEIVER.y, width: RECEIVER.width, height: RECEIVER.height });

  const sourceLevel = 0.72 * (1 - tiltProgress * 0.75);
  const receivedLevel = 0.55 * tiltProgress;
  const showFinalLabels = finalProgress > 0.3;

  const streamVisibility = tiltProgress <= 0 || tiltProgress >= 1 ? 0 : tiltProgress < 0.2 ? mapRange(tiltProgress, 0, 0.2) : tiltProgress > 0.8 ? 1 - mapRange(tiltProgress, 0.8, 1) : 1;

  return (
    <div>
      <svg viewBox="0 0 680 420" className="h-full w-full" role="img" aria-label="Sedimentation and decantation of a suspension: particles settle, then the clear liquid is poured off">
        <rect x="0" y="0" width="680" height="420" fill="var(--color-paper)" />
        <ellipse cx="380" cy="380" rx="290" ry="14" fill="rgba(20,25,35,0.06)" />

        <Beaker x={RECEIVER.x} y={RECEIVER.y} width={RECEIVER.width} height={RECEIVER.height} liquidLevel={receivedLevel} liquidColor={LIQUID_COLOR} label={showFinalLabels ? "Supernatant" : undefined} />

        <Beaker
          x={SOURCE.x} y={SOURCE.y} width={SOURCE.width} height={SOURCE.height}
          liquidLevel={sourceLevel} liquidColor={LIQUID_COLOR}
          turbidity={settlingProgress < 0.6 ? 0.5 : 0.1}
          rotation={tiltAngle} pivotX={pivotX} pivotY={pivotY}
          label={settlingProgress < 0.1 && !tiltAngle ? "Suspension" : showFinalLabels ? "Sediment" : undefined}
        />
        {/* particles rendered in the SAME rotated frame as the source beaker, at their live-interpolated settling position */}
        <g transform={tiltAngle ? `rotate(${tiltAngle} ${pivotX} ${pivotY})` : undefined}>
          {particles.map((p, i) => {
            const y = p.dispersedY + (p.settledY - p.dispersedY) * eased;
            return (
              <ellipse
                key={i}
                cx={SOURCE.x + p.x} cy={SOURCE.y + y}
                rx={p.r} ry={p.r * 0.8}
                fill={PARTICLE_COLOR}
                transform={`rotate(${p.wobble * 30} ${SOURCE.x + p.x} ${SOURCE.y + y})`}
                opacity="0.9"
              />
            );
          })}
        </g>

        {streamVisibility > 0 && (
          <PourStream fromX={sourceAnchors.lip.x} fromY={sourceAnchors.lip.y} toX={receiverAnchors.lip.x} toY={receiverAnchors.lip.y - 40} progress={streamVisibility} liquidColor={LIQUID_COLOR} particleColor={PARTICLE_COLOR} />
        )}

        {showFinalLabels && (
          <g fontSize="13" fontWeight="600" fill="var(--color-ink)">
            <line x1={SOURCE.x + SOURCE.width * 0.5} y1={SOURCE.y + SOURCE.height * 0.85} x2={SOURCE.x - 30} y2={SOURCE.y + SOURCE.height + 10} stroke="var(--color-ink-faint)" strokeWidth="1" />
            <text x={SOURCE.x - 32} y={SOURCE.y + SOURCE.height + 14} textAnchor="end">Sediment</text>
          </g>
        )}
      </svg>
      <div className="mt-2 pb-1">
        <StepIndicator steps={STEPS} progress={progress} />
      </div>
    </div>
  );
}
