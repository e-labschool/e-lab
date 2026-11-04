import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { MOLECULES, searchMolecules } from "../model/molecules.js";

// Searchable molecule selector (ARIA combobox + listbox). Search matches the name, formula, condensed formula and common aliases.
export default function MoleculePicker({ value, onChange, compact = false, testId = "molecule-picker" }) {
  const id = useId(); const listId = `${id}-list`;
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const [active, setActive] = useState(0);
  const root = useRef(null); const input = useRef(null);
  const current = MOLECULES.find((m) => m.id === value) ?? MOLECULES[0];
  const results = useMemo(() => searchMolecules(query), [query]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!root.current?.contains(e.target)) { setOpen(false); setQuery(""); } };
    document.addEventListener("pointerdown", away); return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const choose = (m) => { onChange?.(m.id); setOpen(false); setQuery(""); input.current?.blur(); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); choose(results[active]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };
  return (
    <div className={`nm-picker${compact ? " nm-picker--compact" : ""}`} ref={root} data-testid={testId}>
      <label className="nm-picker-label" htmlFor={`${id}-in`}>Molecule</label>
      <div className="nm-picker-field">
        <Search size={14} aria-hidden="true" />
        <input id={`${id}-in`} ref={input} type="text" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off" spellCheck={false}
          value={open ? query : `${current.name}  ${current.formula}`} placeholder="Search name or formula…" onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }} onKeyDown={onKey} data-testid="molecule-search" />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label="Molecules" className="nm-picker-list" data-testid="molecule-list">
          {results.length === 0 && <li className="nm-picker-empty" role="presentation">No molecule matches “{query}”.</li>}
          {results.map((m, i) => (
            <li key={m.id} role="option" aria-selected={m.id === current.id} className={`nm-picker-opt${i === active ? " is-active" : ""}${m.id === current.id ? " is-current" : ""}`}
              onMouseEnter={() => setActive(i)} onPointerDown={(e) => { e.preventDefault(); choose(m); }} onClick={() => choose(m)} data-testid={`molecule-option-${m.id}`}>
              <span className="nm-picker-name">{m.name}</span><span className="nm-picker-formula">{m.condensed}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
