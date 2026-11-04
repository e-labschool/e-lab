import { B0_MAX } from "../physics/constants.js";
import { fieldReadouts } from "../physics/fieldModel.js";

/**
 * Spin energy levels of a proton. p (0..1) is the progress of switching B0 on: at 0 the alpha and beta levels coincide (degenerate); as p grows
 * they separate by dE = h nu0 (drawn in proportion to B0, NOT to scale with kT). The bars are the populations (real, or the labelled exaggeration).
 */
export default function LevelsDiagram({ b0, p, polarization, exaggerated }) {
  const r = fieldReadouts(b0);
  const mid = 168; const half = p * (14 + (b0 / B0_MAX) * 72);
  const yA = mid + half; const yB = mid - half;
  const x0 = 96; const x1 = 292;
  const fa = (1 + polarization) / 2; const fb = (1 - polarization) / 2;
  const split = half > 5;
  const bAmp = p * (24 + (b0 / B0_MAX) * 118);
  return (
    <svg className="ss-levels" viewBox="0 0 470 340" preserveAspectRatio="xMidYMid meet" role="img" data-testid="levels-diagram" data-p={p.toFixed(2)} data-gap={(yA - yB).toFixed(1)}
      aria-label={split ? `Energy levels of a proton in B0 = ${r.text.b0}: the lower alpha level and the upper beta level are separated by delta E equals h nu zero, with nu zero = ${r.text.nu0}` : "Energy levels of a proton with no magnetic field: the alpha and beta levels have the same energy"}>
      <defs><marker id="ss-lv-arr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="context-stroke" /></marker></defs>
      <text x="12" y="20" className="ss-svgtext ss-svgtext--b">Energy</text>
      <line x1="30" x2="30" y1="316" y2="30" className="ss-axis" markerEnd="url(#ss-lv-arr)" stroke="var(--ss-axis)" />
      {/* B0 gauge */}
      <g data-testid="b0-gauge">
        <line x1="56" x2="56" y1="316" y2={316 - Math.max(0.01, bAmp)} stroke="var(--ss-b0)" strokeWidth="5" markerEnd={bAmp > 8 ? "url(#ss-lv-arr)" : undefined} opacity={0.25 + 0.75 * p} />
        <text x="46" y="334" className="ss-svgtext ss-svgtext--b" fill="var(--ss-b0)">B₀</text>
        <text x="64" y={316 - Math.max(0.01, bAmp) + 4} className="ss-svgtext ss-svgtext--sm" fill="var(--ss-b0)" opacity={p}>{r.text.b0}</text>
      </g>
      {/* levels */}
      {split ? (
        <>
          <line x1={x0} x2={x1} y1={yB} y2={yB} stroke="var(--ss-beta)" strokeWidth="5" strokeLinecap="round" data-testid="level-beta" />
          <line x1={x0} x2={x1} y1={yA} y2={yA} stroke="var(--ss-alpha)" strokeWidth="5" strokeLinecap="round" data-testid="level-alpha" />
          <text x={x0} y={yB - 10} className="ss-svgtext ss-svgtext--b" fill="var(--ss-beta)">β  (m = −½)  higher energy</text>
          <text x={x0} y={yA + 22} className="ss-svgtext ss-svgtext--b" fill="var(--ss-alpha)">α  (m = +½)  lower energy</text>
          <g opacity={Math.min(1, p * 1.4)} data-testid="delta-e">
            <line x1={x1 - 24} x2={x1 - 24} y1={yA - 4} y2={yB + 4} stroke="var(--ss-ink)" strokeWidth="2" markerStart="url(#ss-lv-arr)" markerEnd="url(#ss-lv-arr)" />
            <text x={x1 - 32} y={(yA + yB) / 2 + 5} textAnchor="end" className="ss-svgtext ss-svgtext--b" data-testid="delta-e-label">ΔE = hν₀</text>
          </g>
          {/* populations */}
          <g data-testid="pop-bars">
            <rect x={x1 + 14} y={yB - 5} width={100 * fb} height="10" rx="3" fill="var(--ss-beta)" data-testid="bar-beta" />
            <rect x={x1 + 14} y={yA - 5} width={100 * fa} height="10" rx="3" fill="var(--ss-alpha)" data-testid="bar-alpha" />
            <text x={x1 + 14} y={yB - 10} className="ss-svgtext ss-svgtext--sm">N<tspan baselineShift="sub" fontSize="8">β</tspan>{exaggerated ? ` ≈ ${(fb * 100).toFixed(0)} %` : " ≈ half"}</text>
            <text x={x1 + 14} y={yA + 20} className="ss-svgtext ss-svgtext--sm">N<tspan baselineShift="sub" fontSize="8">α</tspan>{exaggerated ? ` ≈ ${(fa * 100).toFixed(0)} %` : " ≈ half, a little more"}</text>
          </g>
        </>
      ) : (
        <>
          <line x1={x0} x2={x1} y1={mid} y2={mid} stroke="var(--ss-neutral)" strokeWidth="5" strokeLinecap="round" data-testid="level-degenerate" />
          <text x={x0} y={mid - 14} className="ss-svgtext ss-svgtext--b">α and β: the same energy</text>
          <text x={x0} y={mid + 24} className="ss-svgtext ss-svgtext--sm">no field (B₀ = 0): the two spin states are degenerate</text>
        </>
      )}
      <text x={x0} y="320" className="ss-svgtext ss-svgtext--sm" opacity={split ? 1 : 0.4}>{`ν₀ = γB₀/2π = ${r.text.nu0}`}</text>
      <text x={x0} y="336" className="ss-svgtext ss-svgtext--sm" opacity={split ? 1 : 0.4}>{`ΔE = ${r.text.dE}`}</text>
    </svg>
  );
}
