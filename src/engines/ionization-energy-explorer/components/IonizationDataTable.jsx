// Complete, never-truncated successive-IE data table for the current
// element -- the SAME array the graph plots, just presented as rows.
export default function IonizationDataTable({ element, values, currentStep }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
      <h3 className="border-b border-[var(--color-line)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
        Successive Ionization Energies of {element.name} / kJ mol&#8315;&#185;
      </h3>
      <div className="max-h-64 overflow-y-auto">
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
