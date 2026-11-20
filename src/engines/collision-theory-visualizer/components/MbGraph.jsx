import { useMemo, useRef } from "react";
import { densityCurve, fractionAbove, formatFraction, numericArea, peakEnergy, peakDensity, mbAxis } from "../lib/maxwellBoltzmann.js";
import { niceTicks } from "../lib/rateMetrics.js";
import { useBox } from "../useBox.js";
import { CURVE, SHADE, TEXT, MUTED } from "../theme.js";

/**
 * Maxwell-Boltzmann distribution of molecular kinetic energies (3-D translational), in real units (kJ/mol, T in K):
 *     f(E) = 2 sqrt(E/pi) (kT)^(-3/2) exp(-E/kT),   kT = RT   (per mole: RT)
 * It starts at zero, has ONE peak at E = RT/2 and a long right-hand tail, and its area is 1 at every temperature.
 * The curve is the exact density; the shaded area is the EXACT fraction with E >= Ea (never summed over a truncated grid).
 * Only the AXIS LIMITS adapt (see mbAxis), never the curve. If Ea lies beyond the axis a full-range view reaches it.
 * No histogram or bars: just the smooth curve, the Ea threshold and the shaded region beyond it.
 * Catalyst: the curve is unchanged at constant T; only the threshold (effective Ea) moves, and the shading with it.
 */
