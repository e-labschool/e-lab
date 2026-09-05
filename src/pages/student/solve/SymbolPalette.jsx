import { X } from "lucide-react";

const SYMBOLS = [
  "\u00d7", "\u00f7", "\u00b1", "\u2212", "\u2192", "\u21cc", "\u0394", "\u00b0", "\u00b7",
  "\u207b", "\u207a", "\u00b2", "\u00b3",
  "\u2080", "\u2081", "\u2082", "\u2083", "\u2084", "\u2085", "\u2086", "\u2087", "\u2088", "\u2089",
  "\u03b4", "\u03bb",
];

// Inserts at the currently focused input/textarea's cursor position where
// technically possible (selectionStart/End are supported), falling back
// to appending at the end otherwise (e.g. a control that doesn't expose
// selection, like some mobile keyboards) — never silently doing nothing.
export function insertAtCursor(target, symbol) {
  if (!target || (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT")) return null;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const next = target.value.slice(0, start) + symbol + target.value.slice(end);
  const nextCursor = start + symbol.length;
  return { value: next, cursor: nextCursor };
}

export default function SymbolPalette({ onSelect, onClose }) {
  return (
    <div className="w-full max-w-xs rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Symbols</p>
        <button type="button" onClick={onClose} aria-label="Close symbols" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {SYMBOLS.map((s) => (
          <button
            key={s} type="button" onClick={() => onSelect(s)} aria-label={`Insert ${s}`}
            className="rounded-md border border-[var(--color-line)] py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)] hover:text-[var(--color-indigo)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
