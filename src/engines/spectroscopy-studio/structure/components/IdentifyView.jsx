import { useState } from "react";
import { ArrowLeft, Check, Lightbulb } from "lucide-react";
import Skeletal from "./Skeletal.jsx";
import useInvestigation from "./useInvestigation.js";
import { STRUCTURES } from "../data/structures.js";
import { choiceOrder, justificationOk, wordCount, MIN_JUSTIFICATION_WORDS } from "../model/levels.js";
import { explanationFor, feedbackFor, hintsFor } from "../model/evaluate.js";

const LETTERS = ["A", "B", "C", "D"];

/** Stage 5: four candidate structures, Submit, feedback that names the conflicting evidence (never the answer), hints, "Show solution" and the full explanation. */
export default function IdentifyView() {
  const { store, compound, level, work } = useInvestigation();
  const order = choiceOrder(compound.id); const a = work.id;
  const [last, setLast] = useState(null); // feedback of the latest submission (derived again from the record, never persisted)
  const hints = hintsFor(compound, level.id);
  const done = a.solved || a.shown;
  const needJust = level.justification && !justificationOk(a.justification);
  const feedback = last && last.choice === a.choice ? last.fb : null;
  const submit = () => {
    if (!a.choice || done || needJust) return;
    const fb = feedbackFor(compound, a.choice);
    store.submit(fb.correct); setLast({ choice: a.choice, fb });
  };
  const choose = (id) => { if (done) return; store.choose(id); setLast(null); };
  const explanation = done ? explanationFor(compound) : null;
  return (
    <div className="st-view st-view--identify" data-testid="identify-view">
      <div className="st-plotcol">
        <div className="st-choices" role="radiogroup" aria-label="Which structure fits the evidence?" data-testid="choices">
          {order.map((id, i) => {
            const st = STRUCTURES[id]; const on = a.choice === id; const bad = a.wrong.includes(id);
            return (
              <button key={id} type="button" role="radio" aria-checked={on} className={`st-choice${on ? " is-on" : ""}${bad ? " is-bad" : ""}${done && id === compound.id ? " is-right" : ""}`} onClick={() => choose(id)} disabled={done && id !== a.choice && id !== compound.id}
                data-testid={`choice-${i}`} data-structure={id} aria-label={`Structure ${LETTERS[i]}: ${st.name}, ${st.formula}`}>
                <span className="st-choicehead"><span className="st-letter">{LETTERS[i]}</span><span className="st-choicename">{st.name}</span>{on && <Check size={15} aria-hidden="true" />}</span>
                <Skeletal id={id} size={104} testId={`structure-${i}`} />
                <span className="st-choiceformula">{st.formulaPretty}{bad ? " · conflicts with the evidence" : ""}{done && id === compound.id ? " · fits all the evidence" : ""}</span>
              </button>
            );
          })}
        </div>
        <div className="st-toolbar" role="group" aria-label="Return to the spectra">
          <div className="st-btnrow">
            <span className="st-muted st-small">Review the evidence:</span>
            {[["ms", 2, "Mass spectrum"], ["ir", 3, "IR spectrum"], ["nmr", 4, "¹H NMR"]].map(([id, n, label]) => <button key={id} type="button" className="sim-btn st-tbtn" onClick={() => store.setStage(n)} data-testid={`back-${id}`}><ArrowLeft size={14} aria-hidden="true" /> <span>{label}</span></button>)}
          </div>
        </div>
      </div>
      <aside className="st-panel" aria-label="Answer and feedback" data-testid="identify-panel">
        <p className="ss-kicker">Identify the structure</p>
        <p className="st-lead">Which of the four structures fits ALL of the evidence?{level.formulaGiven ? <> The formula is <b>{compound.formulaPretty}</b>, but some choices have a different formula.</> : " The formula is not given."}</p>
        {level.justification && !done && (
          <label className="st-field">
            <span className="st-fieldlabel">Justify your choice using the mass spectrum, IR and ¹H NMR evidence (at least {MIN_JUSTIFICATION_WORDS} words)</span>
            <textarea className="st-textarea" rows={4} value={a.justification} onChange={(e) => store.setJustification(e.target.value)} data-testid="justification" placeholder="Write your reasoning here" />
            <span className="st-muted st-small" data-testid="justification-count">{wordCount(a.justification)} / {MIN_JUSTIFICATION_WORDS} words</span>
          </label>
        )}
        <div className="st-btnrow">
          <button type="button" className="sim-btn sim-btn--primary st-tbtn st-tbtn--big" onClick={submit} disabled={!a.choice || done || needJust} data-testid="submit-answer" title={needJust ? `Write your justification first (${MIN_JUSTIFICATION_WORDS} words)` : "Submit your answer"}>Submit</button>
          <button type="button" className="sim-btn st-tbtn" onClick={() => store.useHint(level.hints)} disabled={done || a.hints >= level.hints} data-testid="hint-button"><Lightbulb size={14} aria-hidden="true" /> <span>Hint ({a.hints}/{level.hints})</span></button>
          <button type="button" className="sim-btn st-tbtn" onClick={store.showSolution} disabled={done} data-testid="show-solution">Show solution</button>
        </div>
        {a.hints > 0 && (
          <ol className="st-hints" aria-label="Hints" data-testid="hints">
            {hints.slice(0, a.hints).map((h, i) => <li key={i} data-testid={`hint-${i}`}>{h}</li>)}
          </ol>
        )}
        {needJust && a.choice && <p className="st-muted st-small" data-testid="justification-needed">Write your justification before you submit.</p>}
        {feedback && !feedback.correct && (
          <div className="st-feedback is-no" role="status" data-testid="feedback">
            <p><b>{feedback.text}</b></p>
            {feedback.conflicts.length > 0 && <ul>{feedback.conflicts.map((c, i) => <li key={i} data-tech={c.tech}><span className="st-techtag">{c.tech === "ms" ? "MS" : c.tech === "ir" ? "IR" : "¹H NMR"}</span> {c.text}</li>)}</ul>}
            <p className="st-muted">Go back to the spectra and reconsider, then choose again.</p>
          </div>
        )}
        {a.solved && <p className="st-feedback is-ok" role="status" data-testid="feedback-correct"><b>Correct.</b> This structure fits the mass spectrum, the IR spectrum and the ¹H NMR spectrum. {a.attempts === 1 ? "First attempt." : `${a.attempts} attempts.`}</p>}
        {a.shown && !a.solved && <p className="st-feedback" role="status" data-testid="feedback-shown">The solution was shown, so this unknown does not count as solved by you. Read the explanation, then try another unknown.</p>}
        {explanation && (
          <section className="st-explain" aria-label="Full explanation" data-testid="explanation">
            <h3 className="st-exptitle">{explanation.title}</h3>
            {explanation.sections.map((s) => (
              <div key={s.tech} className="st-expsec" data-testid={`explain-${s.tech}`}>
                <h4>{s.heading}</h4>
                <ul>{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
            ))}
            <p className="st-conclusion"><b>{explanation.conclusion}</b></p>
          </section>
        )}
        {done && <div className="st-btnrow"><button type="button" className="sim-btn sim-btn--primary st-tbtn" onClick={() => store.moveUnknown(1)} data-testid="next-unknown">Next unknown</button><button type="button" className="sim-btn st-tbtn" onClick={() => store.setStage(1)} data-testid="to-sample">Sample card</button></div>}
      </aside>
    </div>
  );
}
