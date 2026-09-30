import { useState } from "react";
import { Zap } from "lucide-react";
import { SLIDER_MAX, SCALE_MARKS, sliderPositionToEnergy, energyToSliderPosition, sanitizeEnergyInput } from "../lib/energyScale.js";

export default function EnergyControl({ atomState, suppliedEnergy, onChangeSupplied, onSupply, disabled, feedback }) {
  const [inputMode, setInputMode] = useState("slider"); // "slider" | "type"
  const ie = atomState.nextIonizationEnergy;

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Supply Energy and Remove Electron</h3>

      {atomState.isFullyIonized ? (
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">All electrons have been removed &mdash; there is nothing left to ionize.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--color-ink)]">
            {ordinal(atomState.electronsRemoved + 1)} Ionization Energy (IE<sub>{atomState.electronsRemoved + 1}</sub>)
            <span className="ml-2 font-[var(--font-display)] text-lg font-semibold text-[var(--color-indigo)]">{ie?.toLocaleString()} kJ mol&#8315;&#185;</span>
          </p>

          <div className="mt-3 flex overflow-hidden rounded-md border border-[var(--color-line)] text-[11px] font-medium">
            <button type="button" onClick={() => setInputMode("slider")} aria-pressed={inputMode === "slider"} className={`flex-1 px-2 py-1 ${inputMode === "slider" ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "text-[var(--color-ink-faint)]"}`}>Slider</button>
            <button type="button" onClick={() => setInputMode("type")} aria-pressed={inputMode === "type"} className={`flex-1 px-2 py-1 ${inputMode === "type" ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "text-[var(--color-ink-faint)]"}`}>Type value</button>
          </div>

          <div className="mt-3">
            {inputMode === "slider" ? (
              <>
                <input
                  type="range"
                  min={0}
                  max={SLIDER_MAX}
                  value={energyToSliderPosition(suppliedEnergy)}
                  onChange={(e) => onChangeSupplied(sliderPositionToEnergy(e.target.value))}
                  aria-label="Energy supplied, in kilojoules per mole"
                  className="w-full accent-[var(--color-indigo)]"
                />
                <div className="mt-1 flex justify-between text-[9px] text-[var(--color-ink-faint)]">
                  {SCALE_MARKS.map((m) => <span key={m}>{m === 0 ? "0" : `10${superscript(Math.log10(m))}`}</span>)}
                </div>
              </>
            ) : (
              <input
                type="number"
                min={0}
                step="any"
                value={Number.isFinite(suppliedEnergy) ? suppliedEnergy : 0}
                onChange={(e) => onChangeSupplied(sanitizeEnergyInput(e.target.value))}
                aria-label="Energy supplied, in kilojoules per mole (exact value)"
                className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none"
              />
            )}
            <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">Supplied: <strong>{Math.round(suppliedEnergy).toLocaleString()} kJ mol&#8315;&#185;</strong></p>
          </div>

          <button
            type="button"
            onClick={onSupply}
            disabled={disabled}
            aria-label="Supply energy and remove electron"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-indigo)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Zap size={14} /> Supply Energy &amp; Remove Electron
          </button>
        </>
      )}

      {feedback && (
        <p className={`mt-3 text-sm ${feedback.tone === "success" ? "text-[var(--color-teal)]" : feedback.tone === "warn" ? "text-[var(--color-amber)]" : "text-[var(--color-ink-soft)]"}`} role="status">
          {feedback.text}
        </p>
      )}
    </div>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶" };
function superscript(n) {
  return String(Math.round(n)).split("").map((d) => SUP[d] ?? d).join("");
}
