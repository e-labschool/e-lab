import { energyJ, energyKJmol } from "../physics/constants.js";
import { sci } from "./ui.jsx";

/**
 * Vibrational energy-level ladder of one mode (SVG): v = 0, 1, 2 with spacing dE = h c nu~. The evenly spaced ladder is the harmonic picture; real levels draw
 * slightly closer together as v rises (anharmonicity), which is noted but not drawn because the effect is only a few per cent.
 *   absorb 0..1   how strongly the radiation is absorbed (arrow opacity; the molecule jumps v0 -> v1 when absorb is high)
 *   phase         seconds, drives the jump cycle and the photon wiggle
 */
export default function EnergyLadder({ wn, absorb = 0, phase = 0, label, showPhoton = true, mismatch = false, compact = false }) {
  const W = 280; const H = compact ? 250 : 300; const x0 = 92; const x1 = 196;
  const y = (v) => H - 52 - v * (compact ? 62 : 78);
  const cycle = (phase % 3.2) / 3.2; // 0..1: wait in v=0, jump, stay in v=1, relax
  const hot = absorb > 0.5; const up = hot && cycle > 0.3 && cycle < 0.78;
  const posY = up ? y(1) : y(0);
  const dE = energyJ(wn);
  const photonY = y(0.5);
  const wig = Array.from({ length: 28 }, (_, i) => { const t = i / 27; return `${i ? "L" : "M"}${(10 + t * 64).toFixed(1)},${(photonY + 7 * Math.sin(t * 18 - phase * 9)).toFixed(1)}`; }).join("");
  return (
    <svg className="ir-ladder" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? `Vibrational energy levels v equals 0, 1 and 2 separated by delta E equals h nu, about ${Math.round(wn)} wavenumbers`} data-testid="energy-ladder" data-absorb={absorb.toFixed(3)} data-jump={up ? "1" : "0"} data-wn={Math.round(wn)}>
      <text x={W / 2} y="16" textAnchor="middle" className="ss-svgtext ss-svgtext--b">Vibrational energy levels</text>
      {[0, 1, 2].map((v) => (
        <g key={v} data-testid={`level-v${v}`}>
          <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#2dd4bf" : v === 1 ? "#a78bfa" : "#8da4d8"} strokeWidth="3.5" strokeLinecap="round" />
          <text x={x1 + 8} y={y(v) + 5} className="ss-svgtext ss-svgtext--b">v = {v}</text>
        </g>
      ))}
      <text x={x1 + 8} y={y(0) + 21} className="ss-svgtext ss-svgtext--sm">E = ½hν</text>
      <text x={x1 + 8} y={y(1) + 21} className="ss-svgtext ss-svgtext--sm">E = 1½hν</text>
      <text x={x1 + 8} y={y(2) + 21} className="ss-svgtext ss-svgtext--sm">E = 2½hν</text>
      {/* ΔE bracket */}
      <path d={`M${x0 - 14},${y(0)} L${x0 - 20},${y(0)} L${x0 - 20},${y(1)} L${x0 - 14},${y(1)}`} fill="none" stroke="#fbbf24" strokeWidth="2" />
      <text x={x0 - 26} y={(y(0) + y(1)) / 2 - 3} textAnchor="end" className="ss-svgtext ss-svgtext--b" style={{ fill: "#fbbf24" }}>ΔE = hν</text>
      <text x={x0 - 26} y={(y(0) + y(1)) / 2 + 13} textAnchor="end" className="ss-svgtext ss-svgtext--sm">{sci(dE)} J</text>
      <text x={x0 - 26} y={(y(0) + y(1)) / 2 + 27} textAnchor="end" className="ss-svgtext ss-svgtext--sm">{energyKJmol(wn).toFixed(1)} kJ mol⁻¹</text>
      {/* the molecule's state */}
      <circle cx={(x0 + x1) / 2} cy={posY - 11} r="8" fill="#fcd34d" stroke="#0a1330" strokeWidth="1.5" data-testid="level-marker" data-v={up ? 1 : 0} />
      {/* absorbed photon and transition arrow */}
      {showPhoton && absorb > 0.05 && (
        <g opacity={Math.min(1, absorb)} data-testid="transition-arrow" data-opacity={Math.min(1, absorb).toFixed(2)}>
          <path d={wig} fill="none" stroke="#fb923c" strokeWidth="2.6" />
          <line x1={(x0 + x1) / 2 + 24} x2={(x0 + x1) / 2 + 24} y1={y(0) - 4} y2={y(1) + 9} stroke="#fb923c" strokeWidth="3.4" />
          <path d={`M${(x0 + x1) / 2 + 24},${y(1) + 2} l-7,13 l14,0 z`} fill="#fb923c" />
        </g>
      )}
      {mismatch && <text x={W / 2} y={H - 8} textAnchor="middle" className="ss-svgtext ss-svgtext--sm" style={{ fill: "#ffd37a" }}>photon energy ≠ ΔE: no transition</text>}
      {!mismatch && absorb > 0.5 && <text x={W / 2} y={H - 8} textAnchor="middle" className="ss-svgtext ss-svgtext--sm" style={{ fill: "#86efac" }}>photon energy = ΔE: v = 0 → v = 1</text>}
    </svg>
  );
}
