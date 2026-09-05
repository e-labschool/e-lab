import { X, BookOpen } from "lucide-react";

// No authorised IB data booklet file is configured in this project — this
// is the viewer ARCHITECTURE only, per the brief's explicit instruction
// not to scrape or reproduce copyrighted IB material. Once a legitimately
// provided file is configured (e.g. via Admin Resources), this component
// is where it would render; until then it says so honestly.
export default function DataBooklet({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Data Booklet</p>
          <button type="button" onClick={onClose} aria-label="Close data booklet" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>
        <div className="flex flex-col items-center gap-2 py-10">
          <BookOpen size={22} className="text-[var(--color-ink-faint)]" />
          <p className="text-sm font-medium text-[var(--color-ink)]">Data booklet not available</p>
          <p className="max-w-xs text-xs text-[var(--color-ink-faint)]">An authorised data booklet has not yet been configured for e-Lab.</p>
        </div>
      </div>
    </div>
  );
}
