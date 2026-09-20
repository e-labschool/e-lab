import { useId } from "react";
import Liquid from "../visuals/Liquid.jsx";
import Particles from "../visuals/Particles.jsx";

// A realistic glass beaker read as a CYLINDER, not a flat rectangle:
// a top rim ellipse, a base ellipse (partially hidden behind the
// liquid/glass), curved side walls via a path (not straight verticals),
// a strong side-gradient for cylindrical shading, a bright edge
// highlight down one side, and a soft floor shadow. Can be rotated
// around a given pivot (for the pouring tilt) via
// `rotation`/`pivotX`/`pivotY`.
export default function Beaker({
  x, y, width, height,
  liquidLevel = 0,
  liquidColor = "#8FB4E8",
  particleLayout = null,
  particleCount = 0,
  particleColor = "#C9A876",
  turbidity = 0,
  rotation = 0,
  pivotX,
  pivotY,
  label,
}) {
  const uid = `mse-beaker-${useId().replace(/:/g, "")}`;
  const rimRy = height * 0.075;
  const baseRy = rimRy * 0.85;
  const bulge = width * 0.045; // slight outward curve of the glass wall, not a straight rectangle
  const cx = x + width / 2;

  // The wall path: rim ellipse edges down to a slightly bulging side,
  // narrowing a touch at the base -- reads as a rounded cylinder rather
  // than a box.
  const wallPath = `M ${x} ${y} C ${x - bulge} ${y + height * 0.4}, ${x - bulge * 0.6} ${y + height * 0.85}, ${x + width * 0.06} ${y + height} L ${x + width * 0.94} ${y + height} C ${x + width + bulge * 0.6} ${y + height * 0.85}, ${x + width + bulge} ${y + height * 0.4}, ${x + width} ${y}`;

  return (
    <g transform={rotation ? `rotate(${rotation} ${pivotX ?? cx} ${pivotY ?? y + height})` : undefined}>
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(150,175,205,0.30)" />
          <stop offset="10%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="22%" stopColor="rgba(210,225,245,0.16)" />
          <stop offset="55%" stopColor="rgba(180,200,225,0.10)" />
          <stop offset="82%" stopColor="rgba(210,225,245,0.20)" />
          <stop offset="100%" stopColor="rgba(140,165,195,0.32)" />
        </linearGradient>
        <radialGradient id={`${uid}-rim`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="100%" stopColor="rgba(200,218,240,0.35)" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={`${wallPath} L ${x + width} ${y} Z`} />
        </clipPath>
      </defs>

      <ellipse cx={cx} cy={y + height + baseRy + 2} rx={width * 0.42} ry={baseRy * 0.8} fill="rgba(20,25,35,0.12)" />

      {liquidLevel > 0 && (
        <Liquid x={x + width * 0.05} y={y + rimRy} width={width * 0.9} height={height - rimRy} level={liquidLevel} color={liquidColor} clipId={`${uid}-clip`} turbidity={turbidity} />
      )}
      {particleLayout && particleCount > 0 && (
        <Particles layout={particleLayout} visibleCount={particleCount} color={particleColor} clipId={`${uid}-clip`} />
      )}

      <path d={wallPath} fill={`url(#${uid}-glass)`} stroke="rgba(200,218,240,0.6)" strokeWidth="1.25" />
      <ellipse cx={cx} cy={y + height} rx={width * 0.44} ry={baseRy} fill="none" stroke="rgba(190,208,232,0.45)" strokeWidth="1" opacity="0.7" />
      <ellipse cx={cx} cy={y} rx={width / 2} ry={rimRy} fill={`url(#${uid}-rim)`} stroke="rgba(220,235,250,0.75)" strokeWidth="1.5" />

      {/* a narrow bright streak simulating a glass-edge reflection */}
      <path d={`M ${x + width * 0.16} ${y + rimRy * 1.3} C ${x + width * 0.1} ${y + height * 0.4}, ${x + width * 0.12} ${y + height * 0.75}, ${x + width * 0.2} ${y + height * 0.92}`} stroke="rgba(255,255,255,0.5)" strokeWidth={width * 0.035} strokeLinecap="round" fill="none" opacity="0.8" />

      {label && (
        <text x={cx} y={y - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">
          {label}
        </text>
      )}
    </g>
  );
}
