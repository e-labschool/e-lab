import { useState } from "react";
import { phChallenge, checkPhAnswer } from "../../../lib/acidbase/challenges.js";

/** AK-07: predict / convert / check strip. Seeds are drawn from a counter so Reset gives the same first question. */
export default function PhChallenge({ onShowOnScale, resetKey = 0 }) {
  const [n, setN] = useState(1); const [lastReset, setLastReset] = useState(resetKey);
  const [text, setText] = useState(""); const [res, setRes] = useState(null); const [work, setWork] = useState(false);
  const [score, setScore] = useState({ right: 0, tried: 0 }); const [counted, setCounted] = useState(false);
  if (resetKey !== lastReset) { setLastReset(resetKey); setN(1); setText(""); setRes(null); setWork(false); setScore({ right: 0, tried: 0 }); setCounted(false); }
  const ch = phChallenge(n * 7919 + 13);
  const next = () => { setN((x) => x + 1); setText(""); setRes(null); setWork(false); setCounted(false); };
  const check = () => {
    const r = checkPhAnswer(ch, text); setRes(r);
    if (r.message.startsWith("Type a number")) return;
    if (!counted) { setCounted(true); setScore((s) => ({ right: s.right + (r.ok ? 1 : 0), tried: s.tried + 1 })); }
  };
  const answerPH = ch.kind === "ph-to-conc" ? ch.pH : ch.answer; // the pH to show on the scale
  return (
    <section className="phc-chal" aria-label="Practice question" data-testid="phc-challenge">
      <header><h3>Try it yourself</h3><span className="phc-score" aria-live="polite">{score.tried ? `${score.right} of ${score.tried} correct` : "Syllabus S1.4 / R3.1: pH = −log₁₀[H₃O⁺]"}</span></header>
      <p className="phc-q" data-testid="phc-question">{ch.prompt}</p>
      <div className="phc-chal-row">
        <input type="text" inputMode="decimal" aria-label="Your answer" value={text} placeholder="Your answer" onChange={(e) => { setText(e.target.value); setRes(null); }} onKeyDown={(e) => e.key === "Enter" && check()} aria-invalid={res ? !res.ok : undefined} aria-describedby="phc-chal-msg" />
        <button type="button" className="sim-btn phc-b" onClick={check}>Check</button>
        <button type="button" className="sim-btn phc-b" onClick={() => setWork((w) => !w)} aria-expanded={work}>{work ? "Hide working" : "Show working"}</button>
        <button type="button" className="sim-btn phc-b" onClick={() => onShowOnScale(answerPH)} title="Move the marker on the pH scale to this value">Show on scale</button>
        <button type="button" className="sim-btn phc-b" onClick={next}>New question</button>
      </div>
      <p id="phc-chal-msg" className={"phc-chal-msg" + (res ? (res.ok ? " is-ok" : " is-bad") : "")} role="status" data-testid="phc-result">{res ? res.message : ""}</p>
      {work && <p className="phc-work" data-testid="phc-working">{ch.working}</p>}
    </section>
  );
}
