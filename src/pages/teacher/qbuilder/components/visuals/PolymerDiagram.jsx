// Text-first polymer notation (monomer -> repeating unit, with a real
// unicode subscript n and the small-molecule byproduct for condensation
// polymers) rather than a full 2D skeletal-structure drawing engine —
// chemically accurate and fully sufficient for what these questions
// actually assess (recognizing monomer/repeat-unit/byproduct), without
// building a general organic-structure renderer.
export default function PolymerDiagram({ mode = "addition", monomerText, repeatingUnitText, byproductText }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-line)] px-4 py-3 font-[var(--font-mono)] text-sm text-[var(--color-ink)]">
      <span>{monomerText}</span>
      <span className="text-[var(--color-ink-faint)]">&rarr;</span>
      <span>{repeatingUnitText}</span>
      {mode === "condensation" && byproductText && (
        <span className="text-[var(--color-ink-soft)]">+ {byproductText}</span>
      )}
    </div>
  );
}
