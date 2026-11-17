import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { LIBRARY_CATEGORIES, LIBRARY_SIZE, searchLibrary } from "../../../lib/lewis/index.js";
import { HtmlSubs } from "./subs.jsx";

/**
 * "Molecules" button + searchable list. Picking an entry places its atoms (the student can then watch them bond).
 * Keyboard: Enter / Space opens, type to search, ArrowDown / ArrowUp move through the list, Enter picks, Escape closes.
 */
export default function MoleculePicker({ onPick, beyond }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null); const inputRef = useRef(null); const btnRef = useRef(null); const listRef = useRef(null);
  const items = useMemo(() => searchLibrary(query, cat), [query, cat]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const down = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open]);
  useEffect(() => { setActive(0); }, [query, cat]);
  useEffect(() => { listRef.current?.querySelector('[data-active="1"]')?.scrollIntoView?.({ block: "nearest" }); }, [active, open]);

  const close = () => { setOpen(false); btnRef.current?.focus(); };
  const pick = (e) => { onPick(e); setOpen(false); setQuery(""); };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); pick(items[active]); }
  };

  return (
    <div className="bv-picker" ref={rootRef} data-testid="molecule-picker">
      <button type="button" ref={btnRef} className="bv-picker-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="picker-button" title="Choose a molecule or ion: its atoms are placed so you can watch them bond">
        <Search size={14} aria-hidden="true" /> <span>Pick a molecule</span> <span className="bv-picker-count">{LIBRARY_SIZE}</span> <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="bv-picker-pop" data-testid="picker-panel" onKeyDown={onKey}>
          <label className="bv-search bv-picker-search">
            <Search size={14} aria-hidden="true" />
            <input ref={inputRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or formula: water, CO2, ammonium, SO4..." aria-label="Search molecules and ions" aria-controls="bv-picker-list" aria-activedescendant={items[active] ? `bv-pick-${active}` : undefined} data-testid="picker-search" autoComplete="off" />
          </label>
          <div className="bv-picker-cats" role="group" aria-label="Category">
            {LIBRARY_CATEGORIES.map((c) => <button key={c.id} type="button" className="bv-picker-cat" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} data-testid={`picker-cat-${c.id}`}>{c.label}</button>)}
          </div>
          <ul className="bv-picker-list" id="bv-picker-list" role="listbox" aria-label={`${items.length} molecules`} ref={listRef} data-testid="picker-list">
            {items.map((e, i) => (
              <li key={e.id} role="option" aria-selected={i === active} id={`bv-pick-${i}`} data-active={i === active ? "1" : "0"}>
                <button type="button" tabIndex={-1} onClick={() => pick(e)} data-testid={`pick-${e.id}`} className="bv-pick-item">
                  <b className="bv-pick-formula"><HtmlSubs text={e.formula} /></b>
                  <span className="bv-pick-name">{e.name}</span>
                  {e.beyond && <span className="bv-ahl" title="Needs an expanded octet or an unpaired electron">HL</span>}
                  {!e.beyond && e.octetStructure && <span className="bv-ahl bv-ahl--soft" title="Also drawn with an expanded octet at HL">2 forms</span>}
                </button>
              </li>
            ))}
            {!items.length && <li className="bv-empty" data-testid="picker-empty">No molecule or ion matches. Add the atoms yourself: the app works out any combination it can.</li>}
          </ul>
          {beyond === false && <p className="bv-picker-note">Entries marked HL need "Beyond the course" (switched on automatically when you pick one).</p>}
        </div>
      )}
    </div>
  );
}
