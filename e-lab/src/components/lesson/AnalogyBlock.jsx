import { Lightbulb, Info } from "lucide-react";

// "Think of it like this…" — visually and structurally distinct from
// ScientificExplanation so a student can never mistake an analogy for the
// scientific reality it's illustrating. `notice` (e.g. "Analogy — not a
// literal representation of matter") is always shown, never optional.
export function AnalogyBlock({ heading = "Think of it like this…", body, notice }) {
  return (
    <div className="rounded-lg border border-[var(--color-amber)]/30 bg-[var(--color-amber-soft)] p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-amber)]">
        <Lightbulb size={13} /> {heading}
      </p>
      <div className="mt-2.5 flex flex-col gap-2 text-sm leading-relaxed text-[var(--color-ink)]">
        {body.map((line, i) => <p key={i}>{line}</p>)}
      </div>
      {notice && (
        <p className="mt-3 border-t border-[var(--color-amber)]/25 pt-2.5 text-xs italic text-[var(--color-ink-faint)]">{notice}</p>
      )}
    </div>
  );
}

// A short "this is a simplified model, not literal reality" reminder,
// reused anywhere a scientific model could be mistaken for a photograph
// of reality (e.g. particle scenes, the zoom sequence).
export function ModelNotice({ children }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-ink-faint)]">
      <Info size={13} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
