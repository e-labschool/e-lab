import { ChevronLeft, ChevronRight } from "lucide-react";
import { STEPS, canNext, canPrev } from "../state/stepMachine.js";
import { useStudio, useStudioActions } from "../state/StudioContext.jsx";

/** Compact horizontal six-step stepper with Previous / Next. Every step is always reachable (no locked steps); the experiment lives in the store. */
export default function StepNav() {
  const step = useStudio((s) => s.step);
  const a = useStudioActions();
  const nav = { step };
  return (
    <nav className="ss-stepnav" aria-label="NMR lesson steps" data-testid="stage-stepper">
      <button type="button" className="sim-btn ss-navbtn" onClick={a.prevStep} disabled={!canPrev(nav)} data-testid="step-prev" aria-label="Previous step">
        <ChevronLeft size={16} aria-hidden="true" /> <span>Previous</span>
      </button>
      <ol className="ss-steps">
        {STEPS.map((s) => {
          const cur = s.n === step;
          return (
            <li key={s.id} className={`ss-pillwrap${cur ? " is-current" : s.n < step ? " is-done" : ""}`}>
              <button type="button" className="sim-btn ss-pill" aria-current={cur ? "step" : undefined} onClick={() => a.setStep(s.n)} data-testid={`step-${s.n}`} title={`Step ${s.n}: ${s.title}`} aria-label={`Step ${s.n}: ${s.title}`}>
                <span className="ss-pill-n" aria-hidden="true">{s.n}</span><span className="ss-pill-label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="sim-btn sim-btn--primary ss-navbtn" onClick={a.nextStep} disabled={!canNext(nav)} data-testid="step-next" aria-label="Next step">
        <span>Next</span> <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
