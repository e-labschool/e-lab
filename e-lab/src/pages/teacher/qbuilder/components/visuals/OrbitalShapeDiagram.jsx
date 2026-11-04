// s and p orbital shapes only (per the syllabus point this supports —
// recognition of the spherical s orbital and the three p orbital
// orientations, not d orbitals). Conventional simplified 2D textbook
// representations, monochrome.
function Shape({ kind, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 80 80" className="h-16 w-16 text-[var(--color-ink)]" role="img" aria-label={`${kind} orbital`}>
        <line x1="10" y1="40" x2="70" y2="40" stroke="currentColor" strokeWidth="0.75" opacity="0.35" />
        <line x1="40" y1="10" x2="40" y2="70" stroke="currentColor" strokeWidth="0.75" opacity="0.35" />
        {kind === "s" && <circle cx="40" cy="40" r="20" fill="none" stroke="currentColor" strokeWidth="1.75" />}
        {kind === "px" && (
          <>
            <ellipse cx="24" cy="40" rx="16" ry="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
            <ellipse cx="56" cy="40" rx="16" ry="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
          </>
        )}
        {kind === "py" && (
          <>
            <ellipse cx="40" cy="24" rx="9" ry="16" fill="none" stroke="currentColor" strokeWidth="1.75" />
            <ellipse cx="40" cy="56" rx="9" ry="16" fill="none" stroke="currentColor" strokeWidth="1.75" />
          </>
        )}
        {kind === "pz" && (
          <>
            <ellipse cx="26" cy="54" rx="14" ry="8" fill="none" stroke="currentColor" strokeWidth="1.75" transform="rotate(-35 26 54)" />
            <ellipse cx="54" cy="26" rx="14" ry="8" fill="none" stroke="currentColor" strokeWidth="1.75" transform="rotate(-35 54 26)" />
          </>
        )}
      </svg>
      {label && <span className="text-xs text-[var(--color-ink-soft)]">{label}</span>}
    </div>
  );
}

export default function OrbitalShapeDiagram({ shapes }) {
  return (
    <div className="flex flex-wrap gap-5">
      {shapes.map((s) => (
        <Shape key={s.id} kind={s.kind} label={s.label} />
      ))}
    </div>
  );
}
