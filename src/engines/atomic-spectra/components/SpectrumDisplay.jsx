import { useEffect, useRef, useState } from "react";
import { wavelengthToPosition, VISIBLE_MIN_NM, VISIBLE_MAX_NM } from "../lib/spectrumMath.js";
import { wavelengthToCSS } from "../lib/wavelengthColor.js";
import { vacuumToAirNm } from "../lib/airVacuum.js";
import { tickStep, placeLineLabels } from "../lib/spectrumLayout.js";

const BAR_H = 96; // height of the spectrum itself (px)
const AXIS_H = 34; // tick labels + axis title below it
const LABEL_H = 30; // wavelength labels above it (two staggered rows)

export { tickStep, placeLineLabels };

function useWidth(ref, fallback = 600) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return undefined;
    const m = () => { const r = el.getBoundingClientRect(); if (r.width > 40) setW(Math.floor(r.width)); };
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Spectrum drawn in real pixels (1 SVG unit = 1 CSS px, so text stays readable on a phone): lines placed by true wavelength, a wavelength axis
 * with ticks, labelled lines (collision-checked), keyboard-focusable lines with a wide hit area, and a readout that says whether a wavelength is
 * an AIR or a VACUUM value (hydrogen is computed in vacuum; lamp tables are in air). `mode="emission"` = bright lines on black; `"absorption"` =
 * continuum with dark lines. rangeMin/rangeMax give the magnified inset used for the sodium doublet. */
export default function SpectrumDisplay({ lines, mode = "emission", selectedIndex, onSelectLine, elementLabel, rangeMin = VISIBLE_MIN_NM, rangeMax = VISIBLE_MAX_NM, ultraviolet = false, medium = "air" }) {
  const wrap = useRef(null); const W = useWidth(wrap);
  const [hoverIndex, setHoverIndex] = useState(null);
  const activeIndex = hoverIndex ?? selectedIndex;
  const active = activeIndex != null ? lines[activeIndex] : null;
  const visibleLines = lines.map((line, i) => ({ line, i })).filter(({ line }) => line.wavelengthNm >= rangeMin && line.wavelengthNm <= rangeMax);
  const xOf = (nm) => wavelengthToPosition(nm, rangeMin, rangeMax) * W;
  const span = rangeMax - rangeMin; const step = tickStep(span);
  const ticks = []; for (let v = Math.ceil(rangeMin / step) * step; v <= rangeMax + 1e-9; v += step) ticks.push(Number(v.toFixed(3)));
  const dec = step < 1 ? 1 : 0;
  const labelled = placeLineLabels(visibleLines.map(({ line, i }) => ({ x: xOf(line.wavelengthNm), i })), 30);
  const top = LABEL_H; const gid = `cg-${ultraviolet ? "uv" : "vis"}-${rangeMin}`;
  const H = top + BAR_H + AXIS_H;

  return (
    <div className="w-full" ref={wrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="group" aria-label={`${elementLabel ?? ""} ${mode} spectrum, wavelength axis ${rangeMin} to ${rangeMax} nanometres`}>
        {mode === "emission" ? (
          <rect x="0" y={top} width={W} height={BAR_H} fill="#050608" rx="4" />
        ) : (
          <>
            <defs>
              <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
                {Array.from({ length: 24 }, (_, i) => { const t = i / 23; return <stop key={i} offset={t} stopColor={ultraviolet ? "#4b3b7a" : wavelengthToCSS(rangeMin + t * span)} />; })}
              </linearGradient>
            </defs>
            <rect x="0" y={top} width={W} height={BAR_H} fill={`url(#${gid})`} rx="4" />
          </>
        )}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={xOf(v)} x2={xOf(v)} y1={top + BAR_H} y2={top + BAR_H + 6} stroke="var(--color-ink-soft)" />
            <text x={xOf(v) < 20 ? 1 : xOf(v) > W - 20 ? W - 1 : xOf(v)} y={top + BAR_H + 19} textAnchor={xOf(v) < 20 ? "start" : xOf(v) > W - 20 ? "end" : "middle"} fontSize="11" fill="var(--color-ink-soft)">{v.toFixed(dec)}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 3} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink-soft)">Wavelength / nm{medium === "air" ? " (in air)" : " (in vacuum)"}</text>

        {visibleLines.map(({ line, i }) => {
          const x = xOf(line.wavelengthNm); const isActive = i === activeIndex;
          const fire = () => onSelectLine?.(i);
          return (
            <g key={i}>
              <line x1={x} y1={top + (mode === "emission" ? 4 : 2)} x2={x} y2={top + BAR_H - (mode === "emission" ? 4 : 2)}
                stroke={mode === "emission" ? wavelengthToCSS(line.wavelengthNm) : (ultraviolet ? "#f3ecff" : "#0A0A0C")}
                strokeWidth={isActive ? 3.5 : 2} opacity={mode === "emission" ? (isActive ? 1 : 0.9) : (isActive ? 0.95 : 0.75)} />
              {mode === "emission" && <line x1={x} y1={top + 4} x2={x} y2={top + BAR_H - 4} stroke={wavelengthToCSS(line.wavelengthNm)} strokeWidth="7" opacity={isActive ? 0.35 : 0.14} filter="blur(2px)" />}
              <rect x={x - 7} y={top} width="14" height={BAR_H} fill="transparent" style={{ cursor: "pointer" }} tabIndex={0} role="button" data-testid="spectrum-line"
                aria-label={`${line.wavelengthNm.toFixed(1)} nanometre line${line.label ? ", " + line.label : ""}`}
                onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} onClick={fire} onFocus={() => setHoverIndex(i)} onBlur={() => setHoverIndex(null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); } }} />
            </g>
          );
        })}
        {labelled.map(({ i, x, row }) => {
          const l = lines[i]; const y = row === 0 ? top - 6 : top - 18;
          return <text key={`l${i}`} x={Math.min(W - 14, Math.max(14, x))} y={y} textAnchor="middle" fontSize="11" fontWeight={i === activeIndex ? 700 : 500} fill="var(--color-ink)">{l.wavelengthNm.toFixed(0)}</text>;
        })}
      </svg>

      {active && (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 rounded-md bg-[var(--color-paper-raised)] px-3 py-1.5 text-xs" data-testid="spectrum-readout">
          <span className="font-semibold text-[var(--color-ink)]">{active.wavelengthNm.toFixed(active.wavelengthNm < 100 ? 2 : 1)} nm {medium === "vacuum" ? "(vacuum)" : "(air)"}</span>
          {medium === "vacuum" && !ultraviolet && <span className="text-[var(--color-ink-soft)]">{vacuumToAirNm(active.wavelengthNm).toFixed(2)} nm in air</span>}
          {active.transition && <span className="text-[var(--color-ink-soft)]">{`n = ${active.transition.from} → ${active.transition.to}`}</span>}
          {ultraviolet && <span className="text-[var(--color-ink-faint)]">ultraviolet, not visible to the eye</span>}
          {active.label && <span className="text-[var(--color-ink-faint)]">{active.label}</span>}
          {active.relativeIntensity && <span className="text-[var(--color-ink-faint)]">Relative intensity {active.relativeIntensity}</span>}
        </div>
      )}
    </div>
  );
}
