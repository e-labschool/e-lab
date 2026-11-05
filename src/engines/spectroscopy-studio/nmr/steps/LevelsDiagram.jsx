import { B0_MAX } from "../physics/constants.js";
import { fieldReadouts } from "../physics/fieldModel.js";
import { stateFractions } from "../physics/rfPopulation.js";

const BAR = 150; // px per unit population fraction: equal populations (0.5) are 75 px long
const pct = (x) => `${Math.round(x * 100)} %`;

/**
 * Spin energy levels of a proton, shared by step 2 (switching B0 on) and step 3 (RF irradiation).
 *
 *  p (0..1)   progress of switching B0 on: at 0 alpha and beta coincide (degenerate); as p grows they separate by dE = h nu0
 *             (drawn in proportion to B0, NOT to scale with kT).
 *  polarization, exaggerated   the displayed equilibrium excess (real, or the labelled exaggeration) and whether it is exaggerated.
 *  rf  (step 3 only, else undefined)  { response (0..1, the continuous-wave response), region ("on"|"near"|"off"), offsetHz, d (alpha-beta
 *      difference relative to equilibrium after the irradiation so far), phase (display seconds, drives the dash flow) }
 *      The levels NEVER move with the RF; only the cues do: gap highlight, transition arrow (opacity = response), beta bar rising.
 */
