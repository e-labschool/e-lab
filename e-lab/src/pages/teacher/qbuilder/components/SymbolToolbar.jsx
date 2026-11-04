// A lightweight insert-at-cursor symbol toolbar — deliberately not a full
// rich-text/WYSIWYG editor. Covers the common chemistry formatting needs
// (subscript/superscript digits for formulae, charges, arrows, degree
// sign) without adding a heavy editor dependency. The underlying field
// stays a plain textarea, so swapping in a richer editor later (with
// image/table support) only means replacing this one component.
const SYMBOLS = [
  ["\u2080", "sub 0"], ["\u2081", "sub 1"], ["\u2082", "sub 2"], ["\u2083", "sub 3"], ["\u2084", "sub 4"],
  ["\u2085", "sub 5"], ["\u2086", "sub 6"],
  ["\u2070", "sup 0"], ["\u00b9", "sup 1"], ["\u00b2", "sup 2"], ["\u00b3", "sup 3"], ["\u2074", "sup 4"],
  ["\u207a", "sup +"], ["\u207b", "sup \u2212"],
  ["\u2192", "arrow"], ["\u21cc", "equilibrium"], ["\u0394", "delta"], ["\u00b0", "degree"],
  ["\u00b1", "plus-minus"], ["\u00d7", "times"], ["\u2022", "dot / radical"], ["\u03bc", "mu"],
];

export default function SymbolToolbar({ textareaRef, value, onChange }) {
  function insert(symbol) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${symbol}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + symbol.length;
    });
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-[var(--color-line)] bg-[var(--color-paper)] p-1.5">
      {SYMBOLS.map(([symbol, label]) => (
        <button
          key={label}
          type="button"
          title={label}
          onClick={() => insert(symbol)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-xs text-[var(--color-ink-soft)] hover:bg-[var(--color-indigo-soft)] hover:text-[var(--color-ink)]"
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
