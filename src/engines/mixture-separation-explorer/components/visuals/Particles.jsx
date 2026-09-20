// A reusable scatter of small solid particles (sand grains) within a
// bounding area -- used for particles suspended in the mixture beaker,
// carried in the pour stream, and accumulating as residue on the
// filter paper. Layout generation lives in lib/particleLayout.js so
// this file only exports the component.
export default function Particles({ layout, visibleCount, color = "#C9A876", clipId }) {
  const shown = layout.slice(0, Math.round(visibleCount));
  return (
    <g clipPath={clipId ? `url(#${clipId})` : undefined}>
      {shown.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={color} />
      ))}
    </g>
  );
}
