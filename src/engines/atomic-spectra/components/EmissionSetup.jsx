// Simple, schematic emission apparatus diagram -- electrical excitation
// supplies energy to atoms in the vapour source, producing excited
// states that then emit radiation (never oversimplified as "heat
// becomes light directly"). Kept restrained: no cartoon sparks/bounce.
export default function EmissionSetup({ elementName, species }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Electrical excitation</p>
      <div className="text-[var(--color-amber)]" aria-hidden="true">{"\u2193"}</div>
      <div className="rounded-lg border-2 border-[var(--color-amber)] bg-gradient-to-b from-[#3a2d05] to-[#1a1400] px-6 py-3 text-center shadow-[0_0_18px_rgba(245,197,66,0.25)]">
        <p className="text-sm font-bold text-[#F5C542]">{elementName} vapour lamp</p>
        <p className="text-[10px] text-[#c9a94a]">{species}, electrically excited</p>
      </div>
      <p className="text-[10px] text-[var(--color-ink-faint)]">emitted radiation</p>
      <div className="text-[var(--color-ink-faint)]" aria-hidden="true">{"\u2193"}</div>
      <div className="rounded-md border border-[var(--color-line)] px-4 py-1.5 text-xs font-semibold text-[var(--color-ink-soft)]">Spectroscope</div>
      <div className="text-[var(--color-ink-faint)]" aria-hidden="true">{"\u2193"}</div>
    </div>
  );
}
