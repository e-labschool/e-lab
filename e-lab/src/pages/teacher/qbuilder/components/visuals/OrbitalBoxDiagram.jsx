// Explicit, question-authored orbital-box notation (as opposed to the
// Electron Configuration Explorer's engine, which computes boxes from an
// atomic number). Here the exact box contents are part of the question
// data itself — including intentionally-incorrect diagrams used in
// "spot the error" questions (e.g. two same-spin arrows in one box).
function Box({ spins = [] }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center gap-[1px] rounded-sm border border-[var(--color-line)] text-xs">
      {spins.map((s, i) => (
        <span key={i} className="leading-none">{s === "up" ? "\u2191" : "\u2193"}</span>
      ))}
    </span>
  );
}

export default function OrbitalBoxDiagram({ subshells }) {
  return (
    <div className="flex flex-col gap-2">
      {subshells.map((s, i) => (
        <div key={i} className="flex items-center gap-2.5">
          {s.label && <span className="w-8 shrink-0 font-[var(--font-mono)] text-sm text-[var(--color-ink-soft)]">{s.label}</span>}
          <div className="flex gap-1">
            {s.boxes.map((b, j) => (
              <Box key={j} spins={b.spins} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
