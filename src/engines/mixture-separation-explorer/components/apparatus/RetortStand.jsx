// A simple retort stand: a heavy base and a vertical support rod, drawn
// with a subtle metallic gradient. Positioned by its base's centre-x
// and the top-y of the rod.
export default function RetortStand({ baseX, baseY, rodHeight, rodX }) {
  const uid = "mse-stand";
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8A929E" />
          <stop offset="45%" stopColor="#C4CAD3" />
          <stop offset="100%" stopColor="#767E8A" />
        </linearGradient>
      </defs>
      <rect x={baseX - 55} y={baseY} width="110" height="7" rx="2" fill={`url(#${uid}-metal)`} />
      <rect x={rodX - 2.5} y={baseY - rodHeight} width="5" height={rodHeight + 4} rx="2" fill={`url(#${uid}-metal)`} />
    </g>
  );
}
