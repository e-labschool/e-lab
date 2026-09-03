// Proper nuclear notation: mass number superscript-left, atomic number
// subscript-left, element symbol, optional charge superscript-right.
// SVG rather than CSS super/sub tags so the positioning is exact and
// identical in-app, in the preview modal, and on the printed paper.
function OneNuclide({ massNumber, atomicNumber, symbol, charge, label }) {
  const symbolWidth = Math.max(18, symbol.length * 13);
  const width = 26 + symbolWidth + (charge ? 16 : 0);

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-xs font-medium text-[var(--color-ink-faint)]">{label}</span>}
      <svg viewBox={`0 0 ${width} 48`} className="h-12" style={{ width: `${width * 0.9}px` }} role="img" aria-label={`nuclide ${massNumber} ${symbol}, atomic number ${atomicNumber}${charge ? `, charge ${charge}` : ""}`}>
        <text x="2" y="18" fontSize="15" fontFamily="var(--font-mono)" fill="currentColor">{massNumber}</text>
        <text x="2" y="40" fontSize="15" fontFamily="var(--font-mono)" fill="currentColor">{atomicNumber}</text>
        <text x="24" y="32" fontSize="22" fontFamily="var(--font-sans)" fontWeight="600" fill="currentColor">{symbol}</text>
        {charge && (
          <text x={24 + symbolWidth} y="18" fontSize="14" fontFamily="var(--font-mono)" fill="currentColor">{charge}</text>
        )}
      </svg>
    </div>
  );
}

export default function NuclideNotation({ nuclides }) {
  return (
    <div className="flex flex-wrap items-center gap-6 text-[var(--color-ink)]">
      {nuclides.map((n, i) => (
        <OneNuclide key={i} {...n} />
      ))}
    </div>
  );
}
