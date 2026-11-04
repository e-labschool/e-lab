// A simple glass-beaker outline — rounded bottom, slightly flared top,
// subtle fill for the "liquid", matching the transparent-glass look used
// elsewhere in e-Lab's interactives without pulling in a new asset.
export default function BeakerShape({ bounds, label }) {
  const { x, y, w, h } = bounds;
  const r = 14;
  return (
    <g>
      <path
        d={`M ${x} ${y} L ${x} ${y + h - r} Q ${x} ${y + h} ${x + r} ${y + h} L ${x + w - r} ${y + h} Q ${x + w} ${y + h} ${x + w} ${y + h - r} L ${x + w} ${y}`}
        fill="rgba(120,150,220,0.06)"
        stroke="var(--color-line)"
        strokeWidth="2"
      />
      {/* liquid tint, inset slightly from the glass walls */}
      <rect x={x + 3} y={y + 24} width={w - 6} height={h - 27 - r * 0.4} rx={r * 0.6} fill="rgba(90,140,220,0.05)" />
      <text x={x + w / 2} y={y - 10} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--color-ink-soft)">
        {label}
      </text>
    </g>
  );
}
