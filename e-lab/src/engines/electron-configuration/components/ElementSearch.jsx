import { useState } from "react";
import { Search } from "lucide-react";
import { searchElements } from "../../../data/chemistry/elements.js";

export default function ElementSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const results = query.trim() ? searchElements(query).slice(0, 6) : [];

  return (
    <div className="relative w-full max-w-xs">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search element, symbol or number"
        className="w-full rounded-md border border-[var(--color-line)] bg-transparent py-2 pl-8 pr-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-ink)]"
      />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] py-1 shadow-sm">
          {results.map((el) => (
            <li key={el.atomicNumber}>
              <button
                type="button"
                onClick={() => {
                  onSelect(el.atomicNumber);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)]"
              >
                <span>{el.name} ({el.symbol})</span>
                <span className="text-[var(--color-ink-faint)]">Z={el.atomicNumber}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
