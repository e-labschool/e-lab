// One flexible graph component covering every "how do these two variables
// relate" question in this batch: mass vs moles, absorbance vs
// concentration (calibration), P vs V, V vs T, P vs T. A straight line
// through the data for "linear" relationships, a smooth inverse curve for
// "inverse" ones (e.g. P vs V) — never labelled with a named gas law, per
// the brief; only axes, points, and the shape of the relationship.
const W = 300;
const H = 200;
const PAD_L = 44;
const PAD_B = 30;
const PAD_T = 14;
const PAD_R = 14;

export default function ProportionalityGraph({ points, xLabel = "", yLabel = "", relationship = "linear", highlightPoint }) {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const allPoints = highlightPoint ? [...points, highlightPoint] : points;
  const maxX = Math.max(...allPoints.map((p) => p.x), 1);
  const maxY = Math.max(...allPoints.map((p) => p.y), 1);
  const xFor = (x) => PAD_L + (x / maxX) * plotW;
  const yFor = (v) => H - PAD_B - (v / maxY) * plotH;

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const path = sorted.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.x)} ${yFor(p.y)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs text-[var(--color-ink)]" role="img" aria-label={`Graph of ${yLabel} against ${xLabel}`}>
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.5" />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.5" />

      {relationship !== "points" && <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {points.map((p, i) => (
        <circle key={i} cx={xFor(p.x)} cy={yFor(p.y)} r="2.5" fill="currentColor" />
      ))}
      {highlightPoint && (
        <g>
          <circle cx={xFor(highlightPoint.x)} cy={yFor(highlightPoint.y)} r="3.5" fill="none" stroke="var(--color-amber)" strokeWidth="1.75" />
          <line x1={PAD_L} y1={yFor(highlightPoint.y)} x2={xFor(highlightPoint.x)} y2={yFor(highlightPoint.y)} stroke="var(--color-amber)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1={xFor(highlightPoint.x)} y1={yFor(highlightPoint.y)} x2={xFor(highlightPoint.x)} y2={H - PAD_B} stroke="var(--color-amber)" strokeWidth="1" strokeDasharray="2 2" />
          {highlightPoint.label && <text x={xFor(highlightPoint.x)} y={yFor(highlightPoint.y) - 8} fontSize="8" textAnchor="middle" fill="var(--color-amber)">{highlightPoint.label}</text>}
        </g>
      )}

      <text x={(PAD_L + W - PAD_R) / 2} y={H - 2} fontSize="9" textAnchor="middle" fill="currentColor">{xLabel}</text>
      <text x={10} y={PAD_T + plotH / 2} fontSize="9" textAnchor="middle" fill="currentColor" transform={`rotate(-90 10 ${PAD_T + plotH / 2})`}>{yLabel}</text>
    </svg>
  );
}
