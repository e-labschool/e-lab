// Compact first-20-elements grid, laid out in the conventional periodic
// table shape (with gaps where groups 3-12 would be, matching how H-Ca
// actually sit in the real table) rather than a plain 1-20 strip.
const ROWS = [
  [{ z: 1, col: 1 }, { z: 2, col: 18 }],
  [{ z: 3, col: 1 }, { z: 4, col: 2 }, { z: 5, col: 13 }, { z: 6, col: 14 }, { z: 7, col: 15 }, { z: 8, col: 16 }, { z: 9, col: 17 }, { z: 10, col: 18 }],
  [{ z: 11, col: 1 }, { z: 12, col: 2 }, { z: 13, col: 13 }, { z: 14, col: 14 }, { z: 15, col: 15 }, { z: 16, col: 16 }, { z: 17, col: 17 }, { z: 18, col: 18 }],
  [{ z: 19, col: 1 }, { z: 20, col: 2 }],
];

export default function ElementSelector({ elements, selectedZ, onSelect }) {
  const byZ = new Map(elements.map((e) => [e.atomicNumber, e]));
  return (
    <div className="flex flex-col gap-1">
      {ROWS.map((row, i) => (
        <div key={i} className="grid gap-1" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
          {row.map(({ z, col }) => {
            const el = byZ.get(z);
            if (!el) return null;
            return (
              <button
                key={z}
                type="button"
                onClick={() => onSelect(z)}
                aria-pressed={selectedZ === z}
                aria-label={`${el.name}, atomic number ${z}`}
                style={{ gridColumn: col }}
                className={`flex h-8 w-8 flex-col items-center justify-center rounded text-[11px] font-bold transition-colors ${
                  selectedZ === z ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-ink-soft)]"
                }`}
              >
                {el.symbol}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
