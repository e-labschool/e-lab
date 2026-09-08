import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRIES } from "../../data/countries.js";

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";

/** A searchable, selectable country dropdown — type to filter, click or
 * arrow+Enter to select. Reused by signup and profile-edit forms so the
 * two never drift apart. */
export default function CountrySelect({ id, value, onChange, placeholder = "Select country" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [prevValue, setPrevValue] = useState(value);
  const containerRef = useRef(null);

  // Keeps the input text in sync when the external value changes (e.g.
  // the parent form loads a saved profile) — adjusting state during
  // render itself, rather than in an effect, is the correct React
  // pattern for "derived state that should reset when a prop changes".
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value || "");
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(value || "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const filtered = query.trim()
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()))
    : COUNTRIES;

  function selectCountry(country) {
    onChange(country);
    setQuery(country);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          className={`${inputClasses} pr-8`}
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--color-ink-faint)]">No matching country</li>
          ) : (
            filtered.map((country) => (
              <li key={country}>
                <button
                  type="button"
                  onClick={() => selectCountry(country)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-indigo-soft)] ${
                    country === value ? "font-medium text-[var(--color-indigo)]" : "text-[var(--color-ink-soft)]"
                  }`}
                >
                  {country}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
