import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { STATE_ACCENT, PALETTE } from "../../particle-model-visualizer/data/palette.js";
import { STAGES, DONE_AT, TEMP_MIN, TEMP_MELT, TEMP_BOIL, TEMP_MAX, temperatureAt } from "../data/timeline.js";

const AMBER = "#E0A64C";
const W = 320;
const H = 232;
const PAD = { left: 34, right: 14, top: 16, bottom: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function xOf(t) {
  return PAD.left + (Math.min(t, DONE_AT) / DONE_AT) * PLOT_W;
}
function yOf(temp) {
  return PAD.top + (1 - (temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * PLOT_H;
}

const CURVE_POINTS = [
  { t: 0, temp: TEMP_MIN },
  { t: STAGES.solidHeat.end, temp: TEMP_MELT },
  { t: STAGES.melt.end, temp: TEMP_MELT },
  { t: STAGES.liquidHeat.end, temp: TEMP_BOIL },
  { t: STAGES.boil.end, temp: TEMP_BOIL },
  { t: STAGES.gasHeat.end, temp: TEMP_MAX },
];

function buildPathAndLength() {
  const pts = CURVE_POINTS.map((p) => [xOf(p.t), yOf(p.temp)]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0]} ${pts[i][1]}`;
    length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return { d, length };
}

function markerColorAt(t) {
  if (t < STAGES.solidHeat.end) return STATE_ACCENT.solid;
  if (t < STAGES.melt.end) return AMBER;
  if (t < STAGES.liquidHeat.end) return STATE_ACCENT.liquid;
  if (t < STAGES.boil.end) return AMBER;
  return STATE_ACCENT.gas;
}

/**
 * Exposes render(t) so the orchestrator's single animation-frame loop can
 * push updates straight into the SVG via refs — no React re-render per
 * frame, matching how the 3D particle side avoids per-frame state updates.
 */
const HeatingCurve = forwardRef(function HeatingCurve(_, ref) {
  const { d, length } = useMemo(() => buildPathAndLength(), []);
  const pathRef = useRef(null);
  const markerRef = useRef(null);
  const readoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    render(t) {
      if (pathRef.current) {
        pathRef.current.style.strokeDashoffset = String(length * (1 - Math.min(t, DONE_AT) / DONE_AT));
      }
      const temp = temperatureAt(t);
      if (markerRef.current) {
        markerRef.current.setAttribute("cx", String(xOf(t)));
        markerRef.current.setAttribute("cy", String(yOf(temp)));
        markerRef.current.setAttribute("fill", markerColorAt(t));
      }
      if (readoutRef.current) {
        readoutRef.current.textContent = `${Math.round(temp)}°C`;
      }
    },
  }));

  const meltMidX = xOf((STAGES.melt.start + STAGES.melt.end) / 2);
  const boilMidX = xOf((STAGES.boil.start + STAGES.boil.end) / 2);
  const iceMidX = xOf(STAGES.solidHeat.end / 2);
  const liquidMidX = xOf((STAGES.melt.end + STAGES.liquidHeat.end) / 2);
  const vapourMidX = xOf((STAGES.boil.end + STAGES.gasHeat.end) / 2);
  const regionLabelY = H - PAD.bottom + 12;

  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border px-3 py-3" style={{ borderColor: PALETTE.border, background: PALETTE.panel }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: PALETTE.eyebrow }}>
          Heating curve — water
        </p>
        <span ref={readoutRef} className="rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: PALETTE.panelRaised, color: PALETTE.textPrimary }}>
          -20°C
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1" role="img" aria-label="Temperature versus energy input heating curve for water, with melting point and boiling point labeled">
        {/* axis lines */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke={PALETTE.borderStrong} strokeWidth="1" />
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke={PALETTE.borderStrong} strokeWidth="1" />

        {/* 0C / 100C reference lines */}
        <line x1={PAD.left} y1={yOf(TEMP_MELT)} x2={W - PAD.right} y2={yOf(TEMP_MELT)} stroke={PALETTE.borderStrong} strokeDasharray="2 3" strokeWidth="1" />
        <line x1={PAD.left} y1={yOf(TEMP_BOIL)} x2={W - PAD.right} y2={yOf(TEMP_BOIL)} stroke={PALETTE.borderStrong} strokeDasharray="2 3" strokeWidth="1" />
        <text x={PAD.left - 4} y={yOf(TEMP_MELT) + 3} textAnchor="end" fontSize="8" fill={PALETTE.textFaint}>0°</text>
        <text x={PAD.left - 4} y={yOf(TEMP_BOIL) + 3} textAnchor="end" fontSize="8" fill={PALETTE.textFaint}>100°</text>

        {/* faint full-curve reference so students can see the whole shape as context */}
        <path d={d} fill="none" stroke={PALETTE.borderStrong} strokeWidth="1.5" opacity="0.35" />

        {/* progressively revealed bright curve */}
        <path
          ref={pathRef}
          d={d}
          fill="none"
          stroke={STATE_ACCENT.solid}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={length}
          strokeDashoffset={length}
        />

        {/* melting plateau — labeled above the line, where there's headroom */}
        <text x={meltMidX} y={yOf(TEMP_MELT) - 16} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={PALETTE.textPrimary}>MELTING POINT · 0°C</text>
        <text x={meltMidX} y={yOf(TEMP_MELT) - 7} textAnchor="middle" fontSize="6.5" fill={PALETTE.textFaint}>Ice + Liquid Water</text>

        {/* boiling plateau — labeled below the line, since it sits near the top of the chart */}
        <text x={boilMidX} y={yOf(TEMP_BOIL) + 14} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={PALETTE.textPrimary}>BOILING POINT · 100°C</text>
        <text x={boilMidX} y={yOf(TEMP_BOIL) + 23} textAnchor="middle" fontSize="6.5" fill={PALETTE.textFaint}>Liquid Water + Water Vapour</text>

        {/* moving marker */}
        <circle ref={markerRef} cx={xOf(0)} cy={yOf(TEMP_MIN)} r="4" fill={STATE_ACCENT.solid} stroke="#0B0E15" strokeWidth="1.5" />

        {/* the three sloping regions, named along the x-axis */}
        <text x={iceMidX} y={regionLabelY} textAnchor="middle" fontSize="6.5" fontWeight="600" fill={PALETTE.textSecondary}>ICE</text>
        <text x={liquidMidX} y={regionLabelY} textAnchor="middle" fontSize="6.5" fontWeight="600" fill={PALETTE.textSecondary}>LIQUID WATER</text>
        <text x={vapourMidX} y={regionLabelY} textAnchor="middle" fontSize="6.5" fontWeight="600" fill={PALETTE.textSecondary}>WATER VAPOUR</text>

        {/* axis titles */}
        <text transform={`translate(10 ${PAD.top + PLOT_H / 2}) rotate(-90)`} textAnchor="middle" fontSize="8" fill={PALETTE.textFaint}>
          Temperature (°C)
        </text>
        <text x={PAD.left + PLOT_W / 2} y={H - 6} textAnchor="middle" fontSize="8" fill={PALETTE.textFaint}>
          Energy input →
        </text>
      </svg>

      <p className="text-[10px] leading-snug" style={{ color: PALETTE.textFaint }}>
        Melting point 0°C and boiling point 100°C shown are for water at standard atmospheric pressure — other substances melt and boil at different temperatures.
      </p>
    </div>
  );
});

export default HeatingCurve;
