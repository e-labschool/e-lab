import { TOF, TOF_ION_COLORS, displayClock, raceTable, tubePosition } from "../physics/tof.js";
import { fmtUs } from "../physics/constants.js";

/** Stage 7: four singly charged ions leave the acceleration region together and race along a field-free tube. Lanes are drawn horizontally; positions are linear in time (constant speed). */
export default function TofScene({ w, h, progress, V, ions }) {
  const rows = raceTable(ions, V); const tau = displayClock(progress, rows);
  const pad = 14; const labW = Math.min(96, w * 0.17); const x0 = pad + labW + 46; const x1 = w - pad - 34; const L = Math.max(60, x1 - x0);
  const top = 30; const laneH = Math.max(26, Math.min(56, (h - top - 46) / rows.length));
  const arrivedAt = (r) => tau >= r.t - 1e-12;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-tof" role="img" data-testid="tof-svg" data-progress={progress.toFixed(3)}
      aria-label="Time-of-flight race: four ions with different m/z fly through a field-free tube; the lightest arrives first.">
      <rect x={pad} y={top - 12} width={46 + labW - 6} height={laneH * rows.length + 24} rx="8" className="ms-partbox" />
      <text x={pad + 8} y={top + 2} className="ms-scenelabel is-sm">source + </text>
      <text x={pad + 8} y={top + 16} className="ms-scenelabel is-sm">acceleration</text>
      <rect x={x0} y={top - 8} width={L} height={laneH * rows.length + 16} rx="12" className="ms-tube" />
      <text x={(x0 + x1) / 2} y={top - 14} textAnchor="middle" className="ms-scenelabel is-sm">field-free flight tube, length L = {TOF.L} m (not to scale)</text>
      <rect x={x1 + 6} y={top - 8} width="20" height={laneH * rows.length + 16} rx="5" fill="#16a34a" opacity="0.85" />
      <text x={x1 + 16} y={top + laneH * rows.length + 22} textAnchor="middle" className="ms-scenelabel is-ok">detector</text>
      {rows.map((r, i) => {
        const cy = top + laneH * i + laneH / 2; const col = TOF_ION_COLORS[i]; const p = tubePosition(r.t, tau); const x = x0 + 8 + p * (L - 16); const done = arrivedAt(r);
        return (
          <g key={r.id} data-testid={`tof-lane-${r.id}`} data-pos={p.toFixed(3)} data-arrived={done ? "1" : "0"}>
            <line x1={x0 + 8} y1={cy} x2={x1 - 8} y2={cy} stroke="#31446f" strokeDasharray="3 6" />
            <text x={pad + 8 + labW + 40} y={cy + 5} textAnchor="end" className="ms-scenelabel" fill={col} fontWeight="800">m/z {r.mz}</text>
            <circle cx={x} cy={cy} r={Math.min(12, 6 + r.mz / 14)} fill={col} stroke="#0a1330" strokeWidth="1.4" data-testid={`tof-ion-${r.id}`} />
            <text x={x} y={cy} textAnchor="middle" dy="0.35em" fontSize="11" fontWeight="900" fill="#0a1330">+</text>
            {done && <text x={x1 - 10} y={cy - Math.min(14, laneH / 2 - 2)} textAnchor="end" className="ms-scenelabel is-sm" fill={col}>#{r.rank} · {fmtUs(r.t)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
