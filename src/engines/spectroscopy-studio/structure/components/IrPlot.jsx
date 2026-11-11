import { useMemo } from "react";
import { useSize } from "../../components/useSize.js";
import { niceTicks } from "../../components/LinePlot.jsx";
import { transmittanceAt } from "../../ir/physics/spectrum.js";

// Infrared spectrum, drawn the standard way: wavenumber DECREASING to the right (4000 -> 400 cm^-1), transmittance 0-100 % with 100 % at the top, so absorption bands point
// DOWN. Zoomable (range = [lo, hi] in cm^-1). No functional-group labels: only numbers. Built from the compound's bands with the IR workspace's own spectrum physics.
const M = { l: 50, r: 14, t: 14, b: 44 };

export default function IrPlot({ bands, peaks, range, cursor, onCursor, selected, onSelect }) {
  const [ref, size] = useSize();
  const W = Math.max(260, size.width || 520); const H = Math.max(170, size.height || 300);
  const pw = W - M.l - M.r; const ph = H - M.t - M.b; const [lo, hi] = range;
  const sx = (nu) => M.l + ((hi - nu) / (hi - lo)) * pw; const sy = (T) => M.t + ((100 - T) / 100) * ph;
  const step = (hi - lo) / Math.max(200, pw);
  const d = useMemo(() => {
    let out = ""; const n = Math.round((hi - lo) / step);
    for (let i = 0; i <= n; i += 1) { const nu = hi - i * step; out += `${i ? "L" : "M"}${(M.l + ((hi - nu) / (hi - lo)) * pw).toFixed(1)},${(M.t + ((100 - transmittanceAt(bands, nu)) / 100) * ph).toFixed(1)}`; }
    return out;
  }, [bands, hi, lo, step, pw, ph]);
  const xt = niceTicks(lo, hi, Math.max(3, Math.floor(pw / 80))); const yt = [0, 20, 40, 60, 80, 100];
  const move = (e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; const f = (x - M.l) / pw; onCursor(f >= 0 && f <= 1 ? Math.round(hi - f * (hi - lo)) : null); };
  const visible = peaks.filter((p) => p.nu >= lo && p.nu <= hi);
  return (
    <div ref={ref} className="st-plotfill">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="st-ir" role="group" aria-label="Infrared spectrum of the unknown: transmittance in percent against wavenumber in reciprocal centimetres, 4000 on the left to 400 on the right" data-testid="ir-spectrum"
        data-xleft={hi} data-xright={lo} onPointerMove={move} onPointerLeave={() => onCursor(null)}>
        <defs><clipPath id="st-ir-clip"><rect x={M.l} y={M.t - 2} width={pw} height={ph + 4} /></clipPath></defs>
        <rect x={M.l} y={M.t} width={pw} height={ph} className="ss-plot-bg" />
        {yt.map((v) => <line key={`gy${v}`} x1={M.l} x2={M.l + pw} y1={sy(v)} y2={sy(v)} className="ss-grid" />)}
        {xt.map((v) => <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={M.t} y2={M.t + ph} className="ss-grid" />)}
        <g clipPath="url(#st-ir-clip)">
          <path d={d} fill="none" className="st-ir-curve" strokeWidth="2.2" strokeLinejoin="round" data-testid="ir-curve" />
          {selected && selected.nu >= lo && selected.nu <= hi && <g data-testid="ir-selected"><line x1={sx(selected.nu)} x2={sx(selected.nu)} y1={M.t} y2={M.t + ph} className="st-selline" /><circle cx={sx(selected.nu)} cy={sy(transmittanceAt(bands, selected.nu))} r="5" className="st-seldot" /></g>}
          {cursor != null && cursor >= lo && cursor <= hi && <line x1={sx(cursor)} x2={sx(cursor)} y1={M.t} y2={M.t + ph} className="ss-cursor" data-testid="ir-cursor" />}
        </g>
        <rect x={M.l} y={M.t} width={pw} height={ph} fill="none" className="ss-axis" />
        {visible.map((p, i) => {
          const hw = Math.max(9, Math.min(120, (Math.max(p.fwhm * 0.5, 14) / (hi - lo)) * pw));
          return (
            <g key={p.nu} className="st-hit" role="button" tabIndex={0} aria-label={`Absorption near ${Math.round(p.nu / 5) * 5} wavenumbers`} aria-pressed={selected?.nu === p.nu} data-testid={`ir-band-${i}`} data-nu={Math.round(p.nu)}
              onClick={() => onSelect(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p); } }}>
              <rect x={Math.max(M.l, sx(p.nu) - hw)} y={M.t} width={Math.min(2 * hw, pw)} height={ph} className="st-hitrect" />
            </g>
          );
        })}
        {xt.map((v) => <g key={`tx${v}`}><line x1={sx(v)} x2={sx(v)} y1={M.t + ph} y2={M.t + ph + 5} className="ss-axis" /><text x={sx(v)} y={M.t + ph + 19} textAnchor="middle" className="ss-tick st-tick">{Math.round(v)}</text></g>)}
        {yt.map((v) => <g key={`ty${v}`}><line x1={M.l - 5} x2={M.l} y1={sy(v)} y2={sy(v)} className="ss-axis" /><text x={M.l - 8} y={sy(v) + 4} textAnchor="end" className="ss-tick st-tick">{v}</text></g>)}
        {cursor != null && cursor >= lo && cursor <= hi && <text x={Math.min(W - 70, Math.max(M.l + 4, sx(cursor) + 6))} y={M.t + 13} className="st-cursortext" data-testid="ir-cursor-label">{cursor}</text>}
        <text x={M.l + pw / 2} y={H - 6} textAnchor="middle" className="ss-axis-label st-axlabel">Wavenumber (cm⁻¹)</text>
        <text transform={`translate(13 ${M.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="ss-axis-label st-axlabel">Transmittance (%)</text>
      </svg>
    </div>
  );
}
