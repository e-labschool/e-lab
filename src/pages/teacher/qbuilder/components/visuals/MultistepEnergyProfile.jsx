// A multi-step reaction energy profile: a sequence of labelled energy
// levels (reactants, transition state(s), intermediate(s), products)
// connected by humps — generalizes EnergyProfile (which only handles a
// single reactants->products step) to 2-step and 3-step mechanisms, so
// the rate-determining step (the step with the largest individual
// barrier) can be visually identified.
const W = 340, H = 190, PAD_L = 30, PAD_B = 26, PAD_T = 14, PAD_R = 20;

export default function MultistepEnergyProfile({ points }) {
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const n = points.length;
  const energies = points.map((p) => p.energy);
  const maxE = Math.max(...energies), minE = Math.min(...energies);
  const xFor = (i) => PAD_L + (i / (n - 1)) * plotW;
  const yFor = (e) => H - PAD_B - ((e - minE) / (maxE - minE || 1)) * plotH * 0.85 - plotH * 0.08;

  let path = `M ${xFor(0)} ${yFor(points[0].energy)}`;
  for (let i = 1; i < n; i += 1) {
    const midX = (xFor(i - 1) + xFor(i)) / 2;
    const isRising = points[i].kind === "ts" || (points[i - 1].kind !== "ts" && points[i].energy > points[i - 1].energy);
    const controlY = isRising || points[i].kind === "ts" || points[i - 1].kind === "ts"
      ? yFor(Math.max(points[i - 1].energy, points[i].energy) + (maxE - minE) * 0.05)
      : (yFor(points[i - 1].energy) + yFor(points[i].energy)) / 2;
    path += ` Q ${midX} ${controlY} ${xFor(i)} ${yFor(points[i].energy)}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm text-[var(--color-ink)]" role="img" aria-label="Multi-step reaction energy profile">
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.25" />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.25" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(p.energy)} r={p.kind === "ts" ? "2" : "3"} fill={p.kind === "ts" ? "var(--color-coral)" : "currentColor"} />
          <text x={xFor(i)} y={yFor(p.energy) - 8} fontSize="7.5" textAnchor="middle" fill={p.kind === "ts" ? "var(--color-coral)" : "currentColor"}>{p.label}</text>
        </g>
      ))}
      <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} fontSize="8" textAnchor="middle" fill="currentColor">Reaction coordinate</text>
      <text x={8} y={PAD_T + plotH / 2} fontSize="8" textAnchor="middle" fill="currentColor" transform={`rotate(-90 8 ${PAD_T + plotH / 2})`}>Potential energy</text>
    </svg>
  );
}
