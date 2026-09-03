// A compact schematic periodic table (group/period grid, not all 118
// elements) with specific cells highlighted and labelled — used for
// "identify the alkali metal / halogen / noble gas / d-block" style
// questions without needing every element rendered.
const GROUPS = 18;
const PERIODS = 4; // enough to show s, p, and first-row d-block context
const CELL = 16;

// Simplified block layout: s-block (groups 1-2), d-block (groups 3-12, periods 4+),
// p-block (groups 13-18), matching real periodic table shape at small scale.
function isOccupied(period, group) {
  if (group <= 2) return true; // s-block
  if (group >= 13) return true; // p-block
  if (period >= 4 && group >= 3 && group <= 12) return true; // d-block from period 4
  return false;
}

export default function PeriodicTableHighlight({ highlights = [] }) {
  const W = GROUPS * CELL + 10, H = PERIODS * CELL + 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md text-[var(--color-ink)]" role="img" aria-label="Periodic table with highlighted positions">
      {Array.from({ length: PERIODS }, (_, pIdx) => {
        const period = pIdx + 1;
        return Array.from({ length: GROUPS }, (_, gIdx) => {
          const group = gIdx + 1;
          if (!isOccupied(period, group)) return null;
          const x = 5 + gIdx * CELL, y = 5 + pIdx * CELL;
          const hit = highlights.find((h) => h.period === period && h.group === group);
          return (
            <g key={`${period}-${group}`}>
              <rect x={x} y={y} width={CELL - 1} height={CELL - 1} fill={hit ? "var(--color-amber-soft)" : "none"} stroke="currentColor" strokeWidth="0.5" opacity={hit ? 1 : 0.5} />
              {hit && <text x={x + CELL / 2} y={y + CELL / 2 + 3} fontSize="8" textAnchor="middle" fill="var(--color-amber)" fontWeight="700">{hit.label}</text>}
            </g>
          );
        });
      })}
    </svg>
  );
}
