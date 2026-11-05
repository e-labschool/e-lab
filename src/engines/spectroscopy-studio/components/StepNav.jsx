import { ChevronLeft, ChevronRight } from "lucide-react";
import { STEPS, canNext, canPrev } from "../state/stepMachine.js";
import { useStudio, useStudioActions } from "../state/StudioContext.jsx";

/**
 * Compact horizontal stepper with Previous / Next. Every step is always reachable (no locked steps); the experiment lives in the store.
 * Without props it is the six-step NMR stepper; the IR workspace passes its own `steps`, current `step` and handlers (same markup, same test ids).
 */
export default function StepNav({ steps = STEPS, step: stepProp, onGoto, onPrev, onNext, ariaLabel = "NMR lesson steps" }) {
  const nmrStep = useStudio((s) => s.step);
  const a = useStudioActions();
  const step = stepProp ?? nmrStep;
  const nav = { step };
  const last = steps.length;
  return (
    <nav className="ss-stepnav" aria-label={ariaLabel} data-testid="stage-stepper" data-count={last}>
      <button type="button" className="sim-btn ss-navbtn" onClick={onPrev ?? a.prevStep} disabled={onPrev ? step <= 1 : !canPrev(nav)} data-testid="step-prev" aria-label="Previous step">
        <ChevronLeft size={16} aria-hidden="true" /> <span>Previous</span>
      </button>
      <ol className="ss-steps" data-n={last}>
        {steps.map((s) => {
          const cur = s.n === step;
          return (
            <li key={s.id} className={`ss-pillwrap${cur ? " is-current" : s.n < step ? " is-done" : ""}`}>
              <button type="button" className="sim-btn ss-pill" aria-current={cur ? "step" : undefined} onClick={() => (onGoto ?? a.setStep)(s.n)} data-testid={`step-${s.n}`} title={`Step ${s.n}: ${s.title}`} aria-label={`Step ${s.n}: ${s.title}`}>
                <span className="ss-pill-n" aria-hidden="true">{s.n}</span><span className="ss-pill-label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="sim-btn sim-btn--primary ss-navbtn" onClick={onNext ?? a.nextStep} disabled={onNext ? step >= last : !canNext(nav)} data-testid="step-next" aria-label="Next step">
        <span>Next</span> <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
