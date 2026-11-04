import { useSimulationPresentation } from "../../../components/interactive-shell/SimulationPresentation.js";

// Complete, never-truncated successive-IE data table for the current
// element -- the SAME array the graph plots, just presented as rows.
// In VIEWPORT mode (fullscreen/standalone) this card sits inside the left
// column's own `minmax(0,1fr)` grid row (see IonizationEnergyExplorer.jsx)
// and fills exactly that available height, scrolling internally -- this
// is the one panel the brief explicitly calls out as fine to scroll (e.g.
// Ca's 20 rows) precisely so the REST of the simulation never has to. In
// embedded mode it keeps its previous fixed `max-h-64` so normal Learn-
// page flow is unaffected.
export default function IonizationDataTable({ element, values, currentStep }) {
  const { isViewport } = useSimulationPresentation();
  return (
    <div className={isViewport ? "flex min-h-0 flex-1 flex-col rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)]" : "rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)]"}>
      <h3 className="shrink-0 border-b border-[var(--color-line)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
        Successive Ionization Energies of {element.name} / kJ mol&#8315;&#185;
      </h3>
      <div className={isViewport ? "min-h-0 flex-1 overflow-y-auto" : "max-h-64 overflow-y-auto"}>
        <table className="w-full text-xs">
          <tbody>
            {values.map((v, i) => {
              const step = i + 1;
              const isCurrent = step === currentStep;
              return (
                <tr key={step} className={isCurrent ? "bg-[var(--color-indigo-soft)]" : ""}>
                  <td className={`px-3 py-1.5 font-medium ${isCurrent ? "text-[var(--color-indigo)]" : "text-[var(--color-ink-faint)]"}`}>IE<sub>{step}</sub></td>
                  <td className={`px-3 py-1.5 text-right ${isCurrent ? "font-semibold text-[var(--color-indigo)]" : "text-[var(--color-ink)]"}`}>{v.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
