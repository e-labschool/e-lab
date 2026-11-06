import { PALETTE, STATE_ACCENT } from "../../particle-model-visualizer/data/palette.js";
import { curveVertices, segmentsFor } from "../data/curveModel.js";
import { useSize } from "../lib/useSize.js";
import { segColor } from "../lib/colors.js";

const PAD = { left: 58, right: 16, top: 16, bottom: 46 };
const fmt = (t) => `${t < 0 ? "−" : ""}${Math.abs(Math.round(t))}`;
const SEG_FILL = { sensible: "rgba(108,134,238,0.06)", latent: "rgba(224,166,76,0.12)" };

/** Temperature-time graph (SVG, sized by a ResizeObserver, text always at its real pixel size).
 * Shows the whole curve of the active mode, the part already travelled, and a marker at (progress, temperature),
 * all computed from `state` (one progress value). */
export default function CurveGraph({ curve, mode, state }) {
  const [ref, { width, height }] = useSize();
  const sub = curve.substance;
  const W = Math.max(width, 10);
  const H = Math.max(height, 10);
  const pw = Math.max(W - PAD.left - PAD.right, 10);
  const ph = Math.max(H - PAD.top - PAD.bottom, 10);
  const yMin = sub.tStart - 10;
  const yMax = sub.tEnd + 10;
  const X = (p) => PAD.left + p * pw;
  const Y = (t) => PAD.top + (1 - (t - yMin) / (yMax - yMin)) * ph;
  const verts = curveVertices(curve, mode);
  const full = verts.map(([p, t]) => `${X(p).toFixed(1)},${Y(t).toFixed(1)}`).join(" ");
  const done = [];
  for (const [p, t] of verts) { if (p < state.progress - 1e-9) done.push([p, t]); }
  done.push([state.progress, state.temp]);
  const travelled = done.map(([p, t]) => `${X(p).toFixed(1)},${Y(t).toFixed(1)}`).join(" ");
  const segs = segmentsFor(curve, mode);
  const mx = X(state.progress);
  const my = Y(state.temp);
  const mc = segColor(state.segmentKey);
  const ticks = [sub.tStart, sub.tMelt, 50, sub.tBoil, sub.tEnd];
  const charW = 6.0;

  return (
    <div ref={ref} className="relative min-h-[240px] min-w-0 flex-1" data-testid="hc-graph-wrap">
      {width > 0 && height > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 block" role="img" data-testid="hc-graph" aria-label={`${mode === "heating" ? "Heating" : "Cooling"} curve of ${sub.name}: temperature in degrees Celsius against time. Current temperature ${Math.round(state.temp)} degrees Celsius, ${state.segmentLabel}.`}>
          {/* segment bands */}
          {segs.map((s) => {
            const x0 = X(s.t0);
            const x1 = X(s.t1);
            const label = s.short;
            const fits = (x1 - x0) > label.length * charW + 4;
            return (
              <g key={s.key} data-segment={s.key}>
                <rect x={x0} y={PAD.top} width={Math.max(x1 - x0, 0)} height={ph} fill={SEG_FILL[s.kind]} />
                {fits && <text x={(x0 + x1) / 2} y={PAD.top + ph - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={segColor(s.key)}>{label}</text>}
              </g>
            );
          })}
          {/* melting / boiling point reference lines */}
          {[sub.tMelt, sub.tBoil].map((t) => (
            <line key={t} x1={PAD.left} x2={PAD.left + pw} y1={Y(t)} y2={Y(t)} stroke={PALETTE.borderStrong} strokeDasharray="3 4" />
          ))}
          {/* y axis, ticks, x axis */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke={PALETTE.textFaint} />
          <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke={PALETTE.textFaint} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left - 4} x2={PAD.left} y1={Y(t)} y2={Y(t)} stroke={PALETTE.textFaint} />
              <text x={PAD.left - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill={PALETTE.textSecondary}>{fmt(t)}</text>
            </g>
          ))}
          <text transform={`translate(14 ${PAD.top + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fontWeight="600" fill={PALETTE.textSecondary} data-testid="hc-y-label">Temperature (°C)</text>
          <text x={PAD.left + pw / 2} y={H - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill={PALETTE.textSecondary} data-testid="hc-x-label">Time (arbitrary units)</text>
          <path d={`M ${PAD.left + pw - 22} ${PAD.top + ph + 14} l 22 0 m -5 -4 l 5 4 l -5 4`} fill="none" stroke={PALETTE.textFaint} />
          {/* plateau labels */}
          <text x={PAD.left + pw - 4} y={Y(sub.tBoil) - 6} textAnchor="end" fontSize="11" fill={PALETTE.textSecondary}>Boiling point {sub.tBoil} °C</text>
          <text x={PAD.left + pw - 4} y={Y(sub.tMelt) - 6} textAnchor="end" fontSize="11" fill={PALETTE.textSecondary}>Melting point {sub.tMelt} °C</text>
          {/* the whole curve (faint), then the part already travelled */}
          <polyline points={full} fill="none" stroke={PALETTE.textFaint} strokeWidth="2" opacity="0.55" strokeLinejoin="round" data-testid="hc-curve-full" />
          <polyline points={travelled} fill="none" stroke={STATE_ACCENT.solid} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" data-testid="hc-curve-done" />
          {/* guide lines + marker */}
          <line x1={mx} x2={mx} y1={my} y2={PAD.top + ph} stroke={mc} strokeDasharray="2 3" opacity="0.7" />
          <line x1={PAD.left} x2={mx} y1={my} y2={my} stroke={mc} strokeDasharray="2 3" opacity="0.7" />
          <circle cx={mx} cy={my} r="7" fill={mc} stroke="#fff" strokeWidth="2" data-testid="hc-marker" data-cx={mx.toFixed(1)} data-cy={my.toFixed(1)} />
        </svg>
      )}
    </div>
  );
}
