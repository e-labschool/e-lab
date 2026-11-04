export default function WhatChanged({ change }) {
  if (!change) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-line)] p-3 text-center text-xs text-[var(--color-ink-faint)]">
        Add or remove a particle to see what changes.
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: change.accentColor, backgroundColor: "var(--color-paper-raised)" }}>
      <p className="text-sm font-bold" style={{ color: change.accentColor }}>
        {change.headline}
      </p>
      <div className="mt-1 space-y-0.5 text-xs text-[var(--color-ink-soft)]">
        {change.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      {change.resultLine && <p className="mt-1.5 text-sm font-semibold text-[var(--color-ink)]">{change.resultLine}</p>}
    </div>
  );
}
