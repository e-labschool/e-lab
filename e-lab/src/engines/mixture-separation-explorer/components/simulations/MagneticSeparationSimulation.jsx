import { useMemo } from "react";
import { mapRange } from "../../lib/simulationTimeline.js";
import Magnet from "../apparatus/Magnet.jsx";
import StepIndicator from "../StepIndicator.jsx";

const APPROACH = [0, 0.35];
const ATTRACT = [0.35, 0.8];
const FINAL = [0.8, 1];

const IRON_COLOR = "#5C6470";
const SAND_COLOR = "#C2996A";

const TRAY = { x: 190, y: 260, width: 300, height: 20 };
const MAGNET_START = { x: 400, y: 90 };
const MAGNET_END = { x: 400, y: 200 };
const MAGNET_TIP = { x: MAGNET_END.x, y: MAGNET_END.y + 11 }; // bottom edge of the magnet (its blue pole)

const STEPS = [
  { label: "Mixture", start: 0, end: APPROACH[0] },
  { label: "Magnet approaches", start: APPROACH[0], end: ATTRACT[0] },
  { label: "Iron attracted", start: ATTRACT[0], end: FINAL[0] },
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

export default function MagneticSeparationSimulation({ progress }) {
  const particles = useMemo(() => {
    const rand = seededRandom(377);
    const list = [];
    for (let i = 0; i < 34; i++) {
      list.push({
        kind: i % 2 === 0 ? "iron" : "sand",
        x: TRAY.x + 10 + rand() * (TRAY.width - 20),
        y: TRAY.y - 4 - rand() * 26,
        r: 1.3 + rand() * 1,
      });
    }
    return list;
  }, []);

  const approachProgress = mapRange(progress, ...APPROACH);
  const attractProgress = mapRange(progress, ...ATTRACT);
  const finalProgress = mapRange(progress, ...FINAL);

  const magnetX = MAGNET_START.x + (MAGNET_END.x - MAGNET_START.x) * approachProgress;
  const magnetY = MAGNET_START.y + (MAGNET_END.y - MAGNET_START.y) * approachProgress;
  const eased = attractProgress * attractProgress * (3 - 2 * attractProgress);

  const showFinalLabels = finalProgress > 0.3;

  return (
    <div>
      <svg viewBox="0 0 600 380" className="h-full w-full" role="img" aria-label="Magnetic separation: a magnet attracts iron filings out of a mixture with sand, leaving the sand behind">
        <rect x="0" y="0" width="600" height="380" fill="var(--color-paper)" />
        <rect x={TRAY.x} y={TRAY.y} width={TRAY.width} height={TRAY.height} rx="3" fill="var(--color-paper-raised)" stroke="var(--color-line)" strokeWidth="1.5" />
        <ellipse cx={TRAY.x + TRAY.width / 2} cy={TRAY.y + TRAY.height + 6} rx={TRAY.width * 0.42} ry="6" fill="rgba(20,25,35,0.05)" />

        {particles.map((p, i) => {
          // ONLY iron particles move, and only once the magnet is close
          // enough (approachProgress essentially complete) -- sand's
          // position is never touched by this calculation at all.
          const targetX = MAGNET_TIP.x + (i % 5) * 3 - 6;
          const targetY = MAGNET_TIP.y + Math.floor(i / 10) * 3;
          const x = p.kind === "iron" ? p.x + (targetX - p.x) * eased : p.x;
          const y = p.kind === "iron" ? p.y + (targetY - p.y) * eased : p.y;
          return <circle key={i} cx={x} cy={y} r={p.r} fill={p.kind === "iron" ? IRON_COLOR : SAND_COLOR} />;
        })}

        <Magnet x={magnetX} y={magnetY} />

        {showFinalLabels && (
          <g fontSize="13" fontWeight="600" fill="var(--color-ink)">
            <text x={TRAY.x} y={TRAY.y + 45} textAnchor="start">Sand (left behind)</text>
            <text x={MAGNET_TIP.x} y={MAGNET_TIP.y + 45} textAnchor="middle">Iron filings (attracted)</text>
          </g>
        )}
      </svg>
      <div className="mt-2 pb-1">
        <StepIndicator steps={STEPS} progress={progress} />
      </div>
    </div>
  );
}