export default function MbGraph({ T, eaEff, ea, catalyst, measured, pinned, full }) {
  const wrap = useRef(null);
  const { w: W, h: H } = useBox(wrap, { w: 380, h: 230 });
  const padL = 54; const padR = 12; const padT = 10; const padB = 40;
  const pw = Math.max(40, W - padL - padR); const ph = Math.max(40, H - padT - padB);
  const axis = useMemo(() => mbAxis(T, { pinnedT: pinned?.T ?? null, eaList: [ea, eaEff], full }), [T, pinned, ea, eaEff, full]);
  const { xMax, yMax } = axis;
  const x = (E) => padL + (E / xMax) * pw;
  const y = (f) => padT + (1 - f / yMax) * ph;
  const curve = useMemo(() => densityCurve(T, xMax, 320), [T, xMax]);
  const pinCurve = useMemo(() => (pinned ? densityCurve(pinned.T, xMax, 320) : null), [pinned, xMax]);
  const area = useMemo(() => numericArea(T, 4000), [T]);
  const fracEff = fractionAbove(eaEff, T);
  const fracBase = fractionAbove(ea, T);
  const mode = peakEnergy(T);
  const modeF = peakDensity(T);
  const line = (c) => { let d = ""; for (let i = 0; i < c.E.length; i++) d += `${i ? "L" : "M"}${x(c.E[i]).toFixed(1)},${y(c.f[i]).toFixed(1)}`; return d; };
  // area under the curve to the right of `from` (only when it is inside the plotted range)
  const tail = (from) => {
    const n = curve.E.length - 1; const f = (from / xMax) * n; const i0 = Math.min(n - 1, Math.floor(f)); const a = f - i0;
    const f0 = curve.f[i0] * (1 - a) + curve.f[i0 + 1] * a;
    let d = `M${x(from).toFixed(1)},${y(0).toFixed(1)}L${x(from).toFixed(1)},${y(f0).toFixed(1)}`;
    for (let i = i0 + 1; i <= n; i++) d += `L${x(curve.E[i]).toFixed(1)},${y(curve.f[i]).toFixed(1)}`;
    return `${d}L${x(xMax).toFixed(1)},${y(0).toFixed(1)}Z`;
  };
  const yt = niceTicks(yMax, ph < 120 ? 3 : 4); const xt = niceTicks(xMax, pw < 260 ? 4 : 6);
  const yFmt = (v) => (yt.step >= 0.1 ? v.toFixed(1) : yt.step >= 0.01 ? v.toFixed(2) : v.toFixed(3));
  const inEff = eaEff <= xMax; const inBase = ea <= xMax;
  const eaX = x(Math.min(eaEff, xMax)); const baseX = x(Math.min(ea, xMax));
  const eaName = catalyst ? "Ea (catalyst)" : "Ea";
  const label = `Maxwell-Boltzmann distribution of kinetic energies at ${T} kelvin. Area under the curve is ${area.toFixed(3)}. Most probable energy RT/2 = ${mode.toFixed(2)} kilojoules per mole. Fraction of molecules with energy at least ${eaEff.toFixed(1)} kilojoules per mole: ${formatFraction(fracEff)}.`;
  return (
    <div className="ct-mb" data-testid="mb-graph" data-xmax={xMax} data-ymax={yMax} data-full={axis.full ? "1" : "0"}>
      <div ref={wrap} className="ct-mb-plot">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} data-testid="mb-svg">
          <defs><clipPath id="ct-mb-clip"><rect x={padL} y={padT} width={pw} height={ph} /></clipPath></defs>
          {yt.ticks.map((f) => (
            <g key={f}>
              <line x1={padL} x2={padL + pw} y1={y(f)} y2={y(f)} stroke="#d6e0f2" strokeWidth="1" />
              <text x={padL - 6} y={y(f) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{yFmt(f)}</text>
            </g>
          ))}
          {xt.ticks.map((E) => (
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
            {inEff && <path d={tail(eaEff)} fill={SHADE} fillOpacity="0.3" data-testid="mb-shade" />}
            {pinCurve && <path d={line(pinCurve)} fill="none" stroke="#5b6785" strokeWidth="1.8" strokeDasharray="5 4" />}
            <path d={line(curve)} fill="none" stroke={CURVE} strokeWidth="2.6" data-testid="mb-curve" />
            <circle cx={x(mode)} cy={y(modeF)} r="3.2" fill={CURVE} stroke="#ffffff" strokeWidth="1" data-testid="mb-peak" />
          </g>
          {catalyst && inBase && <><line x1={baseX} x2={baseX} y1={padT} y2={padT + ph} stroke="#5b6785" strokeDasharray="4 3" data-testid="mb-ea-base-line" /><text x={baseX + 4} y={padT + 24} fontSize="11" fill="#5b6785">Ea (no catalyst)</text></>}
          {inEff ? (
            <>
              <line x1={eaX} x2={eaX} y1={padT} y2={padT + ph} stroke={SHADE} strokeWidth="2" data-testid="mb-ea-line" />
              <text x={eaX + 4} y={padT + 11} fontSize="11" fontWeight="700" fill={SHADE} textAnchor={eaX + 4 > padL + pw - 70 ? "end" : "start"} dx={eaX + 4 > padL + pw - 70 ? -8 : 0}>{eaName}</text>
            </>
          ) : (
            <g data-testid="mb-ea-off">
              <line x1={padL + pw - 1} x2={padL + pw - 1} y1={padT} y2={padT + ph} stroke={SHADE} strokeWidth="2" strokeDasharray="3 3" data-testid="mb-ea-line" />
              <text x={padL + pw - 6} y={padT + 11} textAnchor="end" fontSize="11" fontWeight="700" fill={SHADE}>{eaName} = {eaEff.toFixed(0)} kJ/mol ▸ beyond this axis</text>
            </g>
          )}
        </svg>
      </div>
      <dl className="ct-mb-read" data-testid="mb-readout">
        <div title="Probability density integrates to 1: the curve encloses all the molecules"><dt>Area under curve</dt><dd data-testid="mb-area">{area.toFixed(3)}</dd></div>
        <div title="Most probable translational kinetic energy = RT/2 (per mole)"><dt>Peak, RT/2</dt><dd data-testid="mb-mode">{mode.toFixed(2)} kJ/mol</dd></div>
        <div title="The shaded area beyond Ea is the fraction of molecules with enough energy to be able to react. Whether a collision reacts also depends on the relative collision energy and on orientation."><dt>{catalyst ? "Shaded area, E ≥ Ea (catalyst)" : "Shaded area, E ≥ Ea"}</dt><dd data-testid="mb-fraction"><b>{formatFraction(fracEff)}</b></dd></div>
        {catalyst && <div><dt>Without catalyst</dt><dd data-testid="mb-fraction-base">{formatFraction(fracBase)}</dd></div>}
        {measured != null && <div><dt>Measured in the vessel</dt><dd data-testid="mb-measured">{formatFraction(measured)}</dd></div>}
      </dl>
      {!inEff && <p className="ct-mb-note" data-testid="mb-note">Ea ({eaEff.toFixed(0)} kJ/mol) is far out in the tail: the area beyond it is too small to see. Use the full-range view to show where Ea sits; the curve itself is unchanged.</p>}
    </div>
  );
}
