// A glass filter funnel read as a genuine CONE with depth: a wide rim
// ellipse, a near-wall/far-wall shading split (the far inner wall
// visible through the glass, darker/more compressed than the near
// wall), a narrowing stem, and a glass-edge highlight -- matching
// Beaker's material so the whole scene reads as one consistent set of
// glassware.
export default function Funnel({ x, y, topWidth, coneHeight, stemHeight, settleProgress = 1 }) {
  const uid = "mse-funnel";
  const cx = x + topWidth / 2;
  const rimRy = topWidth * 0.13;
  const dropOffset = (1 - settleProgress) * -16;
  const stemW = topWidth * 0.06;

  return (
    <g transform={`translate(0, ${dropOffset})`} opacity={Math.max(0.15, settleProgress)}>
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(150,175,205,0.28)" />
          <stop offset="12%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="45%" stopColor="rgba(190,208,232,0.10)" />
          <stop offset="88%" stopColor="rgba(210,225,245,0.18)" />
          <stop offset="100%" stopColor="rgba(140,165,195,0.30)" />
        </linearGradient>
        <linearGradient id={`${uid}-inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(120,145,180,0.22)" />
          <stop offset="100%" stopColor="rgba(120,145,180,0.06)" />
        </linearGradient>
      </defs>

      {/* outer cone body */}
      <path
        d={`M ${x} ${y} L ${cx + stemW} ${y + coneHeight} L ${cx + stemW} ${y + coneHeight + stemHeight} L ${cx - stemW} ${y + coneHeight + stemHeight} L ${cx - stemW} ${y + coneHeight} L ${x + topWidth} ${y} Z`}
        fill={`url(#${uid}-glass)`}
        stroke="rgba(200,218,240,0.55)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* the visible far inner wall, receding away -- gives the cone
          genuine depth rather than reading as a flat triangle */}
      <path
        d={`M ${x + topWidth * 0.14} ${y + rimRy * 0.6} L ${cx} ${y + coneHeight * 0.94} L ${x + topWidth * 0.86} ${y + rimRy * 0.6}`}
        fill="none"
        stroke="rgba(150,175,205,0.28)"
        strokeWidth="1"
      />
      <path d={`M ${x + topWidth * 0.14} ${y + rimRy * 0.6} L ${cx} ${y + coneHeight * 0.94} L ${x + topWidth * 0.5} ${y + rimRy * 1.6} Z`} fill={`url(#${uid}-inner)`} opacity="0.5" />

      <ellipse cx={cx} cy={y} rx={topWidth / 2} ry={rimRy} fill="none" stroke="rgba(220,235,250,0.65)" strokeWidth="1.5" />
      <ellipse cx={cx} cy={y} rx={topWidth * 0.42} ry={rimRy * 0.75} fill="rgba(230,240,252,0.12)" />

      {/* glass-edge highlight along one side of the cone */}
      <path d={`M ${x + topWidth * 0.18} ${y + rimRy * 0.5} L ${cx - stemW * 0.6} ${y + coneHeight * 0.85}`} stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}
