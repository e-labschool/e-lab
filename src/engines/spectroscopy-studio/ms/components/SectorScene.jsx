import { PALETTE } from "./ui.jsx";
import { SECTOR, sectorPoint, sectorTrajectory } from "../physics/sector.js";
import { SECTOR_MZ_CHOICES } from "../state/msState.js";

const DOM = { x0: -0.15, x1: 0.42, y0: -0.1, y1: 0.225 };
const CYCLE = 4.6; const TRAVEL = 3.4;

/** Stage 6: a 180-degree magnetic sector. Every reference ion follows a CIRCLE of radius r = (1/B) sqrt(2 (m/z) V / e); the selected one is animated. The detector sits at a fixed position. */
export default function SectorScene({ w, h, phase, V, B, mz }) {
  const pad = 8; const cap = 0;
  const s = Math.min((w - 2 * pad) / (DOM.x1 - DOM.x0), (h - 2 * pad - cap) / (DOM.y1 - DOM.y0));
  const ox = pad + ((w - 2 * pad) - s * (DOM.x1 - DOM.x0)) / 2 - DOM.x0 * s; const oy = pad + DOM.y1 * s + 0;
  const X = (x) => ox + x * s; const Y = (y) => oy - y * s;
  const traj = SECTOR_MZ_CHOICES.map((m, i) => ({ ...sectorTrajectory(m, V, B), color: PALETTE[i % PALETTE.length], idx: i }));
  const sel = traj.find((t) => t.mz === mz) ?? traj[0];
  const u = Math.min(1, (phase % CYCLE) / TRAVEL); const th = sel.sweep * u; const pt = sectorPoint(sel.r, th);
  const arrived = u >= 1;
  const dots = []; for (let x = 0.03; x < SECTOR.W; x += 0.04) for (let y = 0.025; y < SECTOR.H; y += 0.04) dots.push([x, y]);
  const detX = 2 * SECTOR.R_DET; const slitHalf = 2 * SECTOR.SLIT;
  const arc = (t) => `M ${X(0)} ${Y(0)} A ${t.r * s} ${t.r * s} 0 0 1 ${X(t.end.x)} ${Y(t.end.y)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-sector" role="img" aria-label={`Magnetic sector analyser: ions follow circular arcs in a uniform magnetic field; the radius depends on m/z. Selected m/z ${mz}: ${sel.outcome === "detector" ? "reaches the detector" : "does not reach the detector"}.`}
      data-testid="sector-svg" data-mz={mz} data-outcome={sel.outcome} data-radius={sel.r.toFixed(5)} data-b={B} data-v={V}>
      {/* field region */}
      <rect x={X(0)} y={Y(SECTOR.H)} width={SECTOR.W * s} height={SECTOR.H * s} className="ms-field" />
      {dots.map(([x, y], i) => <g key={i} opacity="0.5"><circle cx={X(x)} cy={Y(y)} r="4.2" fill="none" stroke="#7dd3fc" strokeWidth="1" /><circle cx={X(x)} cy={Y(y)} r="1.4" fill="#7dd3fc" /></g>)}
      <text x={X(SECTOR.W)} y={Y(SECTOR.H) - 6} textAnchor="end" className="ms-scenelabel is-sm">uniform magnetic field B, out of the page (⊙)</text>
      {/* plate, entry slit, detector */}
      <line x1={X(-0.03)} y1={Y(0)} x2={X(-0.004)} y2={Y(0)} stroke="#94a3b8" strokeWidth="5" /><line x1={X(0.004)} y1={Y(0)} x2={X(SECTOR.W)} y2={Y(0)} stroke="#94a3b8" strokeWidth="5" />
      <rect x={X(-0.03)} y={Y(-0.035)} width={0.06 * s} height={0.05 * s} rx="6" className="ms-partbox" />
      <text x={X(-0.04)} y={Y(-0.057)} textAnchor="end" className="ms-scenelabel">ion source</text>
      {w >= 520 && <text x={X(-0.04)} y={Y(-0.057) + 14} textAnchor="end" className="ms-scenelabel is-sm">+ accelerating electrodes</text>}
      <path d={`M ${X(0)} ${Y(-0.035)} V ${Y(-0.012)}`} stroke="#fb923c" strokeWidth="3" /><path d={`M ${X(0)} ${Y(-0.003)} l -6 11 h 12 z`} fill="#fb923c" />
      <text x={X(-0.012)} y={Y(0) + 15} textAnchor="end" className="ms-scenelabel is-sm">entry slit</text>
      <rect x={X(detX - slitHalf)} y={Y(0) - 3} width={slitHalf * 2 * s} height="7" fill="#22c55e" />
      <text x={X(detX)} y={Y(0) + 17 + 3 * 14 + 4} textAnchor="middle" className="ms-scenelabel is-ok">▲ detector (fixed position)</text>
      {/* reference paths */}
      {traj.map((t) => (t.mz === mz ? null : (
        <g key={t.mz} opacity="0.62" data-testid={`path-${t.mz}`} data-outcome={t.outcome}>
          <path d={arc(t)} fill="none" stroke={t.color} strokeWidth="1.8" strokeDasharray="6 5" />
          {t.outcome === "wall" ? <text x={X(t.end.x)} y={Y(t.end.y)} textAnchor="middle" dy="0.35em" fontSize="15" fontWeight="900" fill="#fca5a5">✕</text> : <circle cx={X(t.end.x)} cy={Y(0)} r="3.2" fill={t.color} />}
        </g>
      )))}
      {traj.map((t) => { if (t.mz === mz) return null; const row = t.idx % 3; const lx = X(t.end.x); const ly = t.outcome === "wall" ? Y(t.end.y) - 14 : Y(0) + 17 + row * 14; return <text key={`l${t.mz}`} x={lx} y={ly} textAnchor="middle" className="ms-scenelabel is-sm" fill={t.color}>{t.mz}</text>; })}
      {/* selected path */}
      <g data-testid={`path-${mz}`} data-outcome={sel.outcome}>
        <path d={arc(sel)} fill="none" stroke={sel.color} strokeWidth="3.6" strokeLinecap="round" />
        {sel.outcome === "wall" ? <text x={X(sel.end.x)} y={Y(sel.end.y)} textAnchor="middle" dy="0.35em" fontSize="20" fontWeight="900" fill="#fca5a5">✕</text> : <circle cx={X(sel.end.x)} cy={Y(0)} r="5" fill={sel.color} stroke="#fff" strokeWidth="1.5" />}
        <text x={X(sel.end.x)} y={sel.outcome === "wall" ? Y(sel.end.y) - 16 : Y(0) + 17 + (sel.idx % 3) * 14} textAnchor="middle" className="ms-scenelabel" fill={sel.color} fontWeight="800">{`m/z ${mz}`}</text>
        <circle cx={X(sel.r)} cy={Y(0)} r="3" fill={sel.color} />
        <text x={X(sel.r)} y={Y(0) - 10} textAnchor="middle" className="ms-scenelabel" fill={sel.color} data-testid="sector-radius-tag">r = {(sel.r * 100).toFixed(1)} cm</text>
        <g transform={`translate(${X(pt.x)} ${Y(pt.y)})`} data-testid="sector-ion"><circle r="13" fill={sel.color} opacity="0.28" /><circle r="9" fill={sel.color} stroke="#0a1330" strokeWidth="1.4" /><text textAnchor="middle" dy="0.35em" fontSize="12" fontWeight="900" fill="#0a1330">+</text></g>
        {arrived && sel.outcome === "detector" && <circle cx={X(sel.end.x)} cy={Y(0)} r={9 + 10 * ((phase % CYCLE) - TRAVEL)} fill="none" stroke="#86efac" strokeWidth="2.5" opacity={Math.max(0, 1 - ((phase % CYCLE) - TRAVEL))} />}
      </g>
    </svg>
  );
}
