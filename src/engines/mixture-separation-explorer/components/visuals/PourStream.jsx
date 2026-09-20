// The animated stream connecting a tilted beaker's spout to the funnel
// below it -- a tapering path whose length/opacity is driven by
// `progress` (0-1, its own local sub-progress from mapRange), carrying
// a few particle dots along its length so the stream visibly contains
// both liquid and suspended sand, not just coloured water.
export default function PourStream({ fromX, fromY, toX, toY, progress, liquidColor, particleColor = "#C9A876" }) {
  if (progress <= 0) return null;

  // The stream "grows" from source to target as progress advances,
  // then stays fully formed while pouring continues.
  const grow = Math.min(1, progress * 2.5);
  const curX = fromX + (toX - fromX) * grow;
  const curY = fromY + (toY - fromY) * grow;
  const midX = (fromX + curX) / 2 + 3;
  const midY = (fromY + curY) / 2;

  const particleFractions = [0.2, 0.45, 0.7];

  return (
    <g opacity={Math.min(1, progress * 3)}>
      <path
        d={`M ${fromX - 2.5} ${fromY} Q ${midX} ${midY} ${curX - 1} ${curY} L ${curX + 1} ${curY} Q ${midX + 2} ${midY} ${fromX + 2.5} ${fromY} Z`}
        fill={liquidColor}
        opacity="0.55"
      />
      {particleFractions.map((f, i) => {
        const px = fromX + (curX - fromX) * f;
        const py = fromY + (curY - fromY) * f;
        return <circle key={i} cx={px} cy={py} r="1" fill={particleColor} />;
      })}
    </g>
  );
}
