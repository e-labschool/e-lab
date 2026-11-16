import { useState } from "react";
import { Zap } from "lucide-react";
import { SLIDER_MAX, SCALE_MARKS, sliderPositionToEnergy, energyToSliderPosition, sanitizeEnergyInput } from "../lib/energyScale.js";
import { useSimulationPresentation } from "../../../components/interactive-shell/SimulationPresentation.js";

export const MAX_ENERGY_KJ = 1_000_000; // above Ca's largest IE (527,670); typed values above this are clamped, with a message

export default function EnergyControl({ atomState, suppliedEnergy, onChangeSupplied, onSupply, disabled, feedback, prediction, onPredict, onSkip, step }) {
  const { isViewport } = useSimulationPresentation();
  const [inputMode, setInputMode] = useState("slider"); // "slider" | "type"
  const ie = atomState.nextIonizationEnergy;

  return (
    <div className={isViewport ? "shrink-0 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2.5" : "rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4"}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">Supply Energy and Remove Electron</h3>

      {atomState.isFullyIonized ? (
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">All electrons have been removed &mdash; there is nothing left to ionize.</p>
      ) : (
        <>
          {!prediction ? (
            <div className="mt-2 rounded-md border border-dashed border-[var(--color-indigo)] p-2" data-testid="ie-predict">
              <p className="text-sm font-semibold text-[var(--color-ink)]">Predict before you supply energy</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">The next electron to be removed (IE<sub>{step}</sub>) comes from which subshell?</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Predict the subshell">
                {[...new Set(atomState.occupiedSublevels)].map((sub) => (
                  <button key={sub} type="button" onClick={() => onPredict(sub)} data-testid={`ie-predict-${sub}`} className="rounded-md border border-[var(--color-line-strong,var(--color-line))] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-indigo)]">{sub}</button>
                ))}
              </div>
              <button type="button" onClick={onSkip} className="mt-1.5 text-[11px] text-[var(--color-ink-soft)] underline">Skip the prediction and show the value</button>
            </div>
          ) : (
            <div className="mt-2" data-testid="ie-revealed">
              {prediction.choice && (
                <p className={"mb-1 text-xs " + (prediction.correct ? "text-[var(--color-teal)]" : "text-[var(--color-amber)]")} data-testid="ie-prediction-feedback">
                  {prediction.correct ? `Right: the next electron comes from ${atomState.nextSublevel}.` : `You predicted ${prediction.choice}; it comes from ${atomState.nextSublevel}. Electrons are removed from the outermost occupied shell first (highest n, then highest l).`}
                </p>
              )}
              <p className="text-sm text-[var(--color-ink)]">
                {ordinal(atomState.electronsRemoved + 1)} Ionization Energy (IE<sub>{atomState.electronsRemoved + 1}</sub>)
                <span className="ml-2 font-[var(--font-display)] text-lg font-semibold text-[var(--color-indigo)]" data-testid="ie-value">{ie?.toLocaleString()} kJ mol&#8315;&#185;</span>
              </p>
              {atomState.previousIonizationEnergy != null && <p className="text-[11px] text-[var(--color-ink-soft)]" data-testid="ie-ratio">{(ie / atomState.previousIonizationEnergy).toFixed(1)} × the previous ionization energy{atomState.isInnerShellJump ? ": a jump, because this electron is in an inner shell, closer to the nucleus and less shielded." : "."}</p>}
            </div>
          )}

          <div className="mt-3 flex overflow-hidden rounded-md border border-[var(--color-line)] text-[11px] font-medium">
            <button type="button" onClick={() => setInputMode("slider")} aria-pressed={inputMode === "slider"} className={`flex-1 px-2 py-1 ${inputMode === "slider" ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "text-[var(--color-ink-soft)]"}`}>Slider</button>
            <button type="button" onClick={() => setInputMode("type")} aria-pressed={inputMode === "type"} className={`flex-1 px-2 py-1 ${inputMode === "type" ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "text-[var(--color-ink-soft)]"}`}>Type value</button>
          </div>

          <div className="mt-3">
            {inputMode === "slider" ? (
              <>
                <input
                  type="range"
                  min={0}
                  max={SLIDER_MAX}
                  value={energyToSliderPosition(suppliedEnergy)}
                  onChange={(e) => onChangeSupplied(Math.min(MAX_ENERGY_KJ, sliderPositionToEnergy(e.target.value)))}
                  aria-label="Energy supplied, in kilojoules per mole"
                  className="w-full accent-[var(--color-indigo)]"
                />
                <div className="mt-1 flex justify-between text-[9px] text-[var(--color-ink-soft)]">
                  {SCALE_MARKS.map((m) => <span key={m}>{m === 0 ? "0" : `10${superscript(Math.log10(m))}`}</span>)}
                </div>
              </>
            ) : (
              <input
                type="number"
                min={0}
                step="any"
                value={Number.isFinite(suppliedEnergy) ? suppliedEnergy : 0}
                onChange={(e) => onChangeSupplied(Math.min(MAX_ENERGY_KJ, sanitizeEnergyInput(e.target.value)))}
                max={MAX_ENERGY_KJ}
                aria-label="Energy supplied, in kilojoules per mole (exact value)"
                className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none"
              />
            )}
            {inputMode === "type" && <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">Accepted range: 0 to {MAX_ENERGY_KJ.toLocaleString()} kJ mol&#8315;&#185;. Larger values are set to the maximum.</p>}
            <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">Supplied: <strong>{Math.round(suppliedEnergy).toLocaleString()} kJ mol&#8315;&#185;</strong></p>
          </div>

          <button
            type="button"
            onClick={onSupply}
            disabled={disabled || !prediction}
            aria-label="Supply energy and remove electron"
            title={!prediction ? "Make a prediction first (or skip it)" : undefined}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-indigo)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
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
