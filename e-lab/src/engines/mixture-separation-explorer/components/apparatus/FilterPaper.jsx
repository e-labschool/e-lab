import Particles from "../visuals/Particles.jsx";

// Filter paper folded into a cone inside the funnel -- textured with
// faint fold lines, and accumulating residue (sand) on its inner
// surface as `residueLayout`/`residueCount` grow over the simulation.
export default function FilterPaper({ x, y, topWidth, coneHeight, residueLayout, residueCount = 0 }) {
  const uid = "mse-filter";
  const cx = x + topWidth / 2;
  const paperTopWidth = topWidth * 0.92;
  const px = cx - paperTopWidth / 2;

  return (
    <g opacity="0.94">
      <defs>
        <clipPath id={`${uid}-clip`}>
          <path d={`M ${px} ${y + 1} L ${px + paperTopWidth} ${y + 1} L ${cx} ${y + coneHeight - 2} Z`} />
        </clipPath>
      </defs>
      <path
        d={`M ${px} ${y + 1} L ${px + paperTopWidth} ${y + 1} L ${cx} ${y + coneHeight - 2} Z`}
        fill="#F7F4EC"
        stroke="#E4DFCF"
        strokeWidth="0.75"
      />
      {[0.25, 0.45, 0.65].map((f) => (
        <line key={f} x1={px + paperTopWidth * f} y1={y + 1} x2={cx} y2={y + coneHeight - 2} stroke="#E7E2D2" strokeWidth="0.6" opacity="0.7" />
      ))}
      {residueLayout && residueCount > 0 && (
        <Particles layout={residueLayout} visibleCount={residueCount} color="#C9A876" clipId={`${uid}-clip`} />
      )}
    </g>
  );
}
