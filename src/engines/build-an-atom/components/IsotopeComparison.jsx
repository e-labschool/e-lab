import { useEffect, useRef, useState } from "react";
import { deriveAtom } from "../lib/atomState.js";
import { comparisonIsotopesFor, hasCuratedCoverage, neutronRange } from "../data/nuclides.js";

function comparisonRows(protons, electrons) {
  return comparisonIsotopesFor(protons).map((iso) => ({
    ...deriveAtom({ protons, neutrons: iso.massNumber - protons, electrons }),
    stability: iso.stability,
    halfLife: iso.halfLifeLabel,
  }));
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** "Compare Isotopes" dialog: role=dialog, aria-modal, Escape closes, Tab is kept inside, focus returns to the opener. */
export default function IsotopeComparison({ protons, electrons }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    const opener = openerRef.current;
    return () => { document.removeEventListener("keydown", onKey, true); opener?.focus?.(); };
  }, [open]);

  if (protons === 0 || !hasCuratedCoverage(protons)) return null;
  const rows = comparisonRows(protons, electrons);
  const range = neutronRange(protons);
  const name = rows[0]?.element?.name ?? "this element";

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)} className="mt-2 w-full rounded-md border border-[var(--color-indigo)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">
        Compare Isotopes
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)} data-testid="isotope-backdrop">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="iso-compare-title" className="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p id="iso-compare-title" className="text-sm font-bold text-[var(--color-ink)]">Compare isotopes of {name.toLowerCase()}</p>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded px-1.5 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">{"✕"}</button>
            </div>
            <div className="mt-3 grid gap-2 text-center text-xs" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 3)}, minmax(0, 1fr))` }}>
              {rows.map((r) => (
                <div key={r.massNumber} className="rounded-md bg-[var(--color-paper-raised)] p-2">
                  <p className="font-bold text-[var(--color-ink)]">{r.nuclideName}</p>
                  <p className="text-[var(--color-ink-soft)]">{r.protons} protons</p>
                  <p className="text-[var(--color-ink-soft)]">{r.neutrons} neutrons</p>
                  <p className="mt-0.5 font-semibold" style={{ color: r.stability === "stable" ? "var(--color-teal)" : "var(--color-coral)" }}>
                    {r.stability === "stable" ? "Stable" : `Radioactive (${r.halfLife})`}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px]">
              <span style={{ color: "var(--color-teal)" }}>{"SAME — number of protons"}</span>
              <span style={{ color: "var(--color-violet)" }}>{"DIFFERENT — number of neutrons"}</span>
            </div>
            <p className="mt-1 text-center text-xs font-semibold text-[var(--color-ink)]">Same element, different isotopes.</p>
            <p className="mt-2 text-center text-[11px] text-[var(--color-ink-soft)]">
              A selection: all stable isotopes plus the longest-lived radioactive ones. {name} isotopes known to science run from {name.toLowerCase()}-{range.minA} to {name.toLowerCase()}-{range.maxA} (NUBASE2020).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
