import { useMemo } from "react";
import { buildCurve, fractionBeyond, ENERGY_MAX } from "../lib/maxwellBoltzmann.js";

// T1/T2/T3 mild, distinguishable colours -- restrained, not neon.
const TEMPERATURE_COLORS = { T1: "#4F7FD9", T2: "#3F9E7A", T3: "#C77B3E" };
const KEYS = ["T1", "T2", "T3"];

export default function MaxwellBoltzmannGraph({ temperatures, visible, ea }) {
  // All three curves are ALWAYS computed (not just the visible ones) so
  // the y-axis scale never changes as checkboxes are toggled -- toggling
  // a curve off hides its line/shading but never silently rescales the
  // others, which would otherwise misrepresent their relative heights.
  const curves = useMemo(
    () => ({ T1: buildCurve(temperatures.T1), T2: buildCurve(temperatures.T2), T3: buildCurve(temperatures.T3) }),
    [temperatures]
  );
  const maxF = useMemo(() => Math.max(...KEYS.flatMap((k) => curves[k].map((p) => p.f))), [curves]);
  const fractions = useMemo(() => ({ T1: fractionBeyond(curves.T1, ea), T2: fractionBeyond(curves.T2, ea), T3: fractionBeyond(curves.T3, ea) }), [curves, ea]);

  const W = 560, H = 260, padL = 22, padR = 16, padT = 16, padB = 34;
  function x(E) { return padL + (E / ENERGY_MAX) * (W - padL - padR); }
  function y(f) { return padT + (1 - f / (maxF * 1.15)) * (H - padT - padB); }

  function linePoints(curve) {
    return curve.map((p) => `${x(p.E).toFixed(1)},${y(p.f).toFixed(1)}`).join(" ");
  }
  function areaPath(curve) {
    const pts = curve.filter((p) => p.E >= ea).map((p) => `${x(p.E).toFixed(1)},${y(p.f).toFixed(1)}`).join(" ");
    return pts ? `${x(ea).toFixed(1)},${y(0).toFixed(1)} ${pts} ${x(ENERGY_MAX).toFixed(1)},${y(0).toFixed(1)}` : "";
  }

  const anyVisible = KEYS.some((k) => visible[k]);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Maxwell-Boltzmann energy distribution, with activation energy marked">
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--color-ink-faint)" strokeWidth="1.2" />
        <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke="var(--color-ink-faint)" strokeWidth="1.2" />

        {KEYS.filter((k) => visible[k]).map((key) => (
          <polygon key={`area-${key}`} points={areaPath(curves[key])} fill={TEMPERATURE_COLORS[key]} opacity="0.14" />
        ))}
        {KEYS.filter((k) => visible[k]).map((key) => (
          <polyline key={`line-${key}`} points={linePoints(curves[key])} fill="none" stroke={TEMPERATURE_COLORS[key]} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {anyVisible && (
          <>
            <line x1={x(ea)} x2={x(ea)} y1={padT} y2={H - padB} stroke="var(--color-coral)" strokeWidth="1.75" strokeDasharray="5 4" />
            <text x={x(ea)} y={padT - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-coral)">Ea</text>
          </>
        )}

        <text x={(padL + W - padR) / 2} y={H - 18} textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">Kinetic energy</text>
        <text x={padL - 12} y={padT + 8} textAnchor="start" fontSize="10" fill="var(--color-ink-faint)" transform={`rotate(-90 ${padL - 12} ${padT + 8})`}>Fraction of particles</text>
      </svg>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-[11px]">
        {KEYS.map((key) => (
          <span key={key} className="flex items-center gap-1.5" style={{ color: visible[key] ? TEMPERATURE_COLORS[key] : "var(--color-ink-faint)" }}>
            <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: visible[key] ? TEMPERATURE_COLORS[key] : "var(--color-ink-faint)" }} />
            {key} = {temperatures[key]} K {visible[key] && `\u00b7 ${Math.round(fractions[key] * 100)}% E \u2265 Ea`}
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-[var(--color-ink-soft)]">
        {"Higher temperature \u2192 greater fraction of particles with E \u2265 Ea"}
      </p>
    </div>
  );
}
