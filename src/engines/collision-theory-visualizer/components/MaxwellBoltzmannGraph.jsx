import { useMemo } from "react";
import { buildCurve, fractionBeyond, ENERGY_MAX } from "../lib/maxwellBoltzmann.js";

export default function MaxwellBoltzmannGraph({ temperature, ea }) {
  const curve = useMemo(() => buildCurve(temperature), [temperature]);
  const maxF = useMemo(() => Math.max(...curve.map((p) => p.f)), [curve]);
  const fraction = useMemo(() => fractionBeyond(curve, ea), [curve, ea]);

  const W = 620, H = 240, padL = 20, padR = 16, padT = 16, padB = 30;
  function x(E) { return padL + (E / ENERGY_MAX) * (W - padL - padR); }
  function y(f) { return padT + (1 - f / (maxF * 1.15)) * (H - padT - padB); }

  const linePoints = curve.map((p) => `${x(p.E).toFixed(1)},${y(p.f).toFixed(1)}`).join(" ");
  const areaPoints = curve
    .filter((p) => p.E >= ea)
    .map((p) => `${x(p.E).toFixed(1)},${y(p.f).toFixed(1)}`)
    .join(" ");
  const areaPath = areaPoints ? `${x(ea).toFixed(1)},${y(0).toFixed(1)} ${areaPoints} ${x(ENERGY_MAX).toFixed(1)},${y(0).toFixed(1)}` : "";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Maxwell-Boltzmann energy distribution at ${temperature} kelvin, with activation energy marked; ${Math.round(fraction * 100)} percent of particles have energy at or above the activation energy`}>
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--color-ink-faint)" strokeWidth="1.2" />
        <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke="var(--color-ink-faint)" strokeWidth="1.2" />

        {areaPath && <polygon points={areaPath} fill="var(--color-coral)" opacity="0.18" />}
        <polyline points={linePoints} fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        <line x1={x(ea)} x2={x(ea)} y1={padT} y2={H - padB} stroke="var(--color-coral)" strokeWidth="1.75" strokeDasharray="5 4" />
        <text x={x(ea)} y={padT - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-coral)">Ea</text>

        <text x={x(ea) - 8} y={H - padB + 16} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)">E {"<"} Ea</text>
        <text x={x(ea) + 8} y={H - padB + 16} textAnchor="start" fontSize="10" fill="var(--color-coral)">E {"\u2265"} Ea</text>

        <text x={(padL + W - padR) / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">Kinetic energy</text>
        <text x={padL - 12} y={padT + 8} textAnchor="start" fontSize="10" fill="var(--color-ink-faint)" transform={`rotate(-90 ${padL - 12} ${padT + 8})`}>Fraction of particles</text>
      </svg>
      <p className="text-center text-xs text-[var(--color-ink-soft)]">
        {Math.round(fraction * 100)}% of particles currently have E {"\u2265"} Ea
      </p>
    </div>
  );
}
