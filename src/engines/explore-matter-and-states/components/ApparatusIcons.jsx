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

/** 100 mL graduated cylinder. `volumeMl` (0-100) sets the liquid level: the graduations are real (every 20 mL labelled), so the
 *  level the student reads is the number shown. */
export function GraduatedCylinder({ volumeMl = 30, highlight, label }) {
  const v = Math.min(100, Math.max(0, volumeMl));
  return (
    <svg viewBox="0 0 70 124" className="h-32 w-[4.5rem]" role="img" aria-label={label ?? `Graduated cylinder reading ${Math.round(v)} millilitres`}>
      <rect x="22" y="10" width="28" height="100" rx="3" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
      {[0, 20, 40, 60, 80, 100].map((m) => (
        <g key={m}>
          <line x1="22" y1={110 - m} x2="28" y2={110 - m} stroke="var(--color-ink-soft)" strokeWidth="1" />
          <text x="19" y={110 - m + 2.5} textAnchor="end" fontSize="7" fontFamily="var(--font-mono)" fill="var(--color-ink-soft)">{m}</text>
        </g>
      ))}
      <rect
        x="23.5" y={110 - v} width="25" height={v}
        fill={highlight ? "var(--color-teal)" : "var(--color-indigo)"} opacity="0.55"
        style={{ transition: "y 0.5s ease, height 0.5s ease, fill 0.3s ease" }}
      />
      <text x="36" y="121" textAnchor="middle" fontSize="7" fontFamily="var(--font-mono)" fill="var(--color-ink-soft)">mL</text>
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

/** 100 mL gas syringe; the plunger position is the gas volume. */
export function SyringeIcon({ volumeMl = 40 }) {
  const v = Math.min(100, Math.max(0, volumeMl));
  return (
    <svg viewBox="0 0 140 70" className="h-16 w-36" role="img" aria-label={`Gas syringe reading ${Math.round(v)} millilitres`}>
      <rect x="10" y="18" width="90" height="24" rx="3" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
      <rect x="12" y="20" width={86 * (v / 100)} height="20" fill="var(--color-block-f)" opacity="0.4" style={{ transition: "width 0.5s ease" }} />
      {[0, 50, 100].map((m) => (
        <g key={m}>
          <line x1={12 + 0.86 * m} y1="42" x2={12 + 0.86 * m} y2="47" stroke="var(--color-ink-soft)" strokeWidth="1" />
          <text x={12 + 0.86 * m} y="56" textAnchor="middle" fontSize="7" fontFamily="var(--font-mono)" fill="var(--color-ink-soft)">{m}</text>
        </g>
      ))}
      <text x="106" y="56" fontSize="7" fontFamily="var(--font-mono)" fill="var(--color-ink-soft)">mL</text>
      <rect x="100" y="26" width="26" height="8" fill="var(--color-ink-faint)" />
      <rect x="126" y="22" width="8" height="16" fill="var(--color-ink-soft)" />
    </svg>
  );
}
