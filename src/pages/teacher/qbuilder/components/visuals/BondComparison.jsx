// Renders each stored bond with a conventional single/double/triple line
// representation, using ONLY the stored label + order — no additional
// chemical properties (bond length, strength, etc) are inferred or shown.
function OneBond({ label, order }) {
  const safeOrder = [1, 2, 3].includes(order) ? order : 1;
  const offsets = safeOrder === 1 ? [0] : safeOrder === 2 ? [-3, 3] : [-5, 0, 5];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 70 30" className="h-8 w-16 text-[var(--color-ink)]" role="img" aria-label={`Bond ${label ?? ""}, order ${safeOrder}`}>
        {offsets.map((off, i) => (
          <line key={i} x1="8" y1={15 + off} x2="62" y2={15 + off} stroke="currentColor" strokeWidth="2" />
        ))}
      </svg>
      <span className="text-xs font-medium text-[var(--color-ink)]">{label}</span>
    </div>
  );
}

export default function BondComparison({ bonds }) {
  const validBonds = bonds.filter((b) => b && typeof b === "object");

  return (
    <div className="flex flex-wrap items-end gap-6">
      {validBonds.map((b, i) => <OneBond key={i} label={b.label} order={b.order} />)}
    </div>
  );
}
