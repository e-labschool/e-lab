import { PredictPopover } from "../../../components/simulation/SimulationDashboard.jsx";
import { MODES, predictContent } from "../model.js";
import { lawHeading } from "../lawInfo.js";

// Predict: a small optional button; the question and (on request) the answer float above the strip.
export function PredictPanel({ state, revealed, onToggle }) {
  const c = predictContent(state);
  return <PredictPopover question={`${c.question} Try adjusting the slider.`} answer={c.answer} revealed={revealed} onToggle={onToggle} />;
}

/** The optional detail behind the (i) icon next to the one-line explanation. */
export function ExplanationDetails({ mode, note }) {
  const m = MODES[mode];
  return (
    <>
      <p className="sd-pop-note" style={{ marginBottom: note ? 6 : 0 }} data-testid="relationship-detail">
        <strong>{lawHeading(mode)} ({m.short}):</strong> <em>{m.relation}</em> {m.constantText}. {m.sentence}
      </p>
      {note && <p className="sd-pop-note" style={{ marginBottom: 0 }} data-testid="what-is-happening-detail"><strong>What is happening:</strong> {note}</p>}
    </>
  );
}
