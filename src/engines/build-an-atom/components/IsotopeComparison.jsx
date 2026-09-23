import { useState } from "react";
import { deriveAtom } from "../lib/atomState.js";
import { curatedIsotopesFor, hasCuratedCoverage } from "../data/nuclides.js";

// Draws comparison rows from the CURATED isotope list for this element
// (never an arbitrary +/-1 neutron guess), reusing the same
// deriveAtom() every other part of the simulation uses for each row's
// nuclide name.
function comparisonRows(protons, electrons) {
  return curatedIsotopesFor(protons).map((iso) => ({
    ...deriveAtom({ protons, neutrons: iso.massNumber - protons, electrons }),
    stability: iso.stability,
  }));
}

export default function IsotopeComparison({ protons, electrons }) {
  const [open, setOpen] = useState(false);
  if (protons === 0 || !hasCuratedCoverage(protons)) return null;
  const rows = comparisonRows(protons, electrons);

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
            <div className="mt-3 grid gap-2 text-center text-xs" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 3)}, minmax(0, 1fr))` }}>
              {rows.map((r) => (
                <div key={r.massNumber} className="rounded-md bg-[var(--color-paper-raised)] p-2">
                  <p className="font-bold text-[var(--color-ink)]">{r.nuclideName}</p>
                  <p className="text-[var(--color-ink-faint)]">{r.protons} protons</p>
                  <p className="text-[var(--color-ink-faint)]">{r.neutrons} neutrons</p>
                  <p className="mt-0.5 font-semibold" style={{ color: r.stability === "stable" ? "var(--color-teal)" : "var(--color-coral)" }}>
                    {r.stability === "stable" ? "Stable" : "Radioactive"}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px]">
              <span style={{ color: "var(--color-teal)" }}>{"SAME \u2014 number of protons"}</span>
              <span style={{ color: "var(--color-violet)" }}>{"DIFFERENT \u2014 number of neutrons"}</span>
            </div>
            <p className="mt-1 text-center text-xs font-semibold text-[var(--color-ink)]">Same element, different isotopes.</p>
            <p className="mt-2 text-center text-[10px] text-[var(--color-ink-faint)]">
              Shows the nuclides of this element included in this simulation, not every known isotope.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
