import { useMemo } from "react";
import { mapRange } from "../../lib/simulationTimeline.js";
import Sieve from "../apparatus/Sieve.jsx";
import StepIndicator from "../StepIndicator.jsx";

const SETTLE_ON_SIEVE = [0, 0.15];
const SIEVING = [0.15, 0.75];
const FINAL = [0.8, 1];

const SMALL_COLOR = "#C2996A";
const LARGE_COLOR = "#8A6D45";

const SIEVE = { x: 170, y: 190, width: 260 };
const MESH_Y = SIEVE.y + 4;
const TRAY_Y = 300;

const STEPS = [
  { label: "Mixture on sieve", start: 0, end: SETTLE_ON_SIEVE[1] },
  { label: "Sieving", start: SETTLE_ON_SIEVE[0], end: SIEVING[1] },
  { label: "Separated", start: SIEVING[1], end: 1.01 },
];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function SievingSimulation({ progress }) {
  const particles = useMemo(() => {
    const rand = seededRandom(619);
    const list = [];
    for (let i = 0; i < 24; i++) {
      const small = i % 2 === 0;
      list.push({
        small,
        x: SIEVE.x + 12 + rand() * (SIEVE.width - 24),
        startY: SIEVE.y - 6 - rand() * 40,
        settledAboveY: MESH_Y - (small ? 2 : 5) - rand() * 4,
        throughY: TRAY_Y - 6 - rand() * 22,
        r: small ? 1.6 + rand() * 0.8 : 3.6 + rand() * 1.4,
      });
    }
    return list;
  }, []);

  const settleProgress = mapRange(progress, ...SETTLE_ON_SIEVE);
  const settleEased = settleProgress * settleProgress * (3 - 2 * settleProgress);
  const sievingProgress = mapRange(progress, ...SIEVING);
  const sievingEased = sievingProgress * sievingProgress * (3 - 2 * sievingProgress);
  const finalProgress = mapRange(progress, ...FINAL);
  const showFinalLabels = finalProgress > 0.3;

  return (
    <div>
      <svg viewBox="0 0 600 380" className="h-full w-full" role="img" aria-label="Sieving: smaller particles pass through the mesh, larger particles are retained on top">
        <rect x="0" y="0" width="600" height="380" fill="var(--color-paper)" />
        <rect x={SIEVE.x + 20} y={TRAY_Y} width={SIEVE.width - 40} height="40" rx="4" fill="var(--color-paper-raised)" stroke="var(--color-line)" strokeWidth="1.5" />

        {particles.map((p, i) => {
          // Only SMALL particles ever reach `throughY` (below the mesh);
          // large particles interpolate only as far as `settledAboveY`
          // (resting ON the mesh) and never move further, regardless of
          // how long sieving continues.
          const restingY = p.startY + (p.settledAboveY - p.startY) * settleEased;
          const y = p.small ? restingY + (p.throughY - restingY) * sievingEased : restingY;
          return <circle key={i} cx={p.x} cy={y} r={p.r} fill={p.small ? SMALL_COLOR : LARGE_COLOR} />;
        })}

        <Sieve x={SIEVE.x} y={SIEVE.y} width={SIEVE.width} meshY={MESH_Y} />

        {showFinalLabels && (
          <g fontSize="13" fontWeight="600" fill="var(--color-ink)">
            <text x={SIEVE.x + SIEVE.width / 2} y={SIEVE.y - 20} textAnchor="middle">Larger particles retained</text>
            <text x={SIEVE.x + SIEVE.width / 2} y={TRAY_Y + 55} textAnchor="middle">Smaller particles collected</text>
          </g>
        )}
      </svg>
      <div className="mt-2 pb-1">
        <StepIndicator steps={STEPS} progress={progress} />
      </div>
    </div>
  );
}
