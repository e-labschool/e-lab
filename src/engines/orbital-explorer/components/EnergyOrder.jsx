import { energyOrderRows } from "../lib/electronConfigurations.js";
import { colorForOrbitalId } from "../lib/orbitalColors.js";

/** OE-06: the order in which subshells fill (lowest energy first), with the electrons each holds for this atom.
 *  Text and fill, not colour alone, say which subshells are occupied.  4s is lower than 3d in the neutral atom. */
export default function EnergyOrder({ z }) {
  const rows = energyOrderRows(z);
  return (
    <div data-testid="energy-order" className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Energy order (lowest first)</p>
      <ol className="flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="Subshells from lowest to highest energy">
        {rows.map((r, i) => (
          <li key={r.sublevel} className="flex items-center gap-1.5">
            <span data-occupied={r.electrons > 0 ? "1" : "0"} className={`rounded-md border px-2 py-0.5 font-semibold ${r.electrons > 0 ? "text-[var(--color-ink)]" : "border-dashed text-[var(--color-ink-faint)]"}`} style={r.electrons > 0 ? { borderColor: colorForOrbitalId(r.sublevel), boxShadow: `inset 0 -3px 0 ${colorForOrbitalId(r.sublevel)}` } : { borderColor: "var(--color-line)" }}>
              {r.sublevel} <span className="font-normal">{r.electrons > 0 ? `${r.electrons} e⁻` : "empty"}</span>
            </span>
            {i < rows.length - 1 && <span aria-hidden="true" className="text-[var(--color-ink-faint)]">{"<"}</span>}
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-[11px] text-[var(--color-ink-soft)]">4s is filled before 3d, so potassium and calcium have 4s electrons and no 3d. In transition-metal atoms the 4s and 3d energies are very close; Cr (4s{"¹"} 3d{"⁵"}) and Cu (4s{"¹"} 3d{"¹⁰"}) are the exceptions to plain filling order.</p>
    </div>
  );
}
