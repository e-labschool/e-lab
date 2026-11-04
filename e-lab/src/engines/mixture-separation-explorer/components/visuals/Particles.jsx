// A reusable scatter of small solid particles (sand grains) within a
// bounding area -- drawn as slightly irregular rounded shapes (not
// perfect circles) so they read as grains rather than confetti dots.
// Used for particles suspended/settling in a mixture beaker, carried
// in the pour stream, and accumulating as residue on the filter paper.
// Layout generation lives in lib/particleLayout.js.
export default function Particles({ layout, visibleCount, color = "#C9A876", clipId }) {
  const shown = layout.slice(0, Math.round(visibleCount));
  return (
    <g clipPath={clipId ? `url(#${clipId})` : undefined}>
      {shown.map((p, i) => (
        <ellipse
          key={i}
          cx={p.x}
          cy={p.y}
          rx={p.r}
          ry={p.r * 0.75}
          fill={color}
          transform={`rotate(${(p.wobble ?? 0) * 30} ${p.x} ${p.y})`}
          opacity="0.92"
        />
      ))}
    </g>
  );
}
