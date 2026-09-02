import { Check, X } from "lucide-react";
import OrbitalBoxDiagram from "../components/OrbitalBoxDiagram.jsx";
import ShellDiagram from "../components/ShellDiagram.jsx";

export default function CheckStep({ config, answer, onRetry, onReveal, revealed }) {
  const rows = config.subshellsDisplayOrder.map((s) => {
    const key = `${s.n}-${s.l}`;
    const studentValue = answer[key] ?? 0;
    return { key, label: `${s.n}${["s", "p", "d", "f"][s.l]}`, correct: s.electrons, studentValue, isCorrect: studentValue === s.electrons };
  });
  const allCorrect = rows.every((r) => r.isCorrect);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Step 3 &middot; Check</p>
        <p className={`mt-1.5 text-sm ${allCorrect ? "text-[var(--color-teal)]" : "text-[var(--color-ink-soft)]"}`}>
          {allCorrect
            ? `That's the correct ground-state configuration for ${config.element.name}.`
            : "A few subshells don't match yet — compare below."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 text-sm">
            {r.isCorrect ? (
              <Check size={15} className="text-[var(--color-teal)]" />
            ) : (
              <X size={15} className="text-[var(--color-amber)]" />
            )}
            <span className="w-10 font-[var(--font-mono)] text-[var(--color-ink)]">{r.label}</span>
            <span className="text-[var(--color-ink-soft)]">
              you: {r.studentValue}{!r.isCorrect && revealed ? ` \u2192 correct: ${r.correct}` : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink)] hover:border-[var(--color-ink)]"
        >
          Reset & retry
        </button>
        {!allCorrect && !revealed && (
          <button type="button" onClick={onReveal} className="rounded-md border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink)] hover:border-[var(--color-ink)]">
            Reveal answer
          </button>
        )}
      </div>

      {(allCorrect || revealed) && (
        <div className="mt-2 grid gap-8 border-t border-[var(--color-line)] pt-6 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Orbital notation</p>
            <OrbitalBoxDiagram orbitals={config.orbitals} />
          </div>
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Shell diagram</p>
            <ShellDiagram shells={config.shells} protonCount={config.element.atomicNumber} />
          </div>
        </div>
      )}
    </div>
  );
}
