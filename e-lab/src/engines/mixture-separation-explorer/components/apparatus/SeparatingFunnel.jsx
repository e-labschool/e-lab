// A pear-shaped separating funnel: a bulbous glass body narrowing to a
// stem with a stopcock, matching the shared glass material used by
// Beaker/Funnel. Shows two liquid layers (lower/upper) by height
// fraction, and the stopcock as open/closed.
export default function SeparatingFunnel({ x, y, width, bodyHeight, stemHeight, lowerLevel, upperLevel, lowerColor, upperColor, stopcockOpen = false }) {
  const uid = "mse-sepfunnel";
  const cx = x + width / 2;
  const stemW = width * 0.09;
  const neckY = y + bodyHeight * 0.15;

  const bodyPath = `M ${cx} ${y} C ${x} ${y + bodyHeight * 0.08}, ${x} ${y + bodyHeight * 0.75}, ${cx - stemW} ${y + bodyHeight} L ${cx + stemW} ${y + bodyHeight} C ${x + width} ${y + bodyHeight * 0.75}, ${x + width} ${y + bodyHeight * 0.08}, ${cx} ${y} Z`;

  const totalLevel = Math.min(1, lowerLevel + upperLevel);
  const liquidTopY = y + bodyHeight - bodyHeight * 0.85 * totalLevel;
  const interfaceY = y + bodyHeight - bodyHeight * 0.85 * lowerLevel;

  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(150,175,205,0.26)" />
          <stop offset="12%" stopColor="rgba(255,255,255,0.48)" />
          <stop offset="50%" stopColor="rgba(190,208,232,0.08)" />
          <stop offset="88%" stopColor="rgba(210,225,245,0.18)" />
          <stop offset="100%" stopColor="rgba(140,165,195,0.28)" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={bodyPath} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}-clip)`}>
        {totalLevel > 0 && (
          <>
            {upperLevel > 0 && <rect x={x} y={liquidTopY} width={width} height={Math.max(0, interfaceY - liquidTopY)} fill={upperColor} opacity="0.5" />}
            {lowerLevel > 0 && <rect x={x} y={interfaceY} width={width} height={Math.max(0, y + bodyHeight - interfaceY)} fill={lowerColor} opacity="0.55" />}
            {upperLevel > 0 && lowerLevel > 0 && <line x1={x} y1={interfaceY} x2={x + width} y2={interfaceY} stroke="rgba(20,30,45,0.18)" strokeWidth="1" />}
          </>
        )}
      </g>

      <path d={bodyPath} fill={`url(#${uid}-glass)`} stroke="rgba(200,218,240,0.55)" strokeWidth="1.25" strokeLinejoin="round" />
      <ellipse cx={cx} cy={y + 1} rx={stemW * 1.6} ry="2" fill="none" stroke="rgba(220,235,250,0.6)" strokeWidth="1.25" />
      <path d={`M ${x + width * 0.16} ${neckY} C ${x + width * 0.08} ${y + bodyHeight * 0.35}, ${x + width * 0.1} ${y + bodyHeight * 0.65}, ${x + width * 0.2} ${y + bodyHeight * 0.85}`} stroke="rgba(255,255,255,0.4)" strokeWidth={width * 0.03} strokeLinecap="round" fill="none" opacity="0.7" />

      {/* stem + stopcock */}
      <rect x={cx - stemW} y={y + bodyHeight} width={stemW * 2} height={stemHeight} fill="rgba(200,218,240,0.25)" stroke="rgba(200,218,240,0.5)" strokeWidth="1" />
      <rect x={cx - stemW * 2.2} y={y + bodyHeight + stemHeight * 0.35} width={stemW * 4.4} height={stemHeight * 0.3} rx="2" fill={stopcockOpen ? "var(--color-teal)" : "#8A929E"} transform={stopcockOpen ? `rotate(90 ${cx} ${y + bodyHeight + stemHeight * 0.5})` : undefined} />
    </g>
  );
}
