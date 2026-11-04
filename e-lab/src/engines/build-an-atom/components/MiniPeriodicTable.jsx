import { useState } from "react";
import { allElements } from "../data/elementLookup.js";

// A local, Build-an-Atom-specific periodic table -- the GRID PLACEMENT
// approach (group/period, with f-block rows placed as separate footer
// rows) follows the same standard convention already proven in
// PeriodicTableSelector.jsx (engines/electron-configuration), but this
// is an independent, visually distinct implementation for this
// simulation rather than a direct dependency on that engine. The
// element DATA itself is never duplicated -- read from the shared
// src/data/chemistry/elements.js via elementLookup.js.
const BLOCK_COLOR = { s: "var(--color-block-s)", p: "var(--color-block-p)", d: "var(--color-block-d)", f: "var(--color-block-f)" };

function cellPosition(el) {
  if (el.block === "f") {
    const seriesStart = el.atomicNumber < 90 ? 58 : 90;
    return { gridColumn: 3 + (el.atomicNumber - seriesStart), gridRow: el.atomicNumber < 90 ? 9 : 10 };
  }
  return { gridColumn: el.group, gridRow: el.period };
}

export default function MiniPeriodicTable({ currentAtomicNumber, onSelectElement }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-sm font-bold text-[var(--color-ink)]"
      >
        Explore Periodic Table
        <span className="text-[var(--color-ink-faint)]">{expanded ? "\u25B4" : "\u25BE"}</span>
      </button>

      {expanded && (
        <div className="mt-3 overflow-x-auto">
          <div className="grid min-w-[640px] gap-1" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }} role="grid" aria-label="Periodic table — click an element to set the proton count">
            {allElements.map((el) => {
              const isCurrent = el.atomicNumber === currentAtomicNumber;
              return (
                <button
                  key={el.atomicNumber}
                  type="button"
                  onClick={() => onSelectElement(el.atomicNumber)}
                  style={{ ...cellPosition(el), backgroundColor: isCurrent ? BLOCK_COLOR[el.block] : "var(--color-paper)", borderColor: isCurrent ? BLOCK_COLOR[el.block] : "var(--color-line)" }}
                  aria-pressed={isCurrent}
                  aria-label={`${el.name}, atomic number ${el.atomicNumber}`}
                  className={`flex aspect-square flex-col items-center justify-center rounded-md border text-[9px] transition-transform hover:z-10 hover:scale-110 ${isCurrent ? "text-white shadow-sm" : "text-[var(--color-ink)]"}`}
                >
                  <span className="leading-none opacity-70">{el.atomicNumber}</span>
                  <span className="text-[12px] font-bold leading-tight">{el.symbol}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
