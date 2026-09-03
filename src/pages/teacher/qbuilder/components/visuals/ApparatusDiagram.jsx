// Simple, clean lab-apparatus icons — reused wherever a question needs to
// show/compare pieces of equipment (measuring apparatus, containers).
function OneItem({ kind, label }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 60 70" className="h-16 w-14 text-[var(--color-ink)]" role="img" aria-label={label ?? kind}>
        {kind === "beaker" && (
          <path d="M14 10 h32 v6 l-4 40 a4 4 0 0 1 -4 4 h-16 a4 4 0 0 1 -4 -4 l-4 -40 Z" fill="none" stroke="currentColor" strokeWidth="1.75" />
        )}
        {kind === "measuring-cylinder" && (
          <>
            <path d="M22 8 h16 v50 a2 2 0 0 1 -2 2 h-12 a2 2 0 0 1 -2 -2 Z" fill="none" stroke="currentColor" strokeWidth="1.75" />
            {[20, 32, 44].map((y) => <line key={y} x1="22" y1={y} x2="27" y2={y} stroke="currentColor" strokeWidth="1" />)}
          </>
        )}
        {kind === "volumetric-flask" && (
          <path d="M26 8 h8 v14 l14 32 a3 3 0 0 1 -3 4 h-30 a3 3 0 0 1 -3 -4 l14 -32 Z" fill="none" stroke="currentColor" strokeWidth="1.75" />
        )}
        {kind === "conical-flask" && (
          <path d="M24 8 h12 v12 l16 34 a3 3 0 0 1 -3 4 h-38 a3 3 0 0 1 -3 -4 l16 -34 Z" fill="none" stroke="currentColor" strokeWidth="1.75" />
        )}
        {kind === "volumetric-flask" && <line x1="18" y1="42" x2="42" y2="42" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />}
      </svg>
      {label && <span className="text-xs text-[var(--color-ink-soft)]">{label}</span>}
    </div>
  );
}

export default function ApparatusDiagram({ items }) {
  return (
    <div className="flex flex-wrap gap-5">
      {items.map((item, i) => (
        <OneItem key={i} kind={item.kind} label={item.label} />
      ))}
    </div>
  );
}
