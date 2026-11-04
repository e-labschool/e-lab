// A real Maxwell-Boltzmann energy distribution — NOT a symmetric bell
// curve. Starts at the origin, rises to a peak, and has a long tail at
// high energy (modelled with a Maxwell-Boltzmann-shaped curve:
// f(E) = E * exp(-E/kT), which has exactly this asymptotic shape).
// Supports one or two curves (for comparing T1 vs T2): the higher-
// temperature curve is correctly lower and broader with its peak shifted
// right, and Ea is marked with the area beyond it shaded to represent the
// fraction of particles with sufficient energy to react.
const W = 320, H = 180, PAD_L = 20, PAD_B = 26, PAD_T = 10, PAD_R = 14;
const X_MAX = 10;

function curvePoints(temp, n = 80) {
  // f(E) proportional to E * exp(-E / temp) — peaks at E = temp, longer tail as temp increases.
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const E = (i / n) * X_MAX;
    const f = E * Math.exp(-E / temp);
    pts.push({ E, f });
  }
  // Normalize by AREA (trapezoidal integral), not by peak height — this is
  // what correctly makes a higher-temperature curve both broader AND
  // lower for the same number of particles (constant area under curve),
  // rather than every curve reaching the same peak height regardless of T.
  let area = 0;
  for (let i = 1; i < pts.length; i += 1) {
    area += ((pts[i].f + pts[i - 1].f) / 2) * (pts[i].E - pts[i - 1].E);
  }
  return pts.map((p) => ({ E: p.E, f: p.f / area }));
}

export default function MaxwellBoltzmannDistribution({ temps = [3], ea, labels = [] }) {
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const xFor = (E) => PAD_L + (E / X_MAX) * plotW;
  const yFor = (f) => H - PAD_B - f * plotH * 4.5;
  const colors = ["var(--color-indigo)", "var(--color-amber)"];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm text-[var(--color-ink)]" role="img" aria-label="Maxwell-Boltzmann energy distribution">
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.25" />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1.25" />

      {ea != null && (
        <>
          <line x1={xFor(ea)} y1={PAD_T} x2={xFor(ea)} y2={H - PAD_B} stroke="var(--color-coral)" strokeWidth="1" strokeDasharray="3 2" />
          <text x={xFor(ea)} y={PAD_T - 2} fontSize="8" textAnchor="middle" fill="var(--color-coral)">Ea</text>
        </>
      )}

      {temps.map((t, i) => {
        const pts = curvePoints(t);
        const path = pts.map((p, j) => `${j === 0 ? "M" : "L"} ${xFor(p.E)} ${yFor(p.f)}`).join(" ");
        const areaPts = ea != null ? pts.filter((p) => p.E >= ea) : [];
        const areaPath = areaPts.length > 1
          ? `M ${xFor(ea)} ${H - PAD_B} ` + areaPts.map((p) => `L ${xFor(p.E)} ${yFor(p.f)}`).join(" ") + ` L ${xFor(X_MAX)} ${H - PAD_B} Z`
          : null;
        return (
          <g key={i}>
            {areaPath && <path d={areaPath} fill={colors[i % colors.length]} opacity="0.18" />}
            <path d={path} fill="none" stroke={colors[i % colors.length]} strokeWidth="1.75" />
            {labels[i] && <text x={xFor(t * 1.3)} y={yFor(curvePoints(t).find((p) => Math.abs(p.E - t) < 0.2)?.f ?? 0.8) - 6} fontSize="8" fill={colors[i % colors.length]}>{labels[i]}</text>}
          </g>
        );
      })}

      <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} fontSize="8" textAnchor="middle" fill="currentColor">Kinetic energy</text>
      <text x={8} y={PAD_T + plotH / 2} fontSize="8" textAnchor="middle" fill="currentColor" transform={`rotate(-90 8 ${PAD_T + plotH / 2})`}>Fraction of particles</text>
    </svg>
  );
}
