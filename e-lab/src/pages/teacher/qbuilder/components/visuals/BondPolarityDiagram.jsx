// Bond-polarity mode of "dipole" — a simpler representation than the
// full molecular/geometry diagram, for a single bond's polarity. The
// arrow direction is determined ONLY from the stored partialCharges
// strings themselves (looking for a "+" or "−"/"-" character in each) —
// never inferred independently from chemical knowledge the question
// didn't supply. If the polarity can't be read from the stored strings,
// the bond and labels are still shown, just without a directional arrow,
// rather than guessing which way it points.
function readsAsPositive(label) {
  return typeof label === "string" && label.includes("+");
}
function readsAsNegative(label) {
  return typeof label === "string" && (label.includes("\u2212") || label.includes("-"));
}

export default function BondPolarityDiagram({ bond, partialCharges }) {
  const [first, second] = partialCharges;
  const firstIsPositive = readsAsPositive(first);
  const secondIsPositive = readsAsPositive(second);
  const firstIsNegative = readsAsNegative(first);
  const secondIsNegative = readsAsNegative(second);

  // Arrow points from the positive end toward the negative end —
  // conventional dipole notation — only drawn when both ends are
  // determinable from the stored labels.
  const canDetermineDirection = (firstIsPositive && secondIsNegative) || (firstIsNegative && secondIsPositive);
  const arrowLeftToRight = firstIsPositive && secondIsNegative;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {bond && <p className="text-xs text-[var(--color-ink-faint)]">Bond: {bond}</p>}
      <svg viewBox="0 0 160 50" className="w-full max-w-[220px] text-[var(--color-ink)]" role="img" aria-label={`Bond polarity for ${bond ?? "bond"}: ${first ?? ""} to ${second ?? ""}`}>
        <defs>
          <marker id="bp-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient={arrowLeftToRight ? "auto" : "auto-start-reverse"}>
            <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--color-amber)" />
          </marker>
        </defs>
        {canDetermineDirection ? (
          <line
            x1={arrowLeftToRight ? 30 : 130} y1="25" x2={arrowLeftToRight ? 130 : 30} y2="25"
            stroke="var(--color-amber)" strokeWidth="2" markerEnd="url(#bp-arrow)"
          />
        ) : (
          <line x1="30" y1="25" x2="130" y2="25" stroke="currentColor" strokeWidth="1.5" />
        )}
        <text x="20" y="20" fontSize="13" textAnchor="middle" fill="currentColor">{first}</text>
        <text x="140" y="20" fontSize="13" textAnchor="middle" fill="currentColor">{second}</text>
      </svg>
    </div>
  );
}
