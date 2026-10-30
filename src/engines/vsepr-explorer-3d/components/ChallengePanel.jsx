import { Check, CircleAlert } from "lucide-react";
import { ANGLE_OPTIONS, AXE_OPTIONS, CHALLENGE_STEPS, CHALLENGE_STEP_LABELS, DOMAIN_OPTIONS, ED_OPTIONS, LONE_PAIR_OPTIONS, MG_OPTIONS, isComplete } from "../model/challenge.js";

const FIELDS = [
  { key: "domains", label: "Electron domains", options: DOMAIN_OPTIONS.map((v) => ({ value: String(v), label: String(v) })) },
  { key: "lonePairs", label: "Lone pairs on central atom", options: LONE_PAIR_OPTIONS.map((v) => ({ value: String(v), label: String(v) })) },
  { key: "ed", label: "Electron-domain geometry", options: ED_OPTIONS.map((v) => ({ value: v, label: v })) },
  { key: "mg", label: "Molecular geometry", options: MG_OPTIONS.map((v) => ({ value: v, label: v })) },
  { key: "axe", label: "AXE notation", options: AXE_OPTIONS },
  { key: "angle", label: "Approximate bond angle", options: ANGLE_OPTIONS },
];
const SHORT = { domains: "Domains", lonePairs: "Lone pairs", ed: "ED geometry", mg: "Molecular geometry", axe: "AXE", angle: "Bond angle" };
const optionLabel = (f, v) => FIELDS.find((x) => x.key === f)?.options.find((o) => o.value === v)?.label ?? v;

/** The Challenge side panel: Predict -> Build -> Observe -> Explain, one molecule at a time. */
export default function ChallengePanel({ molecule, step, setStep, answers, setAnswer, result, comparison, buildSummary, showReal, setShowReal, builtAnything, onCheck, onNext, onRetry, index, total }) {
  const stepIdx = CHALLENGE_STEPS.indexOf(step);
  return (
    <section className="vx-card vx-challenge" aria-label="Challenge" data-testid="challenge-panel" data-step={step}>
      <ol className="vx-steps" aria-label="Challenge steps">
        {CHALLENGE_STEPS.map((s, i) => <li key={s} className={i === stepIdx ? "is-current" : i < stepIdx ? "is-done" : ""} aria-current={i === stepIdx ? "step" : undefined} data-testid={`step-${s}`}><span>{i + 1}</span>{CHALLENGE_STEP_LABELS[s]}</li>)}
      </ol>
      <p className="vx-ch-mol" data-testid="challenge-molecule"><small>Molecule {index + 1} of {total}</small><b>{molecule.display}</b> <span>{molecule.name}</span></p>

      {step === "predict" && (
        <div className="vx-ch-body">
          <p className="vx-ch-help">Predict the shape of <b>{molecule.display}</b>. Count the electron domains on the central <b>{molecule.central}</b> atom (a double or triple bond is one domain).</p>
          <div className="vx-ch-grid">
            {FIELDS.map((f) => (
              <label key={f.key} className="vx-field"><span>{f.label}</span>
                <select value={answers[f.key]} onChange={(e) => setAnswer(f.key, e.target.value)} data-testid={`ans-${f.key}`}>
                  <option value="" disabled>Choose…</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="vx-ch-actions"><button type="button" className="vx-btn vx-btn--primary" disabled={!isComplete(answers)} onClick={() => setStep("build")} data-testid="ch-to-build" title={isComplete(answers) ? "Next: build your prediction" : "Answer all six questions first"}>Next: Build</button></div>
        </div>
      )}

      {step === "build" && (
        <div className="vx-ch-body">
          <p className="vx-ch-help">Optional: build your prediction in the workspace (add the central atom, bonds and lone pairs), drag the atoms, and switch between the two geometry views. Then check.</p>
          <p className="vx-ch-status" data-testid="build-summary">{buildSummary}</p>
          <div className="vx-ch-actions"><button type="button" className="vx-btn" onClick={() => setStep("predict")}>Back</button><button type="button" className="vx-btn vx-btn--primary" onClick={onCheck} data-testid="ch-check">Check my prediction</button></div>
        </div>
      )}

      {(step === "observe" || step === "explain") && result && (
        <div className="vx-ch-body">
          <p className="vx-ch-score" data-testid="ch-score">{result.score} of {result.total} correct</p>
          {step === "observe" && (
            <>
              <ul className="vx-results" data-testid="ch-results">
                {result.fields.map((f) => (
                  <li key={f.key} className={f.correct ? "is-ok" : "is-bad"} data-testid={`res-${f.key}`}>
                    {f.correct ? <Check size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}
                    <span className="vx-res-l" title={f.label}>{SHORT[f.key]}</span><span className="vx-res-v">{f.correct ? optionLabel(f.key, f.yours) : <>{optionLabel(f.key, f.yours)} → <b>{f.expected}</b></>}</span>
                  </li>
                ))}
              </ul>
              <div className="vx-seg vx-seg--small" role="radiogroup" aria-label="Model shown in the viewer">
                <button type="button" role="radio" aria-checked={showReal} className="vx-seg-btn" onClick={() => setShowReal(true)} data-testid="show-real">Real molecule</button>
                <button type="button" role="radio" aria-checked={!showReal} className="vx-seg-btn" onClick={() => setShowReal(false)} disabled={!builtAnything} data-testid="show-mine" title={builtAnything ? "Show the model you built" : "You did not build a model"}>My build</button>
              </div>
              <p className="vx-ch-help" data-testid="build-compare">{comparison.text}</p>
              <div className="vx-ch-actions"><button type="button" className="vx-btn vx-btn--primary" onClick={() => setStep("explain")} data-testid="ch-to-explain">Next: Explain</button></div>
            </>
          )}
          {step === "explain" && (
            <>
              <ul className="vx-explain" data-testid="ch-explain">
                {result.fields.filter((f) => !f.correct).length === 0 && <li className="is-ok">Every answer is correct. {molecule.explain}</li>}
                {result.fields.filter((f) => !f.correct).map((f) => <li key={f.key}><b>{f.label}:</b> {f.message}</li>)}
              </ul>
              {result.fields.some((f) => !f.correct) && <p className="vx-ch-help"><b>Why this shape?</b> {molecule.explain}</p>}
              <div className="vx-ch-actions"><button type="button" className="vx-btn" onClick={onRetry} data-testid="ch-retry">Try again</button><button type="button" className="vx-btn vx-btn--primary" onClick={onNext} data-testid="ch-next">Next molecule</button></div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
