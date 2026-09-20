// A boss-head clamp attached to the stand's rod at a given height,
// holding whatever apparatus sits at (jawX, jawY).
export default function Clamp({ rodX, y, jawReachX }) {
  return (
    <g>
      <rect x={rodX - 6} y={y - 4} width="12" height="8" rx="1.5" fill="#767E8A" />
      <rect x={rodX} y={y - 2.5} width={jawReachX - rodX} height="5" rx="1.5" fill="#9BA3AE" />
      <rect x={jawReachX - 4} y={y - 6} width="8" height="12" rx="1.5" fill="#5E6570" />
    </g>
  );
}
