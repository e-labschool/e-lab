import { Lightbulb } from "lucide-react";
import { DashPanel } from "../../../components/simulation/SimulationDashboard.jsx";

// Short, state-aware explanation (chosen by model.selectExplanation, debounced
// by the parent). aria-live="polite" so screen readers get settled updates.
export default function WhatIsHappening({ text }) {
  return (
    <DashPanel
      title="What Is Happening?" icon={<Lightbulb size={16} className="text-[#2F7BF5]" aria-hidden="true" />}
      ariaLabel="What Is Happening?" tint testId="happening-panel"
    >
      <p className="sd-text sd-text--lg" aria-live="polite" aria-atomic="true" data-testid="what-is-happening">{text}</p>
    </DashPanel>
  );
}
