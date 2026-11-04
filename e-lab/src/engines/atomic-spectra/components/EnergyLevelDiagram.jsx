import { hydrogenEnergyEv } from "../lib/hydrogenEnergy.js";

const LEVELS = [1, 2, 3, 4, 5, 6, Infinity];
const WIDTH = 260;
const TOP_Y = 14;
const BOTTOM_Y = 300;
const LINE_LEFT = 60;
const LINE_RIGHT = 220;

// Genuine linear energy->y mapping (never equal spacing) -- verified
// numerically before use: the n=1/n=2 gap is ~60x larger than the
// n=5/n=6 gap, correctly showing that hydrogen's levels converge
// toward the ionization limit, not spread evenly.
function energyToY(energyEv) {
  return TOP_Y + ((0 - energyEv) / 13.6) * (BOTTOM_Y - TOP_Y);
}

// The genuine convergence above is scientifically correct but means
// n=Infinity..4's TRUE positions are only a few pixels apart -- fine
// for the level LINES themselves (that closeness IS the physics), but
// their text LABELS would overlap into illegibility. This computes a
// separate set of LABEL y-positions with a minimum pixel gap enforced
// (working top-down, pushing each label down only as much as needed),
// while the lines themselves stay at their true, unadjusted positions
// -- a short leader line connects each label back to its real line
// whenever the two differ meaningfully.
const MIN_LABEL_GAP = 11;
function computeLabelPositions(levelsSortedByY) {
  const positions = [];
  let prevY = -Infinity;
  for (const { n, trueY } of levelsSortedByY) {
    const y = Math.max(trueY, prevY + MIN_LABEL_GAP);
    positions.push({ n, trueY, labelY: y });
    prevY = y;
  }
  return positions;
}

/** The energy-level ladder itself -- `markerLevel` (a number 1-6, or
 * null) draws the electron's current-state marker on that line;
 * `highlightFrom`/`highlightTo` draw a small ΔE bracket with a small
 * conventional arrowhead (never the oversized triangles from the
 * earlier Wave Explorer mistake) between two levels. */
export default function EnergyLevelDiagram({ markerLevel, highlightFrom, highlightTo, onSelectLevel, selectableLevels }) {
  const showBracket = highlightFrom != null && highlightTo != null;
  const yFrom = showBracket ? energyToY(hydrogenEnergyEv(highlightFrom)) : null;
  const yTo = showBracket ? energyToY(hydrogenEnergyEv(highlightTo)) : null;
  const isEmission = showBracket && highlightTo < highlightFrom;

  // computeLabelPositions requires ASCENDING Y (top of the diagram
  // first). LEVELS is ordered [1,2,...,Infinity] by n, but n=1 has the
  // LARGEST y (bottom of the diagram) and n=Infinity the smallest (top)
  // -- the reverse -- so this explicitly sorts by trueY first. (An
  // earlier version assumed LEVELS' own order already matched ascending
  // Y, which was wrong and caused labels to cascade downward from the
  // bottom instead of the top, overlapping n=1 and n=2.)
  const sortedByY = LEVELS.map((n) => ({ n, trueY: energyToY(hydrogenEnergyEv(n)) })).sort((a, b) => a.trueY - b.trueY);
  const labelPositions = computeLabelPositions(sortedByY);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${BOTTOM_Y + 20}`} className="h-full w-full" role="img" aria-label="Hydrogen energy level diagram, levels converging toward the ionization limit">
      <text x={LINE_LEFT} y="8" fontSize="7" fill="var(--color-ink-faint)">{"Energy \u2191"}</text>

      {labelPositions.map(({ n, trueY, labelY }) => {
        const E = hydrogenEnergyEv(n);
        const isSelectable = selectableLevels?.includes(n);
        const labelShifted = Math.abs(labelY - trueY) > 0.5;
        return (
          <g key={n}>
            <line
              x1={LINE_LEFT} y1={trueY} x2={LINE_RIGHT} y2={trueY}
              stroke={n === markerLevel ? "var(--color-indigo)" : "var(--color-line)"}
              strokeWidth={n === markerLevel ? 2 : 1.2}
              opacity={n === markerLevel ? 1 : 0.7}
              style={isSelectable ? { cursor: "pointer" } : undefined}
              onClick={isSelectable ? () => onSelectLevel(n) : undefined}
            />
            {labelShifted && (
              <line x1={LINE_LEFT - 3} y1={trueY} x2={LINE_LEFT - 3} y2={labelY} stroke="var(--color-ink-faint)" strokeWidth="0.5" opacity="0.5" />
            )}
            <text x={LINE_LEFT - 4} y={labelY + 2.5} textAnchor="end" fontSize="7.5" fontWeight="600" fill="var(--color-ink-soft)">
              {n === Infinity ? "n = \u221E" : `n = ${n}`}
            </text>
            <text x={LINE_RIGHT + 4} y={labelY + 2.5} fontSize="7" fill="var(--color-ink-faint)">
              {E.toFixed(n === Infinity ? 0 : 2)} eV
            </text>
          </g>
        );
      })}

      {markerLevel != null && (
        <circle cx={(LINE_LEFT + LINE_RIGHT) / 2} cy={energyToY(hydrogenEnergyEv(markerLevel))} r="4.5" fill="var(--color-indigo)" />
      )}

      {showBracket && (
        <g>
          <line x1={(LINE_LEFT + LINE_RIGHT) / 2 - 30} y1={yFrom} x2={(LINE_LEFT + LINE_RIGHT) / 2 - 30} y2={yTo}
            stroke="var(--color-amber)" strokeWidth="1.3"
            markerEnd={isEmission ? "url(#el-arrow-down)" : "url(#el-arrow-up)"} />
          <text x={(LINE_LEFT + LINE_RIGHT) / 2 - 34} y={(yFrom + yTo) / 2 + 2} textAnchor="end" fontSize="8" fontWeight="700" fill="var(--color-amber)">{"\u0394E"}</text>
        </g>
      )}

      <defs>
        <marker id="el-arrow-up" markerWidth="5" markerHeight="5" refX="2.5" refY="0.5" orient="auto"><path d="M0.5,4.5 L2.5,0.5 L4.5,4.5" fill="none" stroke="var(--color-amber)" strokeWidth="1" /></marker>
        <marker id="el-arrow-down" markerWidth="5" markerHeight="5" refX="2.5" refY="4.5" orient="auto"><path d="M0.5,0.5 L2.5,4.5 L4.5,0.5" fill="none" stroke="var(--color-amber)" strokeWidth="1" /></marker>
      </defs>
    </svg>
  );
}
