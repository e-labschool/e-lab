import { useMemo } from "react";
import { useSize } from "../../components/useSize.js";
import { AXIS, FINGERPRINT_BELOW, NU_TICKS, axisFraction, buildSpectrum, nuAtFraction, transmittanceAt, wavenumberGrid } from "../physics/spectrum.js";

// The infrared spectrum drawn the standard way: wavenumber 4000 -> 400 cm^-1 from LEFT to RIGHT, transmittance 0-100 % with 100 % at the TOP.
// One SVG; the curve is built from absorption bands (physics/spectrum.js). Used by stages 6-9.
const GRID = wavenumberGrid(2);
const M = { l: 58, r: 14, t: 18, b: 46 };

/**
 * props: bands [{nu, fwhm, A, eta, grow?}], curves (map mode: [{id, bands, color, selected}]), onBandClick(i), selected (index), hot (indices drawn bold),
 *        labelAll, fingerprint (shade < 1500), range [lo, hi] (highlight), cursor (cm^-1), onCursor(nu), marker {nu, color} (the wavenumber under study),
 *        clickable (band hit areas), ariaLabel, testId, hint
 */
export default function SpectrumPlot({ bands = [], curves = null, onCurveClick, onBandClick, selected = null, hot = [], labelAll = false, fingerprint = false, range = null, cursor = null, onCursor, marker = null, clickable = false, ariaLabel, testId = "ir-spectrum", hint, curveColor = "#7dd3fc", dataNote, rangeLabel }) {
  const [ref, size] = useSize();
  const W = Math.max(260, size.width || 520); const H = Math.max(180, size.height || 300);
  const pw = W - M.l - M.r; const ph = H - M.t - M.b;
  const sx = (nu) => M.l + axisFraction(nu) * pw; const sy = (T) => M.t + ((AXIS.tTop - T) / (AXIS.tTop - AXIS.tBottom)) * ph;
  const main = useMemo(() => (curves ? null : buildSpectrum(bands, GRID)), [bands, curves]);
  const pathOf = (T) => { let d = ""; for (let i = 0; i < GRID.length; i += 1) d += `${i ? "L" : "M"}${sx(GRID[i]).toFixed(1)},${sy(T[i]).toFixed(1)}`; return d; };
  const curvePaths = useMemo(() => (curves ? curves.map((c) => ({ ...c, T: buildSpectrum(c.bands, GRID).T })) : null), [curves]);
  // labels of neighbouring bands (closer than 34 px) are staggered upwards so that no two numbers overlap
  const labelRaise = (() => {
    const shown = bands.map((b, i) => ({ i, x: sx(b.nu) })).filter(({ i }) => labelAll || selected === i || hot.includes(i)).sort((p, q) => p.x - q.x);
    const raise = {}; let prev = null;
    for (const s of shown) { raise[s.i] = prev && s.x - prev.x < 34 ? ((raise[prev.i] ?? 0) + 1) % 3 : 0; prev = s; }
    return raise;
  })();
  const labelFor = (b, i) => {
    const T = transmittanceAt(bands, b.nu); const x = sx(b.nu); const y = sy(T);
    const show = labelAll || selected === i || hot.includes(i); if (!show) return null;
    const anchor = x > W - 50 ? "end" : x < M.l + 30 ? "start" : "middle";
    return <text key={`l${i}`} x={x} y={Math.max(M.t + 12, y - 9 - 14 * (labelRaise[i] ?? 0))} textAnchor={anchor} className="ir-bandlabel" data-testid={`band-label-${i}`}>{Math.round(b.nu)}</text>;
  };
  const onMove = (e) => { if (!onCursor) return; const r = e.currentTarget.getBoundingClientRect(); const x = e.clientX - r.left; const f = (x - M.l * (r.width / W)) / (pw * (r.width / W)); if (f >= 0 && f <= 1) onCursor(Math.round(nuAtFraction(f))); };
  const order = clickable ? bands.map((b, i) => i).sort((a, b) => bands[b].fwhm - bands[a].fwhm) : [];
  return (
    <div ref={ref} className="ir-plotbox" data-testid={`${testId}-box`}>
      <svg className="ir-plot" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? "Infrared spectrum: transmittance in percent against wavenumber in reciprocal centimetres, 4000 on the left to 400 on the right"} data-testid={testId}
        data-xleft={AXIS.nuLeft} data-xright={AXIS.nuRight} data-ytop={AXIS.tTop} data-bands={bands.length} data-note={dataNote} onPointerMove={onCursor ? onMove : undefined}>
        <rect x={M.l} y={M.t} width={pw} height={ph} className="ss-plot-bg" />
        {fingerprint && <g data-testid="fingerprint-shade"><rect x={sx(FINGERPRINT_BELOW)} y={M.t} width={sx(AXIS.nuRight) - sx(FINGERPRINT_BELOW)} height={ph} className="ir-fingerprint" /><text x={(sx(FINGERPRINT_BELOW) + sx(AXIS.nuRight)) / 2} y={M.t + 18} textAnchor="middle" className="ir-fplabel">Fingerprint region</text></g>}
        {range && <rect x={sx(range[1])} y={M.t} width={Math.max(2, sx(range[0]) - sx(range[1]))} height={ph} className="ir-range" data-testid="range-band" />}
        {[0, 20, 40, 60, 80, 100].map((v) => <line key={`gy${v}`} x1={M.l} x2={M.l + pw} y1={sy(v)} y2={sy(v)} className="ss-grid" />)}
        {NU_TICKS.map((v) => <line key={`gx${v}`} y1={M.t} y2={M.t + ph} x1={sx(v)} x2={sx(v)} className="ss-grid" />)}
        {marker && <g data-testid="nu-marker"><line x1={sx(marker.nu)} x2={sx(marker.nu)} y1={M.t} y2={M.t + ph} stroke={marker.color ?? "#fff"} strokeWidth="1.8" strokeDasharray="4 4" /></g>}
        <rect x={M.l} y={M.t} width={pw} height={ph} fill="none" className="ss-axis" />
        <line x1={M.l} x2={M.l + pw} y1={sy(100)} y2={sy(100)} stroke="#8da4d8" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
        {main && <path d={pathOf(main.T)} fill="none" stroke={curveColor} strokeWidth="2.2" strokeLinejoin="round" data-testid="ir-curve" />}
        {curvePaths && curvePaths.map((c) => (
          <g key={c.id} data-testid={`curve-${c.id}`} data-selected={c.selected ? "1" : "0"}>
            <path d={`${pathOf(c.T)}L${sx(AXIS.nuRight)},${sy(100)}L${sx(AXIS.nuLeft)},${sy(100)}Z`} fill={c.color} opacity={c.selected ? 0.5 : 0.2} />
            <path d={pathOf(c.T)} fill="none" stroke={c.color} strokeWidth={c.selected ? 3.2 : 1.8} strokeLinejoin="round" opacity={c.selected ? 1 : 0.85} />
          </g>
        ))}
        {curvePaths && onCurveClick && [...curvePaths].flatMap((c) => c.bands.map((b) => ({ c, b }))).sort((x, y) => y.b.fwhm - x.b.fwhm).map(({ c, b }, k) => {
          const w = Math.max(b.fwhm * 0.7, 22); const x1 = sx(b.nu + w); const x2 = sx(b.nu - w);
          return (
            <g key={`ch${c.id}${k}`} className={`ir-bandhit${c.selected ? " is-sel" : ""}`} role="button" tabIndex={0} aria-label={`${c.label ?? c.id} band near ${Math.round(b.nu)} wavenumbers`} aria-pressed={Boolean(c.selected)} data-testid={`curve-hit-${c.id}`} data-nu={Math.round(b.nu)}
              onClick={() => onCurveClick(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCurveClick(c.id); } }}>
              <rect x={Math.max(M.l, Math.min(x1, x2))} y={M.t} width={Math.max(16, Math.abs(x2 - x1))} height={ph} className="ir-bandhit-rect" />
            </g>
          );
        })}
        {rangeLabel && range && <text x={Math.min(W - 20, Math.max(M.l + 20, (sx(range[0]) + sx(range[1])) / 2))} y={M.t + ph - 10} textAnchor="middle" className="ir-rangelabel" data-testid="range-label">{rangeLabel}</text>}
        {clickable && order.map((i) => {
          const b = bands[i]; const x1 = sx(b.nu + Math.max(b.fwhm * 0.7, 18)); const x2 = sx(b.nu - Math.max(b.fwhm * 0.7, 18)); const T = transmittanceAt(bands, b.nu); const cx = sx(b.nu);
          return (
            <g key={`h${i}`} className={`ir-bandhit${selected === i ? " is-sel" : ""}`} role="button" tabIndex={0} aria-label={`Band at ${Math.round(b.nu)} wavenumbers`} aria-pressed={selected === i} data-testid={`band-${i}`} data-nu={Math.round(b.nu)}
              onClick={() => onBandClick?.(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBandClick?.(i); } }}>
              <rect x={Math.max(M.l, Math.min(x1, x2))} y={M.t} width={Math.max(14, Math.abs(x2 - x1))} height={ph} className="ir-bandhit-rect" />
              <circle cx={cx} cy={sy(T)} r={selected === i ? 6 : 4.5} className="ir-banddot" />
            </g>
          );
        })}
        {bands.map((b, i) => labelFor(b, i))}
        {cursor !== null && cursor !== undefined && <g data-testid="cursor"><line x1={sx(cursor)} x2={sx(cursor)} y1={M.t} y2={M.t + ph} className="ss-cursor" /><text x={Math.min(W - 54, Math.max(M.l + 4, sx(cursor) + 6))} y={M.t + 14} className="ir-bandlabel">{cursor} cm⁻¹</text></g>}
        {NU_TICKS.filter((v) => v >= 600).map((v) => <g key={`tx${v}`}><line x1={sx(v)} x2={sx(v)} y1={M.t + ph} y2={M.t + ph + 5} className="ss-axis" /><text x={sx(v)} y={M.t + ph + 19} textAnchor="middle" className="ss-tick">{v}</text></g>)}
        <g><line x1={sx(400)} x2={sx(400)} y1={M.t + ph} y2={M.t + ph + 5} className="ss-axis" /><text x={sx(400) + 2} y={M.t + ph + 19} textAnchor="end" className="ss-tick">400</text></g>
        {[0, 20, 40, 60, 80, 100].map((v) => <g key={`ty${v}`}><line x1={M.l - 5} x2={M.l} y1={sy(v)} y2={sy(v)} className="ss-axis" /><text x={M.l - 8} y={sy(v) + 4} textAnchor="end" className="ss-tick">{v}</text></g>)}
        <text x={M.l + pw / 2} y={H - 6} textAnchor="middle" className="ss-axis-label">Wavenumber (cm⁻¹)</text>
        <text transform={`translate(13 ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="ss-axis-label">Transmittance (%)</text>
      </svg>
      {hint && <p className="ir-plothint">{hint}</p>}
    </div>
  );
}