export default function LevelsDiagram({ b0, p, polarization, exaggerated, rf }) {
  const r = fieldReadouts(b0);
  const mid = 176; const half = p * (14 + (b0 / B0_MAX) * 72);
  const yA = mid + half; const yB = mid - half;
  const x0 = 84; const x1 = 250; const xb = x1 + 12;
  const split = half > 5;
  const bAmp = p * (24 + (b0 / B0_MAX) * 118);
  const resp = rf ? rf.response : 0;
  const d = rf ? rf.d : 1;
  const fr = stateFractions(polarization, d);
  const bigBars = exaggerated || Boolean(rf);
  const xa = x0 + 22; // x of the transition arrow
  const dotT = rf ? (rf.phase * 0.55) % 1 : 0;
  const stateLine = !rf ? null : rf.region === "on" ? { t: "hν_RF = ΔE  (resonance)", c: "var(--ss-ok)" } : rf.region === "near" ? { t: "hν_RF ≈ ΔE  (partial match)", c: "var(--ss-warn)" } : { t: "hν_RF ≠ ΔE  (off resonance)", c: "var(--ss-muted)" };
  const label = split
    ? `Energy levels of a proton in B0 = ${r.text.b0}: the lower alpha level and the upper beta level are separated by delta E equals h nu zero, with nu zero = ${r.text.nu0}`
    : "Energy levels of a proton with no magnetic field: the alpha and beta levels have the same energy";
  return (
    <svg className={`ss-levels${rf ? " ss-levels--rf" : ""}`} viewBox={`0 0 380 ${rf ? 414 : 360}`} preserveAspectRatio="xMidYMid meet" role="img" data-testid="levels-diagram" data-p={p.toFixed(2)} data-gap={(yA - yB).toFixed(1)}
      data-region={rf ? rf.region : undefined} data-response={rf ? resp.toFixed(3) : undefined} data-d={rf ? d.toFixed(4) : undefined} aria-label={label}>
      <defs><marker id="ss-lv-arr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="context-stroke" /></marker></defs>
      <text x="6" y="18" className="ss-svgtext ss-svgtext--b">Energy</text>
      <line x1="24" x2="24" y1="332" y2="30" className="ss-axis" markerEnd="url(#ss-lv-arr)" stroke="var(--ss-axis)" />
      {/* the applied field, as a labelled arrow whose length follows B0 */}
      <g data-testid="b0-gauge">
        <line x1="48" x2="48" y1="332" y2={332 - Math.max(0.01, bAmp)} stroke="var(--ss-b0)" strokeWidth="5" markerEnd={bAmp > 8 ? "url(#ss-lv-arr)" : undefined} opacity={0.25 + 0.75 * p} data-testid="b0-arrow" />
        <text x="46" y="351" textAnchor="middle" className="ss-svgtext ss-svgtext--b" fill="var(--ss-b0)" opacity={0.35 + 0.65 * p}>{`B₀ = ${r.text.b0}`}</text>
      </g>
      {split ? (
        <>
          {rf && <rect x={x0} y={yB} width={x1 - x0} height={yA - yB} fill="var(--ss-rf)" opacity={0.2 * resp} data-testid="gap-highlight" data-opacity={(0.2 * resp).toFixed(3)} />}
          <line x1={x0} x2={x1} y1={yB} y2={yB} stroke="var(--ss-beta)" strokeWidth="5" strokeLinecap="round" data-testid="level-beta" />
          <line x1={x0} x2={x1} y1={yA} y2={yA} stroke="var(--ss-alpha)" strokeWidth="5" strokeLinecap="round" data-testid="level-alpha" />
          <text x={x0} y={yB - 10} className="ss-svgtext ss-svgtext--b" fill="var(--ss-beta)">β  (m = −½)  higher energy</text>
          <text x={x0} y={yA + 22} className="ss-svgtext ss-svgtext--b" fill="var(--ss-alpha)">α  (m = +½)  lower energy</text>
          <g opacity={Math.min(1, p * 1.4)} data-testid="delta-e">
            <line x1={x1 - 16} x2={x1 - 16} y1={yA - 4} y2={yB + 4} stroke={rf && rf.region === "on" ? "var(--ss-rf)" : "var(--ss-ink)"} strokeWidth={rf ? 2 + 2 * resp : 2} markerStart="url(#ss-lv-arr)" markerEnd="url(#ss-lv-arr)" />
            <text x={x1 - 25} y={(yA + yB) / 2 + 5} textAnchor="end" className="ss-svgtext ss-svgtext--b" data-testid="delta-e-label">ΔE = hν₀</text>
          </g>
          {rf && (
            <g data-testid="transition" data-opacity={resp.toFixed(3)}>
              {resp > 0.01 && (
                <>
                  <line x1={xa} x2={xa} y1={yA - 5} y2={yB + 15} stroke="var(--ss-rf)" strokeWidth={3 + 2.5 * resp} strokeDasharray="9 7" strokeDashoffset={-rf.phase * 36} opacity={Math.min(1, resp)} data-testid="transition-arrow" data-opacity={Math.min(1, resp).toFixed(3)} />
                  <polygon points={`${xa - 9},${yB + 17} ${xa + 9},${yB + 17} ${xa},${yB + 1}`} fill="var(--ss-rf)" opacity={Math.min(1, resp)} data-testid="transition-arrowhead" />
                  <circle cx={xa} cy={yA - 5 - (yA - yB - 20) * dotT} r="5.5" fill="#fff" stroke="var(--ss-rf)" strokeWidth="2.5" opacity={Math.min(1, resp * 1.5)} data-testid="transition-dot" />
                  <text x={xa + 14} y={(yA + yB) / 2 + 5} className="ss-svgtext ss-svgtext--b" fill="var(--ss-rf)" opacity={Math.min(1, resp * 1.4)}>α → β</text>
                </>
              )}
            </g>
          )}
          {/* populations (bars; their length is exaggerated whenever the picture says so) */}
          <g data-testid="pop-bars">
            <rect x={xb} y={yB - 5} width={BAR * fr.beta} height="10" rx="3" fill="var(--ss-beta)" data-testid="bar-beta" data-fraction={fr.beta.toFixed(6)} />
            <rect x={xb} y={yA - 5} width={BAR * fr.alpha} height="10" rx="3" fill="var(--ss-alpha)" data-testid="bar-alpha" data-fraction={fr.alpha.toFixed(6)} />
            {bigBars && <line x1={xb + BAR / 2} x2={xb + BAR / 2} y1={yB + 9} y2={yA - 9} stroke="var(--ss-muted)" strokeWidth="1.5" strokeDasharray="3 3" data-testid="equal-line" />}
            <text x={xb} y={yB - 12} className="ss-svgtext ss-svgtext--sm">N<tspan baselineShift="sub" fontSize="8">β</tspan>{rf ? (resp > 0.02 && d < 0.9995 ? " ↑ rising" : "") : exaggerated ? ` ≈ ${(fr.beta * 100).toFixed(0)} %` : " ≈ half"}</text>
            <text x={xb} y={yA + 22} className="ss-svgtext ss-svgtext--sm">N<tspan baselineShift="sub" fontSize="8">α</tspan>{rf ? "" : exaggerated ? ` ≈ ${(fr.alpha * 100).toFixed(0)} %` : " slightly more"}</text>
            {bigBars && <text x={xb + BAR / 2} y={(yA + yB) / 2 + 4} textAnchor="middle" className="ss-svgtext ss-svgtext--sm" fontSize="10">equal</text>}
          </g>
        </>
      ) : (
        <>
          <line x1={x0} x2={x1} y1={mid} y2={mid} stroke="var(--ss-neutral)" strokeWidth="5" strokeLinecap="round" data-testid="level-degenerate" />
          <text x={x0} y={mid - 14} className="ss-svgtext ss-svgtext--b">α and β: the same energy</text>
          <text x={x0} y={mid + 24} className="ss-svgtext ss-svgtext--sm">no field (B₀ = 0): the two spin states are degenerate</text>
        </>
      )}
      <g opacity={split ? 1 : 0.4} data-testid="larmor-block">
        <text x={x0} y="308" className="ss-svgtext ss-svgtext--b" fill="var(--ss-b0)">Larmor frequency (ν₀)</text>
        <text x={x0} y="324" className="ss-svgtext ss-svgtext--sm" data-testid="nu0-eq">{`ν₀ = γB₀/2π = ${r.text.nu0}`}</text>
        <text x={x0} y="340" className="ss-svgtext ss-svgtext--sm" data-testid="dE-eq">{`ΔE = hν₀ = ${r.text.dE}`}</text>
      </g>
      {rf && stateLine && (
        <>
          <text x={x0} y="360" className="ss-svgtext ss-svgtext--b" fill={stateLine.c} data-testid="photon-eq">{stateLine.t}</text>
          <text x={x0} y="377" className="ss-svgtext ss-svgtext--sm" data-testid="pop-caption">{`α − β excess left: ${pct(d)} of equilibrium`}</text>
          <text x={x0} y="392" className="ss-svgtext ss-svgtext--sm" data-testid="arrow-caption">Arrow: one nucleus (teaching model)</text>
          <text x={x0} y="407" className="ss-svgtext ss-svgtext--sm">Bars: difference exaggerated to be visible</text>
        </>
      )}
    </svg>
  );
}
