import OrganicStructure from "./OrganicStructure.jsx";

// Two OrganicStructure diagrams (each using wedge/dash bonds around a
// chiral centre) either side of a mirror line — the standard way to show
// a pair of non-superimposable mirror images.
export default function EnantiomerPair({ left, right }) {
  return (
    <div className="flex items-center gap-4">
      <OrganicStructure atoms={left.atoms} bonds={left.bonds} label={left.label} />
      <div className="h-28 border-l border-dashed border-[var(--color-ink-faint)]" aria-hidden="true" />
      <OrganicStructure atoms={right.atoms} bonds={right.bonds} label={right.label} />
    </div>
  );
}
