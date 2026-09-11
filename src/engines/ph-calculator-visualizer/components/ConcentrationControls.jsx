import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { PH_MIN, PH_MAX, DEFAULT_PH, concentrationFromPH, pHFromConcentration, clampPH, clampConcentration, formatDecimal } from "../lib/ph.js";

const TICKS = Array.from({ length: PH_MAX - PH_MIN + 1 }, (_, i) => PH_MIN + i);

export default function ConcentrationControls({ pH, onChange }) {
  const [inputValue, setInputValue] = useState(() => formatDecimal(concentrationFromPH(pH)));
  const [inputError, setInputError] = useState(false);

  function handleSlider(e) {
    const nextPH = clampPH(Number(e.target.value));
    onChange(nextPH);
    setInputValue(formatDecimal(concentrationFromPH(nextPH)));
    setInputError(false);
  }

  function commitInput() {
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setInputError(true);
      return;
    }
    const nextConc = clampConcentration(parsed);
    const nextPH = clampPH(pHFromConcentration(nextConc));
    onChange(nextPH);
    setInputValue(formatDecimal(nextConc));
    setInputError(false);
  }

  function handleReset() {
    onChange(DEFAULT_PH);
    setInputValue(formatDecimal(concentrationFromPH(DEFAULT_PH)));
    setInputError(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="ph-conc-slider" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>
          Hydronium concentration (log scale)
        </label>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
          style={{ color: "var(--color-ink-soft)", border: "1px solid var(--color-line)" }}
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      <input
        id="ph-conc-slider"
        type="range"
        min={PH_MIN}
        max={PH_MAX}
        step={0.01}
        value={pH}
        onChange={handleSlider}
        className="w-full accent-[var(--color-indigo)]"
        aria-label="Hydronium ion concentration, on a logarithmic scale"
      />

      <div className="relative flex justify-between px-0.5 text-[9px] tabular-nums" style={{ color: "var(--color-ink-faint)" }}>
        {TICKS.map((t) => (
          <span key={t} className="flex flex-col items-center">
            <span className="h-1.5 w-px" style={{ background: "var(--color-line)" }} />
            {t}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <label htmlFor="ph-conc-input" className="text-[11px]" style={{ color: "var(--color-ink-soft)" }}>
          Type [H₃O⁺] directly:
        </label>
        <input
          id="ph-conc-input"
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitInput}
          onKeyDown={(e) => e.key === "Enter" && commitInput()}
          className="w-32 rounded border px-2 py-1 text-sm tabular-nums"
          style={{ borderColor: inputError ? "var(--color-coral)" : "var(--color-line)", background: "var(--color-paper-raised)", color: "var(--color-ink)" }}
        />
        <span className="text-[11px]" style={{ color: "var(--color-ink-faint)" }}>mol dm⁻³</span>
      </div>
      {inputError && (
        <p className="text-[11px]" style={{ color: "var(--color-coral)" }}>
          Enter a concentration between 1×10⁻¹⁴ and 1 mol dm⁻³.
        </p>
      )}
    </div>
  );
}
