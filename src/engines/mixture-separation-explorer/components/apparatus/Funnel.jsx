// A glass filter funnel: a conical bowl narrowing into a stem, with a
// glass-gradient fill matching the Beaker's material so the whole scene
// reads as one consistent set of glassware.
export default function Funnel({ x, y, topWidth, coneHeight, stemHeight, settleProgress = 1 }) {
  const uid = "mse-funnel";
  const cx = x + topWidth / 2;
  // settleProgress: 0 = funnel above its resting position (still
  // "moving into place"), 1 = fully settled -- a small vertical offset
  // that eases to zero, used only during the setup phase.
  const dropOffset = (1 - settleProgress) * -14;

  return (
    <g transform={`translate(0, ${dropOffset})`} opacity={Math.max(0.15, settleProgress)}>
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(215,228,245,0.10)" />
          <stop offset="50%" stopColor="rgba(235,242,255,0.22)" />
          <stop offset="100%" stopColor="rgba(215,228,245,0.10)" />
        </linearGradient>
      </defs>
      <path
        d={`M ${x} ${y} L ${x + topWidth} ${y} L ${cx + 2.5} ${y + coneHeight} L ${cx + 2.5} ${y + coneHeight + stemHeight} L ${cx - 2.5} ${y + coneHeight + stemHeight} L ${cx - 2.5} ${y + coneHeight} Z`}
        fill={`url(#${uid}-glass)`}
        stroke="rgba(210,222,240,0.55)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <ellipse cx={cx} cy={y} rx={topWidth / 2} ry="2.5" fill="none" stroke="rgba(220,232,248,0.55)" strokeWidth="1.25" />
    </g>
  );
}
