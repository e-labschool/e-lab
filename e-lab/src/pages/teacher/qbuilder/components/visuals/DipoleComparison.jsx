// The stored data is only an array of bond-label strings (e.g. "H-F") —
// no electronegativity values or dipole magnitudes are stored, so none
// are invented or displayed. This renders the bonds side by side as a
// clean, clearly-labelled comparison for the student to reason about
// using their own chemistry knowledge, rather than the diagram doing the
// comparison for them with fabricated numbers.
export default function DipoleComparison({ bonds }) {
  const validBonds = bonds.filter((b) => typeof b === "string" && b.trim() !== "");

  return (
    <div className="flex flex-wrap items-center gap-4">
      {validBonds.map((bond, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5">
          <span className="font-mono text-sm font-semibold text-[var(--color-ink)]">{bond}</span>
        </div>
      ))}
    </div>
  );
}
