import { STAGES } from "../state/studioState.js";

/** Compact horizontal stepper. Every stage is always reachable (no locked steps); the experiment lives in the store, not in the stage. */
export default function StageStepper({ stage, onChange }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  return (
    <nav className="ss-stepper" aria-label="NMR lesson stages" data-testid="stage-stepper">
      <ol>
        {STAGES.map((s, i) => {
          const current = s.id === stage;
          return (
            <li key={s.id} className={"ss-step" + (current ? " is-current" : i < idx ? " is-before" : "")}>
              <button
                type="button" className="ss-step-btn" aria-current={current ? "step" : undefined} onClick={() => onChange(s.id)}
                data-testid={`stage-${s.id}`} title={`${s.n}. ${s.label}: ${s.sub}`}
              >
                <span className="ss-step-n" aria-hidden="true">{s.n}</span>
                <span className="ss-step-text"><span className="ss-step-label">{s.label}</span><span className="ss-step-sub">{s.sub}</span></span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
