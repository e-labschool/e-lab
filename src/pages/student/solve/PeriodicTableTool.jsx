import { useState } from "react";
import { X } from "lucide-react";
import PeriodicTableSelector from "../../../engines/electron-configuration/components/PeriodicTableSelector.jsx";
import elements from "../../../data/chemistry/elements.js";

// Reuses the EXISTING periodic table component and element dataset
// (already used by the electron-configuration engine) rather than
// building a second one — here it's a reference lookup during a
// challenge, not an electron-configuration exercise, so "selecting" an
// element just shows its basic real data instead of driving any
// configuration logic.
export default function PeriodicTableTool({ onClose }) {
  const [selectedAtomicNumber, setSelectedAtomicNumber] = useState(null);
  const element = elements.find((e) => e.atomicNumber === selectedAtomicNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Periodic Table</p>
          <button type="button" onClick={onClose} aria-label="Close periodic table" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>

        {element && (
          <div className="mb-3 flex items-center gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-indigo-soft)] px-4 py-2.5">
            <span className="text-lg font-bold text-[var(--color-indigo)]">{element.symbol}</span>
            <span className="text-sm text-[var(--color-ink)]">{element.name} &middot; Z={element.atomicNumber} &middot; Period {element.period}{element.group ? ` \u00b7 Group ${element.group}` : ""}</span>
          </div>
        )}

        <PeriodicTableSelector selectedAtomicNumber={selectedAtomicNumber} onSelect={setSelectedAtomicNumber} compact />
      </div>
    </div>
  );
}
