import { useState } from "react";
import { RotateCcw } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import LinkedScale from "./components/LinkedScale.jsx";
import { DEFAULT_PH, concentrationFromPH, pHFromConcentration, clampPH, clampConcentration, formatDecimal, formatPH } from "./lib/ph.js";

// Deliberately minimal, per feedback: one compact linked scale is the
// whole simulation. No separate equation panel, no attraction-style
// explanatory panels, no big control bar — just the numbers at the top,
// the equation once (small), and the scale itself doing the teaching.
export default function PHCalculatorVisualizer({ compact = false }) {
  const [pH, setPH] = useState(DEFAULT_PH);
  const [inputValue, setInputValue] = useState(() => formatDecimal(concentrationFromPH(DEFAULT_PH)));
  const [inputError, setInputError] = useState(false);

  function handleScaleChange(nextPH) {
    const clamped = clampPH(nextPH);
    setPH(clamped);
    setInputValue(formatDecimal(concentrationFromPH(clamped)));
    setInputError(false);
  }

  function commitInput() {
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed <= 0) { setInputError(true); return; }
    const nextConc = clampConcentration(parsed);
    handleScaleChange(pHFromConcentration(nextConc));
  }

  function handleReset() {
    handleScaleChange(DEFAULT_PH);
  }

  const conc = concentrationFromPH(pH);

  const body = (
    <div className="mx-auto flex flex-col gap-3.5 rounded-xl border px-5 py-4" style={{ maxWidth: 900, borderColor: "var(--color-line)", background: "var(--color-paper)" }}>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex min-h-[68px] flex-col justify-center rounded-md border px-3 py-2 text-center" style={{ borderColor: "var(--color-line)", background: "var(--color-paper-raised)" }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>[H₃O⁺] mol dm⁻³</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--color-indigo)" }}>{formatDecimal(conc)}</p>
        </div>
        <div className="flex min-h-[68px] flex-col justify-center rounded-md border px-3 py-2 text-center" style={{ borderColor: "var(--color-line)", background: "var(--color-paper-raised)" }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>pH</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--color-indigo)" }}>{formatPH(pH)}</p>
        </div>
      </div>

      <p className="text-center text-xs" style={{ color: "var(--color-ink-faint)" }}>pH = −log₁₀[H₃O⁺]</p>

      <LinkedScale pH={pH} onChange={handleScaleChange} />

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <label htmlFor="ph-quick-input" className="text-[11px]" style={{ color: "var(--color-ink-soft)" }}>Type [H₃O⁺]:</label>
        <input
          id="ph-quick-input"
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitInput}
          onKeyDown={(e) => e.key === "Enter" && commitInput()}
          className="w-28 rounded border px-2 py-1 text-xs tabular-nums"
          style={{ borderColor: inputError ? "var(--color-coral)" : "var(--color-line)", background: "var(--color-paper-raised)", color: "var(--color-ink)" }}
        />
        <button type="button" onClick={handleReset} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium" style={{ color: "var(--color-ink-soft)", border: "1px solid var(--color-line)" }}>
          <RotateCcw size={11} /> Reset
        </button>
      </div>
      {inputError && <p className="text-center text-[11px]" style={{ color: "var(--color-coral)" }}>Enter a value between 1×10⁻¹⁴ and 1 mol dm⁻³.</p>}
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame title="pH Calculator & Visualizer" subtitle="Drag the marker to link [H3O+] and pH.">
      {body}
    </InteractiveFrame>
  );
}
