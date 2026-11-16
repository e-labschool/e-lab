import { useMemo, useRef } from "react";
import { densityCurve, fractionAbove, formatFraction, numericArea, arrheniusFactor } from "../lib/maxwellBoltzmann.js";
import { useBox } from "../useBox.js";
import { CURVE, SHADE, TEXT, MUTED } from "../theme.js";

export const XMAX = 70; // kJ/mol, fixed so the curve visibly moves and flattens with T
export const HIST_BIN = 2; // kJ/mol
const YMAX_FULL = 0.25; const YMAX_ZOOM = 0.03;

/**
 * Maxwell-Boltzmann distribution of molecular kinetic energies, in real units (kJ/mol, T in K).
 * The curve is the exact density; the shaded area is the EXACT fraction >= Ea (never summed over a truncated grid).
 * `hist` (optional) is the live kinetic-energy histogram of the particles in the vessel, drawn as bars under the curve.
 */
export default function MbGraph({ T, eaEff, ea, catalyst, hist, nParticles, measured, pinned, zoom, showHist }) {
  const wrap = useRef(null);
  const { w: W, h: H } = useBox(wrap, { w: 380, h: 230 });
  const padL = 54; const padR = 12; const padT = 10; const padB = 40;
  const pw = Math.max(40, W - padL - padR); const ph = Math.max(40, H - padT - padB);
  const ymax = zoom ? YMAX_ZOOM : YMAX_FULL;
  const x = (E) => padL + (E / XMAX) * pw;
  const y = (f) => padT + (1 - f / ymax) * ph;
  const curve = useMemo(() => densityCurve(T, XMAX, 280), [T]);
  const pinCurve = useMemo(() => (pinned ? densityCurve(pinned.T, XMAX, 280) : null), [pinned]);
  const area = useMemo(() => numericArea(T, 4000), [T]);
  const fracEff = fractionAbove(eaEff, T);
  const fracBase = fractionAbove(ea, T);
  const line = (c) => { let d = ""; for (let i = 0; i < c.E.length; i++) d += `${i ? "L" : "M"}${x(c.E[i]).toFixed(1)},${y(c.f[i]).toFixed(1)}`; return d; };
  const tail = (from) => {
    let d = `M${x(from).toFixed(1)},${y(0).toFixed(1)}`;
    const e0 = Math.min(from, XMAX);
    d += `L${x(e0).toFixed(1)},${y(densityAt(curve, e0)).toFixed(1)}`;
    for (let i = 0; i < curve.E.length; i++) if (curve.E[i] > e0) d += `L${x(curve.E[i]).toFixed(1)},${y(curve.f[i]).toFixed(1)}`;
    return `${d}L${x(XMAX).toFixed(1)},${y(0).toFixed(1)}Z`;
  };
  const yTicks = zoom ? [0, 0.01, 0.02, 0.03] : [0, 0.05, 0.1, 0.15, 0.2, 0.25];
  const xTicks = [0, 10, 20, 30, 40, 50, 60, 70];
  const bars = [];
  if (showHist && hist && nParticles > 0) {
    for (let b = 0; b < hist.length; b++) {
      const dens = hist[b] / (nParticles * HIST_BIN);
      if (dens <= 0) continue;
      bars.push(<rect key={b} x={x(b * HIST_BIN) + 0.5} y={y(Math.min(dens, ymax))} width={Math.max(1, x(HIST_BIN) - x(0) - 1)} height={Math.max(0, y(0) - y(Math.min(dens, ymax)))} fill="#9db6e8" fillOpacity="0.55" stroke="#4f6fb5" strokeWidth="0.8" />);
    }
  }
  const eaX = x(Math.min(eaEff, XMAX)); const baseX = x(Math.min(ea, XMAX));
  const label = `Maxwell-Boltzmann distribution at ${T} kelvin. Area under the curve is ${area.toFixed(3)}. Fraction of molecules with energy at least ${eaEff.toFixed(1)} kilojoules per mole: ${formatFraction(fracEff)}.`;
  return (
    <div className="ct-mb" data-testid="mb-graph">
      <div ref={wrap} className="ct-mb-plot">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} data-testid="mb-svg">
          <defs><clipPath id="ct-mb-clip"><rect x={padL} y={padT} width={pw} height={ph} /></clipPath></defs>
          {yTicks.map((f) => (
            <g key={f}>
              <line x1={padL} x2={padL + pw} y1={y(f)} y2={y(f)} stroke="#d6e0f2" strokeWidth="1" />
              <text x={padL - 6} y={y(f) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{f.toFixed(2)}</text>
            </g>
          ))}
          {xTicks.map((E) => (
            <g key={E}>
              <line x1={x(E)} x2={x(E)} y1={padT + ph} y2={padT + ph + 4} stroke={MUTED} />
              <text x={x(E)} y={padT + ph + 16} textAnchor="middle" fontSize="11" fill={MUTED}>{E}</text>
            </g>
          ))}
          <line x1={padL} x2={padL} y1={padT} y2={padT + ph} stroke={MUTED} />
          <line x1={padL} x2={padL + pw} y1={padT + ph} y2={padT + ph} stroke={MUTED} />
          <text x={padL + pw / 2} y={H - 6} textAnchor="middle" fontSize="12" fill={TEXT}>Kinetic energy, E / kJ mol{"⁻¹"}</text>
          <text transform={`translate(13 ${padT + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={TEXT}>{ph >= 175 ? "Fraction of molecules per kJ mol⁻¹" : ph >= 105 ? "Fraction per kJ mol⁻¹" : "Fraction"}</text>
          <g clipPath="url(#ct-mb-clip)">
            {bars}
            {catalyst && <path d={tail(eaEff)} fill={SHADE} fillOpacity="0.22" data-testid="mb-shade-cat" />}
            <path d={tail(catalyst ? ea : eaEff)} fill={SHADE} fillOpacity="0.55" data-testid="mb-shade" />
            {pinCurve && <path d={line(pinCurve)} fill="none" stroke="#5b6785" strokeWidth="1.8" strokeDasharray="5 4" />}
            <path d={line(curve)} fill="none" stroke={CURVE} strokeWidth="2.6" />
          </g>
          {catalyst && <><line x1={baseX} x2={baseX} y1={padT} y2={padT + ph} stroke="#5b6785" strokeDasharray="4 3" /><text x={baseX + 4} y={padT + 24} fontSize="11" fill="#5b6785">Ea</text></>}
          <line x1={eaX} x2={eaX} y1={padT} y2={padT + ph} stroke={SHADE} strokeWidth="2" data-testid="mb-ea-line" />
          <text x={eaX + 4} y={padT + 11} fontSize="11" fontWeight="700" fill={SHADE}>{catalyst ? "Ea (catalyst)" : "Ea"}</text>
          {zoom && <text x={padL + pw - 4} y={padT + 12} textAnchor="end" fontSize="11" fill={MUTED}>y-axis zoomed: the peak is cut off</text>}
        </svg>
      </div>
      <dl className="ct-mb-read" data-testid="mb-readout">
        <div><dt>Area under curve</dt><dd data-testid="mb-area">{area.toFixed(3)}</dd></div>
        <div><dt>{catalyst ? "Molecules with E ≥ Ea (catalyst)" : "Molecules with E ≥ Ea"}</dt><dd data-testid="mb-fraction"><b>{formatFraction(fracEff)}</b></dd></div>
        {catalyst && <div><dt>Without catalyst</dt><dd data-testid="mb-fraction-base">{formatFraction(fracBase)}</dd></div>}
        {measured != null && <div><dt>Measured in the vessel</dt><dd data-testid="mb-measured">{formatFraction(measured)}</dd></div>}
      </dl>
    </div>
  );
}
export { arrheniusFactor };

function densityAt(c, e) {
  // linear interpolation on the plotted samples (only used to start the shaded polygon exactly on the curve)
  const n = c.E.length - 1; const f = (e / XMAX) * n; const i = Math.min(n - 1, Math.max(0, Math.floor(f))); const a = f - i;
  return c.f[i] * (1 - a) + c.f[i + 1] * a;
}
