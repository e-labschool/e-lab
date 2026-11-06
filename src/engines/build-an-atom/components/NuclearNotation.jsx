import { formatCharge } from "../lib/atomState.js";

// Proper nuclide notation layout: mass number (A) upper-left of the
// element symbol, atomic number (Z) lower-left, ion charge upper-right
// -- genuinely positioned relative to the symbol via absolute
// positioning within one relative container, not four unrelated labels
// in a row.
export default function NuclearNotation({ derived, highlightA, highlightZ, highlightCharge }) {
  const { element, massNumber, atomicNumber, netCharge } = derived;
  const chargeStr = formatCharge(netCharge);
  const symbol = element ? element.symbol : "?";

  // A 3-column grid sized by its own content: [A over Z] [symbol] [charge]. Every
  // label is IN the grid (nothing is positioned outside the box any more), so the
  // block's width always includes the numbers and a 2-3 character charge such as
  // "10+", and neighbours in a flex-wrap row can never be overlapped by it.
  return (
    <div
      className="inline-grid shrink-0 grid-cols-[auto_auto_auto] items-stretch gap-x-1.5"
      style={{ minHeight: 90 }}
      data-testid="atom-notation"
      aria-label={element ? `Nuclide notation: mass number ${massNumber}, ${element.symbol}, atomic number ${atomicNumber}${chargeStr ? `, charge ${chargeStr}` : ""}` : "No element yet"}
    >
      <div className="flex min-w-[2ch] flex-col justify-between py-1 text-right text-xl font-bold leading-none">
        <span className={highlightA ? "atom-notation-pulse" : ""} style={{ color: "var(--color-violet)" }} data-testid="atom-notation-A">{element ? massNumber : "\u2014"}</span>
        <span className={highlightZ ? "atom-notation-pulse" : ""} style={{ color: "var(--color-teal)" }} data-testid="atom-notation-Z">{element ? atomicNumber : "\u2014"}</span>
      </div>
      <span className="self-center text-6xl font-bold leading-none text-[var(--color-ink)]" style={{ fontFamily: "var(--font-display, inherit)" }} data-testid="atom-notation-symbol">
        {symbol}
      </span>
      <div className="min-w-[3ch] py-1 text-left text-xl font-bold leading-none">
        {chargeStr && (
          <span className={highlightCharge ? "atom-notation-pulse" : ""} style={{ color: netCharge > 0 ? "var(--color-amber)" : "var(--color-indigo)" }} data-testid="atom-notation-charge">
            {chargeStr}
          </span>
        )}
      </div>
      <style>{`
        @keyframes atom-notation-pulse-kf { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 5px currentColor); } }
        .atom-notation-pulse { animation: atom-notation-pulse-kf 600ms ease-in-out 1; }
      `}</style>
    </div>
  );
}
