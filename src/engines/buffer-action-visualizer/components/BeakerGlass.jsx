// A realistic laboratory beaker built from SVG shapes/gradients — curved
// glass walls, a rim, a visible liquid fill with a subtle surface line,
// faint measurement markings, and a soft highlight for glass depth. Pure
// vector, so particles rendered inside it can animate freely.
export default function BeakerGlass({ width = 170, height = 190, liquidLevel = 0.72, children, gradientId }) {
  const wallInset = 6;
  const rimY = 8;
  const bottomY = height - 14;
  const liquidY = rimY + (bottomY - rimY) * (1 - liquidLevel);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="beaker-glass-svg">
      <defs>
        <linearGradient id={`${gradientId}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(210,225,245,0.10)" />
          <stop offset="15%" stopColor="rgba(230,240,255,0.22)" />
          <stop offset="50%" stopColor="rgba(210,225,245,0.06)" />
          <stop offset="85%" stopColor="rgba(230,240,255,0.18)" />
          <stop offset="100%" stopColor="rgba(210,225,245,0.10)" />
        </linearGradient>
        <linearGradient id={`${gradientId}-liquid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(140,175,220,0.16)" />
          <stop offset="100%" stopColor="rgba(100,140,190,0.22)" />
        </linearGradient>
        <clipPath id={`${gradientId}-clip`}>
          <path d={`M ${wallInset} ${rimY} L ${wallInset - 2} ${bottomY - 10} Q ${wallInset - 2} ${bottomY} ${wallInset + 12} ${bottomY} L ${width - wallInset - 12} ${bottomY} Q ${width - wallInset + 2} ${bottomY} ${width - wallInset + 2} ${bottomY - 10} L ${width - wallInset} ${rimY} Z`} />
        </clipPath>
      </defs>

      {/* glass body */}
      <path
        d={`M ${wallInset} ${rimY} L ${wallInset - 2} ${bottomY - 10} Q ${wallInset - 2} ${bottomY} ${wallInset + 12} ${bottomY} L ${width - wallInset - 12} ${bottomY} Q ${width - wallInset + 2} ${bottomY} ${width - wallInset + 2} ${bottomY - 10} L ${width - wallInset} ${rimY} Z`}
        fill={`url(#${gradientId}-glass)`}
        stroke="rgba(215,228,245,0.5)"
        strokeWidth="1.8"
      />
      {/* rim */}
      <ellipse cx={width / 2} cy={rimY} rx={(width - wallInset * 2) / 2} ry="4" fill="none" stroke="rgba(225,235,250,0.55)" strokeWidth="2" />

      {/* liquid + particles, clipped to the glass interior */}
      <g clipPath={`url(#${gradientId}-clip)`}>
        <rect x={wallInset} y={liquidY} width={width - wallInset * 2} height={bottomY - liquidY} fill={`url(#${gradientId}-liquid)`} />
        <ellipse cx={width / 2} cy={liquidY} rx={(width - wallInset * 2) / 2} ry="3.5" fill="rgba(210,230,250,0.28)" />
        {/* faint measurement marks */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={wallInset} y1={rimY + (bottomY - rimY) * f} x2={wallInset + 10} y2={rimY + (bottomY - rimY) * f} stroke="rgba(210,225,245,0.25)" strokeWidth="1" />
        ))}
        {children}
      </g>

      {/* glass highlight, drawn last so it sits above the liquid */}
      <rect x={wallInset + 6} y={rimY + 6} width="7" height={bottomY - rimY - 18} rx="3.5" fill="rgba(255,255,255,0.14)" />
    </svg>
  );
}
