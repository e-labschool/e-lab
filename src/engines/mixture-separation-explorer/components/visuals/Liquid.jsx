// A reusable liquid fill for any container shape -- a rect clipped to
// the container's own clip-path, with a subtle wavy top surface and a
// light gradient for a sense of depth/transparency. `level` is 0-1 (
// fraction of `height` filled from the bottom). Used inside Beaker,
// the receiving vessel, and the funnel stem.
export default function Liquid({ x, y, width, height, level, color, opacity = 0.55, clipId }) {
  if (level <= 0) return null;
  const fillHeight = height * Math.min(1, level);
  const top = y + height - fillHeight;
  const gradId = `${clipId}-liquid-grad`;

  return (
    <g clipPath={clipId ? `url(#${clipId})` : undefined}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={opacity * 0.75} />
          <stop offset="100%" stopColor={color} stopOpacity={opacity} />
        </linearGradient>
      </defs>
      <path
        d={`M ${x} ${top + 3} Q ${x + width * 0.25} ${top - 2} ${x + width * 0.5} ${top} Q ${x + width * 0.75} ${top + 2} ${x + width} ${top - 1} L ${x + width} ${y + height} L ${x} ${y + height} Z`}
        fill={`url(#${gradId})`}
      />
    </g>
  );
}
