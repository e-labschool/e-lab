import { useId } from "react";
import Liquid from "../visuals/Liquid.jsx";
import Particles from "../visuals/Particles.jsx";

// A reusable realistic glass beaker: open rim, slightly tapered walls,
// a glass-gradient body, a highlight streak, and an optional liquid
// fill + suspended particles inside. Can be rotated around a given
// pivot (for the pouring tilt) via `rotation`/`pivotX`/`pivotY`.
export default function Beaker({
  x, y, width, height,
  liquidLevel = 0,
  liquidColor = "#8FB4E8",
  particleLayout = null,
  particleCount = 0,
  particleColor = "#C9A876",
  rotation = 0,
  pivotX,
  pivotY,
  label,
}) {
  // useId() can include colons, which are unreliable inside an SVG
  // url(#...) reference in some browsers -- stripped here for safety.
  const uid = `mse-beaker-${useId().replace(/:/g, "")}`;
  const taper = width * 0.08;
  const rimRy = 3.5;

  const bodyPath = `M ${x} ${y + rimRy} L ${x + taper} ${y + height} Q ${x + taper} ${y + height + 3} ${x + taper + 6} ${y + height + 3} L ${x + width - taper - 6} ${y + height + 3} Q ${x + width - taper} ${y + height + 3} ${x + width - taper} ${y + height} L ${x + width} ${y + rimRy}`;

  return (
    <g transform={rotation ? `rotate(${rotation} ${pivotX ?? x + width / 2} ${pivotY ?? y + height})` : undefined}>
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(215,228,245,0.12)" />
          <stop offset="12%" stopColor="rgba(235,242,255,0.28)" />
          <stop offset="50%" stopColor="rgba(215,228,245,0.06)" />
          <stop offset="88%" stopColor="rgba(235,242,255,0.24)" />
          <stop offset="100%" stopColor="rgba(215,228,245,0.12)" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={`${bodyPath} Z`} />
        </clipPath>
      </defs>

      <ellipse cx={x + width / 2} cy={y + height + 3.5} rx={(width - taper * 2 - 12) / 2 + 3} ry="2.5" fill="rgba(20,25,35,0.10)" />

      {liquidLevel > 0 && (
        <Liquid x={x + taper * 0.4} y={y} width={width - taper * 0.8} height={height} level={liquidLevel} color={liquidColor} clipId={`${uid}-clip`} />
      )}
      {particleLayout && particleCount > 0 && (
        <Particles layout={particleLayout} visibleCount={particleCount} color={particleColor} clipId={`${uid}-clip`} />
      )}

      <path d={bodyPath} fill={`url(#${uid}-glass)`} stroke="rgba(210,222,240,0.55)" strokeWidth="1.25" strokeLinejoin="round" />
      <ellipse cx={x + width / 2} cy={y + rimRy} rx={width / 2} ry={rimRy} fill="none" stroke="rgba(220,232,248,0.6)" strokeWidth="1.5" />
      <rect x={x + width * 0.14} y={y + height * 0.18} width={width * 0.05} height={height * 0.55} rx="2" fill="rgba(255,255,255,0.15)" />

      {label && (
        <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--color-ink-faint)">
          {label}
        </text>
      )}
    </g>
  );
}
