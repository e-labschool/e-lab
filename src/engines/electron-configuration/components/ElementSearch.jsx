import { useId, useState } from "react";
import { Search } from "lucide-react";
import { searchElements } from "../../../data/chemistry/elements.js";

/** Combobox: type a name, symbol or atomic number; ArrowUp/Down move, Enter selects (the first result if none is highlighted), Escape closes. */
export default function ElementSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(true);
  const listId = useId();
  const results = query.trim() ? searchElements(query).slice(0, 6) : [];
  const showList = open && results.length > 0;
  const noMatch = query.trim() && results.length === 0;

  function choose(el) { onSelect(el.atomicNumber); setQuery(""); setActive(0); }
  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { if (results.length) { e.preventDefault(); choose(results[Math.min(active, results.length - 1)]); } }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  }

  return (
    <div className="relative w-full max-w-xs">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" aria-hidden="true" />
      <input
        type="text" role="combobox" aria-label="Search element by name, symbol or number" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }} onKeyDown={onKeyDown}
        placeholder="Search element, symbol or number" data-testid="ec-search"
        className="w-full rounded-md border border-[var(--color-line-strong,var(--color-line))] bg-transparent py-2 pl-8 pr-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-soft)] focus:border-[var(--color-indigo)] focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)]"
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] py-1 shadow-sm">
          {results.map((el, i) => (
            <li key={el.atomicNumber} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(el); }}
              className={"flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-[var(--color-ink)] " + (i === active ? "bg-[var(--color-indigo-soft)]" : "")}>
              <span>{el.name} ({el.symbol})</span><span className="text-[var(--color-ink-soft)]">Z={el.atomicNumber}</span>
            </li>
          ))}
        </ul>
      )}
      {noMatch && <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]" role="status">No element matches &ldquo;{query}&rdquo;.</p>}
    </div>
  );
}
