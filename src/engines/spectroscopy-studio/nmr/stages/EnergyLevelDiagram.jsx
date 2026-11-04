import { B0_MAX, K_BOLTZMANN, TEMPERATURE_K, energyGapEV, energyGapJ, larmorMHz, sci } from "../physics/constants.js";
import { useSize } from "../../components/useSize.js";

/**
 * Spin energy levels. Left: the Zeeman fan  E(alpha) = -gamma hbar B0 / 2,  E(beta) = +gamma hbar B0 / 2  against B0 (cursor = the field used).
 * Right: the two levels at the cursor with the gap Delta E = h nu0 and the populations as bars.
 * Scale note (also printed): the gap is vastly smaller than kT, so the drawn spacing is not to scale with thermal energy.
 */
export default function EnergyLevelDiagram({ b0, applyP = 1, alphaFrac, betaFrac, popLabel, populationsText, labels = true }) {
  const [ref, { width: W, height: H }] = useSize();
  const w = Math.max(240, W); const h = Math.max(220, H);
  const split = w < 380;
  const fanW = split ? w : Math.round(w * 0.46); const levelsX0 = split ? 0 : fanW;
  const top = 26; const bottom = h - 40; const midY = (top + bottom) / 2; const halfMax = (bottom - top) / 2 - 6;
  const bEff = b0 * applyP;
  const yOf = (sign, b) => midY - sign * (b / B0_MAX) * halfMax;
  const fanL = 40; const fanR = fanW - 12; const bx = (b) => fanL + (b / B0_MAX) * (fanR - fanL);
  const lx0 = (split ? 20 : levelsX0 + 18); const lx1 = (split ? w - 20 : w - 14);
  const yA = yOf(-1, bEff); const yB = yOf(1, bEff);
  const gapJ = energyGapJ(b0); const ktJ = K_BOLTZMANN * TEMPERATURE_K;
  const barMax = (lx1 - lx0) * 0.5;
  return (
    <div className="ss-energy" ref={ref} data-testid="energy-diagram">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Energy levels of a proton spin in the field B0 = ${b0.toFixed(1)} tesla: the lower alpha level and the upper beta level are separated by h times the resonance frequency, ${larmorMHz(b0).toFixed(1)} megahertz`}>
        <text x={fanL} y="14" className="ss-svgtext ss-svgtext--sm">Energy</text>
        <line x1={fanL} x2={fanR} y1={midY} y2={midY} className="ss-axis" strokeDasharray="3 4" />
        <line x1={fanL} x2={fanL} y1={top} y2={bottom} className="ss-axis" />
        <line x1={fanL} y1={midY} x2={bx(B0_MAX)} y2={yOf(1, B0_MAX)} stroke="var(--ss-beta)" strokeWidth="2" />
        <line x1={fanL} y1={midY} x2={bx(B0_MAX)} y2={yOf(-1, B0_MAX)} stroke="var(--ss-alpha)" strokeWidth="2" />
        <line x1={bx(bEff)} x2={bx(bEff)} y1={top} y2={bottom} stroke="var(--ss-b0)" strokeDasharray="4 4" />
        <circle cx={bx(bEff)} cy={yB} r="4.5" fill="var(--ss-beta)" stroke="#fff" /><circle cx={bx(bEff)} cy={yA} r="4.5" fill="var(--ss-alpha)" stroke="#fff" />
        {[0, 7, 14].map((t) => <g key={t}><line x1={bx(t)} x2={bx(t)} y1={bottom} y2={bottom + 4} className="ss-axis" /><text x={bx(t)} y={bottom + 16} textAnchor="middle" className="ss-tick">{t}</text></g>)}
        <text x={(fanL + fanR) / 2} y={bottom + 31} textAnchor="middle" className="ss-axis-label">B₀ (T)</text>
        <text x={fanL + 6} y={midY - 4} className="ss-svgtext ss-svgtext--sm">B₀ = 0: no gap</text>

        <g transform={split ? `translate(0 0)` : undefined}>
          <line x1={lx0} x2={lx1} y1={yB} y2={yB} stroke="var(--ss-beta)" strokeWidth="4" strokeLinecap="round" data-testid="level-beta" />
          <line x1={lx0} x2={lx1} y1={yA} y2={yA} stroke="var(--ss-alpha)" strokeWidth="4" strokeLinecap="round" data-testid="level-alpha" />
          {labels && <text x={lx0} y={yB - 8} className="ss-svgtext" fill="var(--ss-beta)">β  (m = −½)  higher energy</text>}
          {labels && <text x={lx0} y={yA + 18} className="ss-svgtext" fill="var(--ss-alpha)">α  (m = +½)  lower energy</text>}
          {applyP > 0.15 && (
            <g>
              <line x1={lx1 - 28} x2={lx1 - 28} y1={yA - 3} y2={yB + 3} stroke="var(--ss-ink)" strokeWidth="1.5" markerStart="url(#ss-arr)" markerEnd="url(#ss-arr)" />
              <text x={lx1 - 34} y={(yA + yB) / 2 + 4} textAnchor="end" className="ss-svgtext ss-svgtext--b" data-testid="delta-e-label">ΔE = hν₀</text>
            </g>
          )}
          <rect x={lx0} y={yB + 12} width={barMax * 2 * (betaFrac ?? 0.5)} height="9" rx="3" fill="var(--ss-beta)" opacity="0.85" data-testid="bar-beta" />
          <rect x={lx0} y={yA - 24} width={barMax * 2 * (alphaFrac ?? 0.5)} height="9" rx="3" fill="var(--ss-alpha)" opacity="0.85" data-testid="bar-alpha" />
          <text x={lx0 + barMax * 2 * (betaFrac ?? 0.5) + 6} y={yB + 20} className="ss-svgtext ss-svgtext--sm">{popLabel?.beta}</text>
          <text x={lx0 + barMax * 2 * (alphaFrac ?? 0.5) + 6} y={yA - 16} className="ss-svgtext ss-svgtext--sm">{popLabel?.alpha}</text>
        </g>
        <defs><marker id="ss-arr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="var(--ss-ink)" /></marker></defs>
      </svg>
      <div className="ss-energy-notes">
        <p data-testid="energy-values"><b>ν₀ = γB₀/2π = {larmorMHz(b0).toFixed(1)} MHz</b> · ΔE = hν₀ = {sci(gapJ, 2)} J ({(energyGapEV(b0) * 1e6).toFixed(2)} µeV)</p>
        <p className="ss-hint">ΔE is only {sci(gapJ / ktJ, 1)} of kT at {TEMPERATURE_K} K ({sci(ktJ, 2)} J): thermal motion keeps both levels almost equally full. Level spacing is drawn ∝ B₀, not to scale with kT. {populationsText}</p>
      </div>
    </div>
  );
}
