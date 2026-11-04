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

  return (
    <div className="relative inline-flex items-center justify-center" style={{ minWidth: 110, minHeight: 90 }} aria-label={element ? `Nuclide notation: mass number ${massNumber}, ${element.symbol}, atomic number ${atomicNumber}${chargeStr ? `, charge ${chargeStr}` : ""}` : "No element yet"}>
      <span
        className="text-6xl font-bold leading-none text-[var(--color-ink)]"
        style={{ fontFamily: "var(--font-display, inherit)" }}
      >
        {symbol}
      </span>
      <span
        className={`absolute left-0 top-1 -translate-x-full text-xl font-bold leading-none ${highlightA ? "atom-notation-pulse" : ""}`}
        style={{ color: "var(--color-violet)" }}
      >
        {element ? massNumber : "\u2014"}
      </span>
      <span
        className={`absolute bottom-1 left-0 -translate-x-full text-xl font-bold leading-none ${highlightZ ? "atom-notation-pulse" : ""}`}
        style={{ color: "var(--color-teal)" }}
      >
        {element ? atomicNumber : "\u2014"}
      </span>
      {chargeStr && (
        <span
          className={`absolute right-0 top-1 translate-x-full text-xl font-bold leading-none ${highlightCharge ? "atom-notation-pulse" : ""}`}
          style={{ color: netCharge > 0 ? "var(--color-amber)" : "var(--color-indigo)" }}
        >
          {chargeStr}
        </span>
      )}
      <style>{`
        @keyframes atom-notation-pulse-kf { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 5px currentColor); } }
        .atom-notation-pulse { animation: atom-notation-pulse-kf 600ms ease-in-out 1; }
      `}</style>
    </div>
  );
}
