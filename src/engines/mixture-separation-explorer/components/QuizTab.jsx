// Quiz mode (predict first): answer BEFORE seeing the experiment; then "Watch it run" opens Explore with the same mixture and
// method already assembled and running. Every answer is computed from the same property data as the simulation.
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, RotateCcw, Play, XCircle } from "lucide-react";
import { DashPanel } from "../../../components/simulation/SimulationDashboard.jsx";
import { buildQuiz } from "../model/quiz.js";
import { Rich } from "./Rich.jsx";

const N = 8;

export default function useQuizTab({ onWatch }) {
  const [seed, setSeed] = useState(1);
  const quiz = useMemo(() => buildQuiz(seed, N), [seed]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState({}); // index -> chosen option index
  const [checked, setChecked] = useState({}); // index -> true once checked
  const q = quiz[Math.min(i, quiz.length - 1)];
  const isChecked = !!checked[i];
  const choice = picked[i];
  const score = quiz.reduce((a, qq, k) => a + (checked[k] && picked[k] === qq.answer ? 1 : 0), 0);
  const answered = Object.keys(checked).length;
  const finished = answered === quiz.length;

  const pick = (k) => { if (!isChecked) setPicked((p) => ({ ...p, [i]: k })); };
  const check = () => { if (choice != null) setChecked((c) => ({ ...c, [i]: true })); };
  const next = () => setI((x) => Math.min(quiz.length - 1, x + 1));
  const again = () => { setSeed((s) => s + 1); setI(0); setPicked({}); setChecked({}); };
  const reset = () => { setSeed(1); setI(0); setPicked({}); setChecked({}); };

  const controls = (
    <div className="ms-left" data-testid="ms-left">
      <DashPanel title="Predict first" fixed className="ms-panel" testId="qz-intro">
        <p className="ms-mixinfo">Answer each question BEFORE you see the experiment. Then watch it run to check your prediction.</p>
        <ol className="ms-steps ms-steps--q" aria-label="Question progress">
          {quiz.map((qq, k) => (
            <li key={qq.id} data-state={checked[k] ? (picked[k] === qq.answer ? "right" : "wrong") : k === i ? "now" : "todo"}>
              <button type="button" onClick={() => setI(k)} aria-label={`Question ${k + 1}${checked[k] ? (picked[k] === qq.answer ? ", correct" : ", incorrect") : ""}`} aria-current={k === i ? "step" : undefined}>{k + 1}</button>
            </li>
          ))}
        </ol>
        <p className="ms-hint" data-testid="qz-score">Score: {score} of {answered} answered ({quiz.length} questions)</p>
        <div className="ms-row"><button type="button" className="sd-btn sd-btn--sm" onClick={again} data-testid="qz-new"><RotateCcw size={13} aria-hidden="true" /> New quiz</button></div>
      </DashPanel>
    </div>
  );

  const chamber = (
    <div className="ms-chamber ms-chamber--quiz" data-testid="ms-chamber" data-stage="quiz">
      <section className="ms-card ms-quiz" aria-label={`Question ${i + 1} of ${quiz.length}`} data-testid="qz-card">
        <p className="ms-qno">Question {i + 1} of {quiz.length}</p>
        <h3 className="ms-h3 ms-qprompt" id="qz-prompt" data-testid="qz-prompt"><Rich text={q.prompt} /></h3>
        <div role="radiogroup" aria-labelledby="qz-prompt" className="ms-qopts">
          {q.options.map((o, k) => {
            const state = isChecked ? (k === q.answer ? "right" : k === choice ? "wrong" : "idle") : k === choice ? "picked" : "idle";
            return (
              <button key={k} type="button" role="radio" aria-checked={choice === k} className="ms-qopt" data-state={state} onClick={() => pick(k)} disabled={isChecked && k !== q.answer && k !== choice} data-testid={`qz-opt-${k}`}
                onKeyDown={(e) => { const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0; if (d && !isChecked) { e.preventDefault(); const nk = (k + d + q.options.length) % q.options.length; pick(nk); e.currentTarget.parentElement.children[nk]?.focus(); } }}>
                <span className="ms-qmark" aria-hidden="true">{state === "right" ? <CheckCircle2 size={16} /> : state === "wrong" ? <XCircle size={16} /> : String.fromCharCode(65 + k)}</span>
                <span>{o}</span>
                {isChecked && state === "right" && <span className="ms-sr">(correct answer)</span>}
                {isChecked && state === "wrong" && <span className="ms-sr">(your answer, incorrect)</span>}
              </button>
            );
          })}
        </div>
        <div className="ms-row">
          {!isChecked && <button type="button" className="sd-btn sd-btn--primary" onClick={check} disabled={choice == null} data-testid="qz-check">Check my answer</button>}
          {isChecked && i < quiz.length - 1 && <button type="button" className="sd-btn sd-btn--primary" onClick={next} data-testid="qz-next">Next question <ChevronRight size={14} aria-hidden="true" /></button>}
          {isChecked && q.see && <button type="button" className="sd-btn" onClick={() => onWatch(q.see)} data-testid="qz-watch"><Play size={14} aria-hidden="true" /> Watch it run</button>}
        </div>
        {isChecked && (
          <div className={`ms-msg ms-msg--${choice === q.answer ? "ok" : "bad"}`} role="status" data-testid="qz-feedback">
            <b>{choice === q.answer ? "Correct. " : `Not quite: the answer is "${q.correctText}". `}</b><Rich text={q.why} />
          </div>
        )}
        {finished && <p className="ms-idea" data-testid="qz-done"><b>Quiz finished:</b> {score} out of {quiz.length}. {score === quiz.length ? "Excellent." : "Use Watch it run on the ones you missed, then try a new quiz."}</p>}
      </section>
    </div>
  );

  const graph = (
    <div className="ms-right" data-testid="ms-right">
      <section className="ms-card" aria-label="How to use the quiz">
        <h3 className="ms-h3">Why predict first?</h3>
        <p className="ms-caption">Deciding in advance which <Rich text="property" skip={["property"]} /> separates a mixture (particle size, solubility, boiling point, magnetism, sublimation, Rf) makes you notice when your idea was wrong.</p>
        <p className="ms-caption">Questions are generated from the same data as the simulation, so a result you watch can never disagree with the answer.</p>
      </section>
    </div>
  );
  const explain = isChecked ? (choice === q.answer ? "Correct. Press Watch it run to see it happen." : "Not quite. Read the explanation, then watch it run.") : "Choose an answer, then press Check my answer.";
  const live = { items: [{ id: "q", label: "Question", value: `${i + 1} / ${quiz.length}`, bg: "#eef2ff", testId: "live-q" }, { id: "s", label: "Score", value: `${score} / ${answered}`, bg: "#dcfce7", testId: "live-qscore" }] };
  return { controls, chamber, graph, explain, live, predict: null, reset, state: { i, score, answered } };
}
