// A simple, semi-realistic burette/dropper above the H+ side — a glass
// cylinder with a metallic clamp band and a tapered tip, with an
// optional falling droplet (controlled by the parent) so students
// actually SEE acid being added rather than just a number changing.
export default function Burette({ x, y, dropVisible, dropProgress = 0 }) {
  const bodyW = 22, bodyH = 90;
  const tipY = y + bodyH + 18;

  return (
    <g>
      <defs>
        <linearGradient id="burette-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(200,215,235,0.35)" />
          <stop offset="45%" stopColor="rgba(230,240,250,0.6)" />
          <stop offset="100%" stopColor="rgba(200,215,235,0.35)" />
        </linearGradient>
        <linearGradient id="burette-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e7f0d8" />
          <stop offset="100%" stopColor="#d3e4b8" />
        </linearGradient>
      </defs>

      {/* clamp / stand arm */}
      <rect x={x - bodyW / 2 - 10} y={y - 14} width={bodyW + 20} height="10" rx="2" fill="var(--color-ink-faint)" />

      {/* glass body */}
      <rect x={x - bodyW / 2} y={y} width={bodyW} height={bodyH} rx="3" fill="url(#burette-glass)" stroke="var(--color-ink-faint)" strokeWidth="1.2" />
      <rect x={x - bodyW / 2 + 3} y={y + 10} width={bodyW - 6} height={bodyH - 20} fill="url(#burette-liquid)" opacity="0.8" />
      {/* graduation marks */}
      {[0.2, 0.4, 0.6, 0.8].map((f) => (
        <line key={f} x1={x - bodyW / 2} y1={y + bodyH * f} x2={x - bodyW / 2 + 6} y2={y + bodyH * f} stroke="var(--color-ink-faint)" strokeWidth="1" />
      ))}

      {/* tapered tip */}
      <path d={`M ${x - 6} ${y + bodyH} L ${x + 6} ${y + bodyH} L ${x + 1.5} ${tipY} L ${x - 1.5} ${tipY} Z`} fill="rgba(230,240,250,0.6)" stroke="var(--color-ink-faint)" strokeWidth="1" />

      <text x={x} y={y - 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink-soft)">HCl</text>

      {dropVisible && (
        <ellipse
          cx={x}
          cy={tipY + dropProgress * 46}
          rx="4"
          ry="5.5"
          fill="#d9e8b0"
          opacity={1 - dropProgress * 0.3}
        />
      )}
    </g>
  );
}
