// A vertical stepped Born-Haber cycle: each labelled step (atomization,
// ionization, electron affinity, lattice enthalpy, etc.) drawn as an
// arrow at its own energy level, with one step's value replaceable by
// "?" for the student to determine — per the syllabus boundary, students
// interpret/complete a supplied cycle rather than construct one from
// scratch.
export default function BornHaberCycle({ steps }) {
  const H = 40 + steps.length * 34;
  const rows = steps.map((s, i) => ({ ...s, y: 20 + i * 34 }));

  return (
    <svg viewBox={`0 0 260 ${H}`} className="w-full max-w-xs text-[var(--color-ink)]" role="img" aria-label="Born-Haber cycle">
      <defs>
        <marker id="bh-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>
      {rows.map((r, i) => (
        <g key={i}>
          <line x1="20" y1={r.y} x2="150" y2={r.y} stroke={r.unknown ? "var(--color-amber)" : "currentColor"} strokeWidth="1.5" markerEnd="url(#bh-arrow)" />
          <text x="20" y={r.y - 6} fontSize="8" fill="currentColor">{r.label}</text>
          <text x="160" y={r.y + 3} fontSize="8" fontWeight={r.unknown ? "700" : "400"} fill={r.unknown ? "var(--color-amber)" : "currentColor"}>{r.unknown ? "?" : `${r.value} kJ mol\u207b\u00b9`}</text>
        </g>
      ))}
    </svg>
  );
}
