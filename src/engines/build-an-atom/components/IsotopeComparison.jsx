import { useState } from "react";
import { deriveAtom } from "../lib/atomState.js";

// Generates comparison rows by varying ONLY the neutron count, reusing
// the SAME deriveAtom() every other part of the simulation uses -- so
// "same element, different isotopes" is demonstrated with the real
// calculation, never separately-typed example text.
function comparisonRows(protons, currentNeutrons) {
  const neutronOptions = [...new Set([Math.max(0, currentNeutrons - 1), currentNeutrons, currentNeutrons + 1])];
  return neutronOptions.map((n) => deriveAtom({ protons, neutrons: n, electrons: protons }));
}

/** A compact overlay/popup (not an inline page-pushing expansion) --
 * opening it never shifts the rest of the simulation layout. */
export default function IsotopeComparison({ protons, neutrons }) {
  const [open, setOpen] = useState(false);
  if (protons === 0) return null;
  const rows = comparisonRows(protons, neutrons);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 w-full rounded-md border border-[var(--color-indigo)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">
        Compare Isotopes
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--color-ink)]">Compare Isotopes</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
                {"\u2715"}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {rows.map((r) => (
                <div key={r.massNumber} className="rounded-md bg-[var(--color-paper-raised)] p-2">
                  <p className="font-bold text-[var(--color-ink)]">{r.nuclideName}</p>
                  <p className="text-[var(--color-ink-faint)]">{r.protons} protons</p>
                  <p className="text-[var(--color-ink-faint)]">{r.neutrons} neutrons</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px]">
              <span style={{ color: "var(--color-teal)" }}>{"SAME \u2014 number of protons"}</span>
              <span style={{ color: "var(--color-violet)" }}>{"DIFFERENT \u2014 number of neutrons"}</span>
            </div>
            <p className="mt-1 text-center text-xs font-semibold text-[var(--color-ink)]">Same element, different isotopes.</p>
          </div>
        </div>
      )}
    </>
  );
}
