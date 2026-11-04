import elements from "../../../data/chemistry/elements.js";
import ElementSearch from "./ElementSearch.jsx";

const BLOCK_VAR = {
  s: "var(--color-block-s)",
  p: "var(--color-block-p)",
  d: "var(--color-block-d)",
  f: "var(--color-block-f)",
};

const BLOCK_LABEL = { s: "s-block", p: "p-block", d: "d-block", f: "f-block" };

function cellPosition(el) {
  if (el.block === "f") {
    const seriesStart = el.atomicNumber < 90 ? 58 : 90;
    const column = 3 + (el.atomicNumber - seriesStart);
    const row = el.atomicNumber < 90 ? 9 : 10;
    return { gridColumn: column, gridRow: row };
  }
  return { gridColumn: el.group, gridRow: el.period };
}

export default function PeriodicTableSelector({ selectedAtomicNumber, onSelect, compact = false }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ElementSearch onSelect={onSelect} />
        <div className="flex flex-wrap gap-3">
          {Object.entries(BLOCK_LABEL).map(([block, label]) => (
            <span key={block} className="flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: BLOCK_VAR[block] }}
                aria-hidden="true"
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        className={`grid gap-1 overflow-x-auto ${compact ? "min-w-[560px]" : "min-w-[720px]"}`}
        style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}
        role="grid"
        aria-label="Periodic table element selector"
      >
        {elements.map((el) => {
          const isSelected = el.atomicNumber === selectedAtomicNumber;
          return (
            <button
              key={el.atomicNumber}
              type="button"
              onClick={() => onSelect(el.atomicNumber)}
              style={{ ...cellPosition(el), borderColor: isSelected ? "var(--color-ink)" : undefined }}
              aria-pressed={isSelected}
              aria-label={`${el.name}, atomic number ${el.atomicNumber}, ${BLOCK_LABEL[el.block]}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-[3px] border text-[10px] transition-transform hover:z-10 hover:scale-110 ${
                isSelected
                  ? "border-2 bg-[var(--color-ink)] text-[var(--color-paper)]"
                  : "border-[var(--color-line)] text-[var(--color-ink)]"
              }`}
            >
              <span className="leading-none opacity-70">{el.atomicNumber}</span>
              <span className="text-[13px] font-medium leading-tight">{el.symbol}</span>
              {!isSelected && (
                <span
                  className="mt-0.5 h-[3px] w-3/5 rounded-full"
                  style={{ backgroundColor: BLOCK_VAR[el.block] }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
