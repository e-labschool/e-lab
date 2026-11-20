import { useEffect, useRef, useState } from "react";
import { SCENARIOS, CHOICES, scenarioConfigs, measureRate, classifyRatio } from "../lib/scenarios.js";

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/**
 * Predict-first panel (inside the shell's Predict popover). Choose an experiment, commit to a prediction, then reveal:
 * the reveal RUNS the engine before and after the change (fixed seeds) and shows the measured initial rates.
 */
export default function PredictPanel({ onSetup, onApply, resetToken }) {
  const [id, setId] = useState(SCENARIOS[0].id);
  const [choice, setChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setChoice(null); setResult(null); }, [id, resetToken]);
  const sc = SCENARIOS.find((s) => s.id === id);

  async function reveal() {
    if (!choice || busy) return;
    setBusy(true); setResult(null);
    await tick(30);
    const { base, changed } = scenarioConfigs(sc);
    const opts = { reps: 6, duration: 6 };
    const before = measureRate(base, opts);
    await tick(10);
    const after = measureRate(changed, opts);
    if (!alive.current) return;
    const ratio = before > 0 ? after / before : after > 0 ? Infinity : 1;
    setResult({ before, after, ratio, outcome: classifyRatio(ratio) });
    setBusy(false);
  }
  const label = (cid) => CHOICES.find((c) => c.id === cid)?.label ?? cid;
  return (
    <div className="ct-predict" data-testid="predict-panel">
      <label className="ct-field">
        <span>Experiment</span>
        <select value={id} onChange={(e) => setId(e.target.value)} data-testid="predict-scenario" aria-label="Choose an experiment">
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </label>
      <p className="sd-pop-q" data-testid="predict-question">{sc.question}</p>
      <fieldset className="ct-choices">
        <legend className="ct-sr">Your prediction</legend>
        {CHOICES.map((c) => (
          <label key={c.id} className="ct-choice">
            <input type="radio" name="ct-predict" value={c.id} checked={choice === c.id} onChange={() => { setChoice(c.id); setResult(null); }} data-testid={`predict-choice-${c.id}`} />
            <span>{c.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="ct-predict-actions">
        <button type="button" className="sd-btn sd-btn--sm" onClick={() => onSetup(sc)} data-testid="predict-setup" title="Reset the vessel to this experiment's starting conditions and run 30 s of baseline">1. Set up baseline</button>
        <button type="button" className="sd-btn sd-btn--sm" onClick={() => onApply(sc)} data-testid="predict-apply" title={`Change the vessel now: ${sc.changeText}. Watch the concentration graph and the rate in the stats bar.`}>2. Apply the change</button>
        <button type="button" className="sd-btn sd-btn--sm sd-btn--primary" onClick={reveal} disabled={!choice || busy} data-testid="predict-reveal" title={choice ? "Run the model before and after the change" : "Choose a prediction first"}>
          {busy ? "Measuring…" : "3. Reveal and measure"}
        </button>
      </div>
      {!choice && <p className="ct-hint">Choose a prediction to enable the reveal.</p>}
      {result && (
        <div aria-live="polite" data-testid="predict-result" className="ct-result">
          <p><strong>{choice === result.outcome ? "Your prediction matches the measurement." : "Not quite."}</strong> The model shows: {label(result.outcome).toLowerCase()}.</p>
          <p data-testid="predict-numbers">Measured initial rate: <b>{result.before.toFixed(2)}</b> {"→"} <b>{result.after.toFixed(2)}</b> reactions s{"⁻¹"} ({Number.isFinite(result.ratio) ? `×${result.ratio.toFixed(2)}` : "from zero"}) after changing {sc.changeText}. Mean of 3 seeded runs of 50 s each.</p>
          <p>{sc.why}</p>
        </div>
      )}
    </div>
  );
}
