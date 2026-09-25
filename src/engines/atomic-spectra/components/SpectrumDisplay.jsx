import { useState } from "react";
import { wavelengthToPosition, VISIBLE_MIN_NM, VISIBLE_MAX_NM } from "../lib/spectrumMath.js";
import { wavelengthToCSS } from "../lib/wavelengthColor.js";

const WIDTH = 600;
const HEIGHT = 90;

/** Emission spectrum: black background, bright lines positioned by
 * real wavelength (never evenly spaced for aesthetics). `mode="dark"`
 * (default) is emission; `mode="absorption"` instead draws a
 * continuous visible-spectrum gradient with dark lines at the same
 * positions, for later Absorption/Compare views. `rangeMin`/`rangeMax`
 * (default the full visible range) let the SAME component render a
 * magnified inset over a narrow wavelength window -- needed for lines
 * genuinely too close together to distinguish at full-spectrum scale
 * (the sodium doublet is under 1nm apart across a 370nm-wide axis). */
export default function SpectrumDisplay({ lines, mode = "emission", selectedIndex, onSelectLine, elementLabel, rangeMin = VISIBLE_MIN_NM, rangeMax = VISIBLE_MAX_NM }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const activeIndex = hoverIndex ?? selectedIndex;
  const active = activeIndex != null ? lines[activeIndex] : null;
  const visibleLines = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => line.wavelengthNm >= rangeMin && line.wavelengthNm <= rangeMax);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${elementLabel ?? ""} ${mode} spectrum, wavelength axis ${rangeMin} to ${rangeMax} nanometres`}>
        {mode === "emission" ? (
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#050608" />
        ) : (
          <>
            <defs>
              <linearGradient id="continuum-gradient" x1="0" x2="1" y1="0" y2="0">
                {Array.from({ length: 20 }, (_, i) => {
                  const t = i / 19;
                  const wl = rangeMin + t * (rangeMax - rangeMin);
                  return <stop key={i} offset={t} stopColor={wavelengthToCSS(wl)} />;
                })}
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#continuum-gradient)" />
          </>
        )}

        {visibleLines.map(({ line, i }) => {
          const x = wavelengthToPosition(line.wavelengthNm, rangeMin, rangeMax) * WIDTH;
          const isActive = i === activeIndex;
          return (
            <g key={i}>
              <line
                x1={x} y1={mode === "emission" ? 4 : 2} x2={x} y2={mode === "emission" ? HEIGHT - 4 : HEIGHT - 2}
                stroke={mode === "emission" ? wavelengthToCSS(line.wavelengthNm) : "#0A0A0C"}
                strokeWidth={isActive ? 3 : 1.6}
                opacity={mode === "emission" ? (isActive ? 1 : 0.85) : (isActive ? 0.95 : 0.7)}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={() => onSelectLine?.(i)}
              />
              {mode === "emission" && (
                <line x1={x - 4} y1="1" x2={x + 4} y2="1" stroke={wavelengthToCSS(line.wavelengthNm)} strokeWidth="6" opacity={isActive ? 0.9 : 0.4} filter="blur(2px)" />
              )}
            </g>
          );
        })}

        <line x1="0" y1={HEIGHT - 1} x2={WIDTH} y2={HEIGHT - 1} stroke="var(--color-line)" strokeWidth="1" opacity="0.4" />
        <text x="4" y={HEIGHT - 3} fontSize="8" fill="var(--color-ink-faint)">{rangeMin.toFixed(rangeMax - rangeMin < 10 ? 1 : 0)} nm</text>
        <text x={WIDTH - 4} y={HEIGHT - 3} textAnchor="end" fontSize="8" fill="var(--color-ink-faint)">{rangeMax.toFixed(rangeMax - rangeMin < 10 ? 1 : 0)} nm</text>
      </svg>

      {active && (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 rounded-md bg-[var(--color-paper-raised)] px-3 py-1.5 text-xs">
          <span className="font-semibold text-[var(--color-ink)]">{active.wavelengthNm.toFixed(1)} nm</span>
          {active.label && <span className="text-[var(--color-ink-faint)]">{active.label}</span>}
          {active.relativeIntensity && <span className="text-[var(--color-ink-faint)]">Relative intensity {active.relativeIntensity}</span>}
        </div>
      )}
    </div>
  );
}
