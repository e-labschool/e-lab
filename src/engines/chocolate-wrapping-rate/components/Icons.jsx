// Realistic-but-lightweight SVG icons -- no emoji, no external images, no
// branded imagery. A shared radial-gradient recipe gives the chocolate
// and wrapped-candy shapes a simple, convincing sense of roundness.
let gradientSerial = 0;

export function ChocolateIcon({ size = 24 }) {
  const id = `choc-grad-${nextGradientId()}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#8a5a34" />
          <stop offset="55%" stopColor="#5c3a1e" />
          <stop offset="100%" stopColor="#3f2712" />
        </radialGradient>
      </defs>
      <ellipse cx="12" cy="20.5" rx="7" ry="1.6" fill="rgba(0,0,0,0.15)" />
      <circle cx="12" cy="12" r="9" fill={`url(#${id})`} />
      <ellipse cx="8.7" cy="8.5" rx="2.6" ry="1.6" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

export function WrapperIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {/* an empty, unfolded wrapper -- flat crinkled rectangle, deliberately NOT candy-shaped, so it reads as distinct from the finished product */}
      <path
        d="M4 8 L2 6 L4 5 L3 3 L6 4 L6 3 L18 3 L18 4 L21 3 L20 5 L22 6 L20 8 L20 16 L22 18 L20 19 L21 21 L18 20 L18 21 L6 21 L6 20 L3 21 L4 19 L2 18 L4 16 Z"
        fill="#c23b3b"
        stroke="#8f2626"
        strokeWidth="0.5"
      />
      <rect x="7" y="6" width="10" height="12" rx="1.5" fill="#e0857e" opacity="0.35" />
    </svg>
  );
}

export function PackIcon({ size = 28 }) {
  const id = `pack-grad-${nextGradientId()}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 22" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#e2726a" />
          <stop offset="60%" stopColor="#c23b3b" />
          <stop offset="100%" stopColor="#8f2626" />
        </radialGradient>
      </defs>
      {/* twisted ends -- the classic wrapped-candy silhouette */}
      <path d="M2 11 L6 8 L6 14 Z" fill="#c23b3b" />
      <path d="M2 11 L5 9.3 L5 12.7 Z" fill="#8f2626" />
      <path d="M30 11 L26 8 L26 14 Z" fill="#c23b3b" />
      <path d="M30 11 L27 9.3 L27 12.7 Z" fill="#8f2626" />
      <ellipse cx="16" cy="11" rx="10" ry="8" fill={`url(#${id})`} />
      <ellipse cx="12.5" cy="7.5" rx="3" ry="1.8" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

// A stable-but-unique suffix per icon INSTANCE (not per render) so
// multiple simultaneously-rendered icons never collide on gradient id,
// without needing React's useId (kept dependency-free and simple).
function nextGradientId() {
  gradientSerial += 1;
  return gradientSerial;
}
