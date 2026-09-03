// A generic, labelled illustration of sigma (head-on, end-to-end overlap)
// versus pi (side-on, lateral p-orbital overlap) bonding — not tied to any
// specific molecule's exact orbital geometry, which is exactly what these
// conceptual questions assess.
export default function SigmaPiDiagram() {
  return (
    <div className="flex flex-wrap gap-8">
      <div className="flex flex-col items-center gap-1.5">
        <svg viewBox="0 0 120 60" className="h-14 w-28 text-[var(--color-ink)]" role="img" aria-label="Sigma bond: head-on orbital overlap">
          <circle cx="45" cy="30" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="75" cy="30" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="text-xs text-[var(--color-ink-soft)]">σ (sigma) — head-on overlap</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <svg viewBox="0 0 120 60" className="h-14 w-28 text-[var(--color-ink)]" role="img" aria-label="Pi bond: side-on p-orbital overlap">
          <line x1="10" y1="30" x2="110" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <ellipse cx="45" cy="18" rx="18" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="75" cy="18" rx="18" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="45" cy="42" rx="18" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="75" cy="42" rx="18" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="text-xs text-[var(--color-ink-soft)]">π (pi) — lateral overlap, above/below axis</span>
      </div>
    </div>
  );
}
