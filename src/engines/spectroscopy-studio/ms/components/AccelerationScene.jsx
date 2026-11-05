import { PALETTE } from "./ui.jsx";
import { kineticEnergyJ, speedFromMz } from "../physics/kinematics.js";
import { E_CHARGE } from "../physics/constants.js";

export const ACCEL_IONS = [{ mz: 16, color: PALETTE[0] }, { mz: 31, color: PALETTE[1] }, { mz: 58, color: PALETTE[2] }];
const V_REF = 2000; const T_HEAVY = 2.4; const CYCLE = 7; const M_HEAVY = 58;
const V_BAR_MAX = 5000;

/** Stage 5: ions accelerated between two electrodes. The display clock repeats every few seconds; positions follow x = d (t/t_gap)^2 inside the gap (constant force) and constant speed after it. */
export default function AccelerationScene({ w, h, phase, V }) {
  const wide = w >= 640; const pad = 14;
  const sc = wide ? { x: pad, y: pad, w: w * 0.6 - pad, h: h - 2 * pad - 20 } : { x: pad, y: pad, w: w - 2 * pad, h: (h - 2 * pad - 20) * 0.56 };
  const bars = wide ? { x: sc.x + sc.w + 8, y: pad, w: w - (sc.x + sc.w + 8) - pad, h: h - 2 * pad - 20 } : { x: pad, y: sc.y + sc.h + 8, w: w - 2 * pad, h: h - (sc.y + sc.h + 8) - 28 };
  const cy = sc.y + sc.h * 0.5; const laneDy = Math.min(46, sc.h * 0.2);
  const x1 = sc.x + sc.w * 0.2; const x2 = sc.x + sc.w * 0.52; const d = x2 - x1; const xEnd = sc.x + sc.w - 18;
  const tau = phase % CYCLE;
  const rows = ACCEL_IONS.map((ion, i) => {
    const tg = T_HEAVY * Math.sqrt(ion.mz / M_HEAVY) * Math.sqrt(V_REF / V);
    const y = cy + (i - 1) * laneDy;
    const inGap = tau < tg; const frac = inGap ? (tau / tg) ** 2 : 1;
    const vPx = (2 * d) / tg; const x = inGap ? x1 + d * frac : Math.min(xEnd, x2 + (tau - tg) * vPx);
    const vNow = inGap ? (tau / tg) : 1; // speed relative to final
    const vFinal = speedFromMz(ion.mz, V); const ek = kineticEnergyJ(1, V);
    return { ...ion, y, x, inGap, tg, vPx, frac, vNow: vNow * vFinal, ekNow: ek * frac, vFinal, ek };
  });
  const barH = (bars.h - 62); const g = (k) => bars.x + (k === 0 ? bars.w * 0.04 : bars.w * 0.54);
  const bw = Math.max(12, Math.min(26, bars.w * 0.085));
  const slot = (k, i) => g(k) + 8 + i * (bw + 10);
  const ekMax = V_BAR_MAX * E_CHARGE; const vMax = speedFromMz(16, V_BAR_MAX);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-accel" role="img" aria-label={`Three ions of different mass are accelerated between two electrodes with a potential difference of ${V} volts; all gain the same kinetic energy, the lighter ions reach a higher speed.`} data-testid="accel-svg" data-v={V}>
      <rect x={sc.x} y={sc.y} width={sc.w} height={sc.h} rx="14" className="ms-partbox is-chamber" />
      {/* electrodes */}
      <rect x={x1 - 6} y={sc.y + 18} width="10" height={sc.h - 80} rx="3" fill="#fbbf24" />
      <text x={x1 - 1} y={sc.y + 14} textAnchor="middle" className="ms-scenelabel">+</text>
      <path d={`M ${x2 - 3} ${sc.y + 18} V ${cy - laneDy - 12} M ${x2 - 3} ${cy - laneDy + 12} V ${cy - 12} M ${x2 - 3} ${cy + 12} V ${cy + laneDy - 12} M ${x2 - 3} ${cy + laneDy + 12} V ${sc.y + sc.h - 62}`} stroke="#94a3b8" strokeWidth="10" fill="none" />
      <text x={x2 - 3} y={sc.y + 14} textAnchor="middle" className="ms-scenelabel">0 V</text>
      <text x={x1 - 1} y={sc.y + sc.h - 38} textAnchor="middle" className="ms-scenelabel is-sm">positive</text>
      <text x={x1 - 1} y={sc.y + sc.h - 25} textAnchor="middle" className="ms-scenelabel is-sm">electrode</text>
      <text x={x2 - 3} y={sc.y + sc.h - 38} textAnchor="middle" className="ms-scenelabel is-sm">earthed electrode</text>
      <text x={x2 - 3} y={sc.y + sc.h - 25} textAnchor="middle" className="ms-scenelabel is-sm">with slits</text>
      {/* field arrows */}
      {[-0.6, 0.6].map((k) => <g key={k}><line x1={x1 + 12} y1={cy + k * laneDy * 1.9} x2={x2 - 14} y2={cy + k * laneDy * 1.9} stroke="#7dd3fc" strokeWidth="1.8" strokeDasharray="2 5" opacity="0.8" /><path d={`M ${x2 - 14} ${cy + k * laneDy * 1.9} l -9 -5 v 10 z`} fill="#7dd3fc" opacity="0.9" /></g>)}
      <text x={(x1 + x2) / 2} y={sc.y + 36} textAnchor="middle" className="ms-scenelabel is-sm">electric field E</text>
      <text x={(x1 + x2) / 2} y={sc.y + 50} textAnchor="middle" className="ms-scenelabel is-sm">(same everywhere)</text>
      <text x={(x1 + x2) / 2} y={sc.y + sc.h - 5} textAnchor="middle" className="ms-scenelabel is-volt" data-testid="accel-voltage">potential difference V = {V.toLocaleString("en-US")} V</text>
      {/* drift region */}
      <text x={(x2 + xEnd) / 2} y={sc.y + 36} textAnchor="middle" className="ms-scenelabel is-sm">after the slits:</text>
      <text x={(x2 + xEnd) / 2} y={sc.y + 50} textAnchor="middle" className="ms-scenelabel is-sm">no force, constant speed</text>
      {rows.map((r) => (
        <g key={r.mz} data-testid={`accel-ion-${r.mz}`} data-ek={r.ekNow.toExponential(3)} data-in-gap={r.inGap ? "1" : "0"} data-x={r.x.toFixed(1)}>
          <line x1={x1 - 22} y1={r.y} x2={xEnd + 8} y2={r.y} stroke="#475a8a" strokeWidth="1" strokeDasharray="2 6" />
          <text x={x1 - 28} y={r.y + 4} textAnchor="end" className="ms-scenelabel" fill={r.color}>m/z {r.mz}</text>
          {!r.inGap && <g opacity="0.95"><line x1={r.x - 4} y1={r.y} x2={r.x - Math.min(80, r.vPx * 0.55)} y2={r.y} stroke={r.color} strokeWidth="3" opacity="0.55" strokeLinecap="round" /></g>}
          <circle cx={r.x} cy={r.y} r="12" fill={r.color} opacity="0.25" />
          <circle cx={r.x} cy={r.y} r="8.5" fill={r.color} stroke="#0a1330" strokeWidth="1.2" />
          <text x={r.x} y={r.y} textAnchor="middle" dy="0.35em" fontSize="12" fontWeight="900" fill="#0a1330">+</text>
        </g>
      ))}
      {/* live bars */}
      <rect x={bars.x} y={bars.y} width={bars.w} height={bars.h} rx="14" className="ms-partbox" />
      {[0, 1].map((k) => (
        <g key={k} data-testid={k === 0 ? "ek-bars" : "v-bars"}>
          <text x={g(k) + 4} y={bars.y + 20} className="ms-scenelabel is-title">{k === 0 ? "Kinetic energy Eₖ" : "Speed v"}</text>
          {rows.map((r, i) => {
            const val = k === 0 ? r.ekNow / ekMax : r.vNow / vMax; const hh = Math.max(1, barH * val);
            return (
              <g key={r.mz}>
                <rect x={slot(k, i)} y={bars.y + 30 + barH - hh} width={bw} height={hh} rx="2" fill={r.color} data-testid={`${k === 0 ? "ek" : "v"}-bar-${r.mz}`} data-value={(k === 0 ? r.ekNow : r.vNow).toExponential(3)} />
                <text x={slot(k, i) + bw / 2} y={bars.y + 30 + barH + 14} textAnchor="middle" className="ms-scenelabel is-sm">{r.mz}</text>
              </g>
            );
          })}
          <line x1={g(k)} x2={g(k) + (bw + 10) * 3 + 8} y1={bars.y + 30 + barH} y2={bars.y + 30 + barH} className="ss-axis" />
        </g>
      ))}
      <text x={bars.x + bars.w / 2} y={bars.y + bars.h - 8} textAnchor="middle" className="ms-scenelabel is-sm">bars: ion m/z · same E, different v</text>
      <text x={w / 2} y={h - 5} textAnchor="middle" className="ss-svgtext--sm" fontSize="12">illustrative: the clock repeats and the ions are drawn in separate lanes</text>
    </svg>
  );
}
