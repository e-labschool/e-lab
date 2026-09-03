// A reaction energy-profile: reactants level -> (optional activation hump)
// -> products level, on the correct axes (x = reaction coordinate,
// y = potential energy), with delta-H bracketed and labelled. Reused for
// simple two-level R1.1/R1.2 profiles and (via the optional hump) for
// catalysed/uncatalysed comparisons later.
const W = 300, H = 180, PAD_L = 40, PAD_B = 26, PAD_T = 14, PAD_R = 20;

export default function EnergyProfile({ reactantsEnergy, productsEnergy, hasHump = false, humpEnergy, catalysedHumpEnergy, label }) {
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const maxE = Math.max(reactantsEnergy, productsEnergy, humpEnergy ?? 0, catalysedHumpEnergy ?? 0);
  const minE = Math.min(reactantsEnergy, productsEnergy);
  const yFor = (e) => H - PAD_B - ((e - minE) / (maxE - minE || 1)) * plotH * 0.85 - plotH * 0.1;

  const rY = yFor(reactantsEnergy), pY = yFor(productsEnergy);
  const x1 = PAD_L + plotW * 0.15, x2 = PAD_L + plotW * 0.85;
  const midX = (x1 + x2) / 2;

  const path = hasHump && humpEnergy != null
    ? `M ${x1} ${rY} Q ${midX} ${yFor(humpEnergy)} ${x2} ${pY}`
    : `M ${x1} ${rY} L ${x2} ${pY}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs text-[var(--color-ink)]" role="img" aria-label="Reaction energy profile">
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.25" />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.25" />

      <line x1={x1 - 8} y1={rY} x2={x1 + 10} y2={rY} stroke="currentColor" strokeWidth="1.5" />
      <line x1={x2 - 10} y1={pY} x2={x2 + 8} y2={pY} stroke="currentColor" strokeWidth="1.5" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {catalysedHumpEnergy != null && (
        <path d={`M ${x1} ${rY} Q ${midX} ${yFor(catalysedHumpEnergy)} ${x2} ${pY}`} fill="none" stroke="var(--color-teal)" strokeWidth="1.5" strokeDasharray="3 2" />
      )}

      <text x={x1} y={rY - 6} fontSize="8" textAnchor="middle" fill="currentColor">Reactants</text>
      <text x={x2} y={pY - 6} fontSize="8" textAnchor="middle" fill="currentColor">Products</text>

      {/* delta-H bracket */}
      <line x1={x2 + 12} y1={rY} x2={x2 + 12} y2={pY} stroke="var(--color-amber)" strokeWidth="1" />
      <line x1={x2 + 9} y1={rY} x2={x2 + 12} y2={rY} stroke="var(--color-amber)" strokeWidth="1" />
      <line x1={x2 + 9} y1={pY} x2={x2 + 12} y2={pY} stroke="var(--color-amber)" strokeWidth="1" />
      <text x={x2 + 15} y={(rY + pY) / 2 + 3} fontSize="8" fill="var(--color-amber)">ΔH</text>

      <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} fontSize="8" textAnchor="middle" fill="currentColor">Reaction coordinate</text>
      <text x={10} y={PAD_T + plotH / 2} fontSize="8" textAnchor="middle" fill="currentColor" transform={`rotate(-90 10 ${PAD_T + plotH / 2})`}>Potential energy</text>
      {label && <text x={midX} y={PAD_T} fontSize="8" textAnchor="middle" fill="currentColor">{label}</text>}
    </svg>
  );
}
