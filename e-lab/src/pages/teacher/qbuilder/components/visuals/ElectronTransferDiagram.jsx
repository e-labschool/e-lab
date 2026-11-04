// Shows one atom losing electron(s) to another, forming the resulting
// ions — used for ionic-bond-formation questions.
export default function ElectronTransferDiagram({ from, to }) {
  return (
    <svg viewBox="0 0 220 90" className="w-full max-w-xs text-[var(--color-ink)]" role="img" aria-label={`Electron transfer from ${from.symbol} to ${to.symbol}`}>
      <circle cx="40" cy="35" r="20" fill="var(--color-indigo-soft)" stroke="currentColor" strokeWidth="1.25" />
      <text x="40" y="40" fontSize="13" textAnchor="middle" fill="currentColor">{from.symbol}</text>
      <circle cx="180" cy="35" r="20" fill="var(--color-amber-soft)" stroke="currentColor" strokeWidth="1.25" />
      <text x="180" y="40" fontSize="13" textAnchor="middle" fill="currentColor">{to.symbol}</text>

      <defs>
        <marker id="e-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" />
        </marker>
      </defs>
      <line x1="64" y1="30" x2="156" y2="30" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#e-arrow)" />
      <text x="110" y="20" fontSize="9" textAnchor="middle" fill="currentColor">{from.electronsLost > 1 ? `${from.electronsLost}e\u207b` : "e\u207b"}</text>

      <text x="40" y="72" fontSize="11" textAnchor="middle" fill="currentColor" fontWeight="600">{from.resultLabel}</text>
      <text x="180" y="72" fontSize="11" textAnchor="middle" fill="currentColor" fontWeight="600">{to.resultLabel}</text>
    </svg>
  );
}
