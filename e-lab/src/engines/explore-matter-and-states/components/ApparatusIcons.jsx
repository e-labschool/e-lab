// Small consistent apparatus SVGs (balance, graduated cylinder, ruler,
// balloon, syringe) reused across the mass/volume test scenes.

export function BalanceIcon({ highlighted }) {
  return (
    <svg viewBox="0 0 120 90" className="h-20 w-28" aria-hidden="true">
      <rect x="20" y="70" width="80" height="8" rx="2" fill="var(--color-ink-faint)" />
      <rect x="55" y="30" width="10" height="40" fill="var(--color-ink-faint)" />
      <rect
        x="24"
        y="24"
        width="72"
        height="10"
        rx="2"
        fill={highlighted ? "var(--color-teal)" : "var(--color-ink-soft)"}
        style={{ transition: "fill 0.3s ease" }}
      />
      <rect x="18" y="14" width="26" height="10" rx="2" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="1.5" />
      <text x="31" y="22" textAnchor="middle" fontSize="7" fontFamily="var(--font-mono)" fill="var(--color-ink)">0.0</text>
    </svg>
  );
}

export function GraduatedCylinder({ levelPercent = 30, highlight }) {
  return (
    <svg viewBox="0 0 60 120" className="h-28 w-16" aria-hidden="true">
      <rect x="16" y="10" width="28" height="100" rx="3" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
      {[20, 40, 60, 80].map((y) => (
        <line key={y} x1="16" y1={y} x2="21" y2={y} stroke="var(--color-ink-faint)" strokeWidth="1" />
      ))}
      <rect
        x="17.5"
        y={110 - levelPercent}
        width="25"
        height={levelPercent}
        fill={highlight ? "var(--color-teal)" : "var(--color-indigo)"}
        opacity="0.55"
        style={{ transition: "y 0.5s ease, height 0.5s ease, fill 0.3s ease" }}
      />
    </svg>
  );
}

export function RulerBlock({ scale = 1 }) {
  return (
    <svg viewBox="0 0 140 100" className="h-24 w-32" aria-hidden="true">
      <rect x="30" y="20" width={60 * scale} height={50 * scale} fill="var(--color-indigo-soft)" stroke="var(--color-indigo)" strokeWidth="1.5" />
      <line x1="30" y1="78" x2={30 + 60 * scale} y2="78" stroke="var(--color-ink-faint)" strokeWidth="1" />
      <line x1="30" y1="75" x2="30" y2="81" stroke="var(--color-ink-faint)" strokeWidth="1" />
      <line x1={30 + 60 * scale} y1="75" x2={30 + 60 * scale} y2="81" stroke="var(--color-ink-faint)" strokeWidth="1" />
    </svg>
  );
}

export function BalloonIcon({ inflated }) {
  return (
    <svg viewBox="0 0 80 100" className="h-24 w-20" aria-hidden="true" style={{ transition: "transform 0.5s ease" }}>
      <ellipse
        cx="40"
        cy="42"
        rx={inflated ? 30 : 14}
        ry={inflated ? 34 : 18}
        fill="var(--color-indigo-soft)"
        stroke="var(--color-indigo)"
        strokeWidth="1.5"
        style={{ transition: "rx 0.5s ease, ry 0.5s ease" }}
      />
      <path d="M40 76 l-4 6 h8 Z" fill="var(--color-ink-faint)" />
    </svg>
  );
}

export function SyringeIcon({ fillPercent = 40 }) {
  return (
    <svg viewBox="0 0 140 60" className="h-14 w-36" aria-hidden="true">
      <rect x="10" y="18" width="90" height="24" rx="3" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
      <rect x="12" y="20" width={86 * (fillPercent / 100)} height="20" fill="var(--color-block-f)" opacity="0.4" style={{ transition: "width 0.5s ease" }} />
      <rect x="100" y="26" width="26" height="8" fill="var(--color-ink-faint)" />
      <rect x="126" y="22" width="8" height="16" fill="var(--color-ink-soft)" />
    </svg>
  );
}
