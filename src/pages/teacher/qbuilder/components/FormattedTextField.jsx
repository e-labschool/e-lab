import { useRef } from "react";
import SymbolToolbar from "./SymbolToolbar.jsx";

export default function FormattedTextField({ label, value, onChange, rows = 4, placeholder }) {
  const textareaRef = useRef(null);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</label>
      <SymbolToolbar textareaRef={textareaRef} value={value} onChange={onChange} />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-b-md border border-[var(--color-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-ink)]"
      />
    </div>
  );
}
