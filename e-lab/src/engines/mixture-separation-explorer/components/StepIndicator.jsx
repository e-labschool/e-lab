// A subtle progress indicator tracking the shared timeline -- shows
// what is CURRENTLY happening, never clickable (students don't drive
// the experiment by clicking steps). `steps` is an array of {label,
// start, end} windows (fractions of progress, matching the simulation's
// own phase windows) -- the active step is whichever window currently
// contains `progress`.
export default function StepIndicator({ steps, progress }) {
  const activeIndex = steps.findIndex((s) => progress >= s.start && progress < s.end);
  const effectiveIndex = activeIndex === -1 ? steps.length - 1 : activeIndex;

  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className={`text-[11px] font-medium transition-colors ${i === effectiveIndex ? "text-[var(--color-indigo)]" : i < effectiveIndex ? "text-[var(--color-ink-faint)]" : "text-[var(--color-ink-faint)] opacity-50"}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-[var(--color-ink-faint)] opacity-40">{"\u2192"}</span>}
        </div>
      ))}
    </div>
  );
}
