import { STEPS } from "../state/stepMachine.js";
import { TeacherDisclosure } from "./ui.jsx";

/**
 * The layout every step shares: a large visual on the left (viz) with the step's principal control strip under it, and a narrow panel
 * on the right with the title, the short explanation and the optional teacher disclosure. The shell turns this into a single column when
 * the dashboard is stacked (container-driven, never the window width).
 */
export default function StepFrame({ step, viz, strip, children, teacher, vizTestId = "step-viz", vizClass = "" }) {
  const info = STEPS[step - 1];
  return (
    <div className="ss-frame" data-testid={`step-view-${step}`} data-step={step}>
      <div className="ss-vizcol">
        <div className={`ss-viz ${vizClass}`} data-testid={vizTestId}>{viz}</div>
        {strip && <div className="ss-strip" data-testid="step-strip">{strip}</div>}
      </div>
      <aside className="ss-panel" aria-label={`Step ${step}: ${info.title}`} data-testid="step-panel">
        <p className="ss-kicker">Step {step} of {STEPS.length}</p>
        <h3 className="ss-ptitle" data-testid="step-title">{info.title}</h3>
        <div className="ss-pbody">{children}</div>
        <TeacherDisclosure>{teacher}</TeacherDisclosure>
      </aside>
    </div>
  );
}
