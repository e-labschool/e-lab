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

export default function IsotopeComparison({ protons, neutrons }) {
  const [open, setOpen] = useState(false);
  if (protons === 0) return null;
  const rows = comparisonRows(protons, neutrons);

  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-[var(--color-indigo)] hover:underline">
        {open ? "Hide isotope comparison" : "Compare Isotopes"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-[var(--color-line)] p-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {rows.map((r) => (
              <div key={r.massNumber} className="rounded-md bg-[var(--color-paper-raised)] p-2">
                <p className="font-bold text-[var(--color-ink)]">{r.nuclideName}</p>
                <p className="text-[var(--color-ink-faint)]">{r.protons} protons</p>
                <p className="text-[var(--color-ink-faint)]">{r.neutrons} neutrons</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px]">
            <span style={{ color: "var(--color-teal)" }}>{"SAME \u2014 number of protons"}</span>
            <span style={{ color: "var(--color-violet)" }}>{"DIFFERENT \u2014 number of neutrons"}</span>
          </div>
          <p className="mt-1 text-center text-xs font-semibold text-[var(--color-ink)]">Same element, different isotopes.</p>
        </div>
      )}
    </div>
  );
}
