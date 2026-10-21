import { Cog, Eye, EyeOff, HelpCircle } from "lucide-react";
import { predictContent } from "../model.js";
import { DashPanel } from "../../../components/simulation/SimulationDashboard.jsx";

// Predict & Reveal: short question; the answer stays hidden until requested and
// replaces the question in the same box so the bottom row never changes height.
export function PredictPanel({ state, revealed, onToggle }) {
  const c = predictContent(state);
  return (
    <DashPanel
      title="Predict & Reveal" icon={<HelpCircle size={16} className="text-[#2F7BF5]" aria-hidden="true" />}
      ariaLabel="Predict" tint testId="predict"
      aside={
        <button type="button" className="sd-btn sd-btn--sm" onClick={onToggle} aria-expanded={revealed} data-testid="show-answer">
          {revealed ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
          {revealed ? "Hide answer" : "Show answer"}
        </button>
      }
    >
      <div aria-live="polite">
        {revealed ? (
          <p className="sd-text sd-text--lg" data-testid="predict-answer"><strong>Answer: </strong>{c.answer}</p>
        ) : (
          <p className="sd-text sd-text--lg" data-testid="predict-question">{c.question} Try adjusting the slider.</p>
        )}
      </div>
    </DashPanel>
  );
}

export function WhatIsHappening({ text, accent }) {
  return (
    <DashPanel
      title="What is happening?" icon={<Cog size={16} style={{ color: accent.solid }} aria-hidden="true" />}
      ariaLabel="What is happening?" style={{ background: accent.soft, borderColor: accent.border }} testId="happening-panel"
    >
      <p className="sd-text sd-text--lg" aria-live="polite" aria-atomic="true" data-testid="what-is-happening">{text}</p>
    </DashPanel>
  );
}
