// A realistic-but-lightweight glass beaker, built entirely from SVG
// gradients/shapes (no external image) -- open rim, curved cylindrical
// walls, a glass highlight, and faint measurement marks. Pure vector,
// so the particles rendered as `children` can animate freely inside it,
// clipped to the beaker's own interior silhouette.
export default function Beaker({ width, height, children }) {
  const wallInset = 5;
  const rimY = 4;
  const bottomY = height - 10;

  const bodyPath = `M ${wallInset} ${rimY} L ${wallInset - 2} ${bottomY - 8} Q ${wallInset - 2} ${bottomY} ${wallInset + 10} ${bottomY} L ${width - wallInset - 10} ${bottomY} Q ${width - wallInset + 2} ${bottomY} ${width - wallInset + 2} ${bottomY - 8} L ${width - wallInset} ${rimY} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      <defs>
        <linearGradient id="ctv-beaker-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(210,225,245,0.10)" />
          <stop offset="15%" stopColor="rgba(230,240,255,0.22)" />
          <stop offset="50%" stopColor="rgba(210,225,245,0.05)" />
          <stop offset="85%" stopColor="rgba(230,240,255,0.18)" />
          <stop offset="100%" stopColor="rgba(210,225,245,0.10)" />
        </linearGradient>
        <clipPath id="ctv-beaker-clip">
          <path d={bodyPath} />
        </clipPath>
      </defs>

      {/* glass body */}
      <path d={bodyPath} fill="url(#ctv-beaker-glass)" stroke="rgba(215,228,245,0.5)" strokeWidth="1.5" />
      {/* rim */}
      <ellipse cx={width / 2} cy={rimY} rx={(width - wallInset * 2) / 2} ry="3.5" fill="none" stroke="rgba(225,235,250,0.55)" strokeWidth="1.75" />

      {/* faint measurement marks */}
      {[0.3, 0.55, 0.8].map((f) => (
        <line key={f} x1={wallInset} y1={rimY + (bottomY - rimY) * f} x2={wallInset + 8} y2={rimY + (bottomY - rimY) * f} stroke="rgba(210,225,245,0.22)" strokeWidth="1" />
      ))}

      {/* particles/content, clipped to the beaker's own interior */}
      <g clipPath="url(#ctv-beaker-clip)">{children}</g>

      {/* glass highlight, drawn last so it sits above the content */}
      <rect x={wallInset + 4} y={rimY + 4} width="5" height={bottomY - rimY - 12} rx="2.5" fill="rgba(255,255,255,0.13)" />
    </svg>
  );
}
