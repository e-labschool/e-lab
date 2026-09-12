import { ION_TYPES } from "../lib/physics.js";

// One ion — a filled circle with its label always visible, per the
// requirement that every particle's identity is clearly readable at a
// glance (H+, Cl-, Na+, OH-), not just colour-coded.
export default function IonDot({ x, y, type, fading = false }) {
  const info = ION_TYPES[type];
  return (
    <g style={{ opacity: fading ? 0.85 : 1 }}>
      <circle cx={x} cy={y} r={info.radius} fill={info.color} />
      <text x={x} y={y + info.radius + 12} textAnchor="middle" fontSize="11" fontWeight="600" fill={info.color}>
        {info.label}
      </text>
    </g>
  );
}
