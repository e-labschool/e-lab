import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Card } from "./parts.jsx";
import { BondArrowOption, MoleculeSketch } from "./Sketch.jsx";
import { ROUND_LENGTH, buildRound, check, stars } from "../model/challenge.js";
import { elementBond } from "../../shared-3d/electronCloud/electronegativity.js";

function Visual({ q, answered }) {
  const v = q.visual;
  if (v.kind === "molecule") return <MoleculeSketch id={v.id} reveal={answered} />;
  const bond = elementBond(v.a, v.b);
  return (
    <div className="pp-pairvis" data-testid="pair-visual"><span className="pp-atomchip">{v.a}</span><span className="pp-dash">—</span><span className="pp-atomchip">{v.b}</span>
      {answered && !bond.equal && <p className="pp-hint" data-testid="pair-reveal">{bond.less} δ+ → {bond.more} δ− (ΔEN {bond.dEN.toFixed(2)})</p>}</div>
  );
}
export default function ChallengeTab() {
  const [seed, setSeed] = useState(1); const round = useMemo(() => buildRound(seed), [seed]);
  const [i, setI] = useState(0); const [picks, setPicks] = useState([]); const [done, setDone] = useState(false);
  const q = round[i]; const pick = picks[i]; const answered = pick !== undefined; const res = answered ? check(q, pick) : null;
  const score = picks.filter((p, k) => p === round[k].right).length;
  const choose = (id) => { if (!answered) setPicks((a) => { const n = [...a]; n[i] = id; return n; }); };
  const next = () => { if (i + 1 >= ROUND_LENGTH) setDone(true); else setI(i + 1); };
  const again = () => { setSeed((s) => s + 1); setI(0); setPicks([]); setDone(false); };
  const st = stars(score);
  return (
    <div className="pp-tabpanel pp-tabpanel--challenge" data-testid="tab-challenge" role="tabpanel" aria-labelledby="pp-tab-challenge">
      <Card className="pp-card--wide" title={<><span className="pp-n">4</span>Polarity Challenge</>}
        aside={<div className="pp-dots" role="img" aria-label={`Question ${Math.min(i + 1, ROUND_LENGTH)} of ${ROUND_LENGTH}`} data-testid="progress"><span>Question {Math.min(i + 1, ROUND_LENGTH)} of {ROUND_LENGTH}</span>{round.map((r, k) => <i key={r.id} className={"pp-dot" + (picks[k] !== undefined ? (picks[k] === r.right ? " is-ok" : " is-no") : k === i && !done ? " is-now" : "")} />)}</div>}>
        {!done ? (
          <div className="pp-q" data-testid="question" data-type={q.type}>
            <div className="pp-q-main">
              <p className="pp-q-prompt" data-testid="prompt">{q.prompt}</p>
              <Visual q={q} answered={answered} />
            </div>
            <div className="pp-q-side">
              <div className="pp-options" role="radiogroup" aria-label="Answers">
                {q.options.map((o) => {
                  const state = !answered ? "" : o.id === q.right ? " is-right" : o.id === pick ? " is-wrong" : "";
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={pick === o.id} disabled={answered && o.id !== pick && o.id !== q.right} className={"pp-option" + state} onClick={() => choose(o.id)} data-testid={`option-${o.id}`} data-correct={answered && o.id === q.right ? "1" : undefined}>
                      {q.type === "arrow" ? <BondArrowOption a={q.visual.a} b={q.visual.b} tail={o.arrow.tail} /> : o.label}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <div className={"pp-feedback " + (res.correct ? "is-ok" : "is-no")} role="status" data-testid="feedback"><b>{res.correct ? "Correct!" : "Not quite."}</b> {res.explain}
                  <div className="pp-btnrow"><button type="button" className="pp-btn pp-btn--primary" onClick={next} data-testid="next">{i + 1 >= ROUND_LENGTH ? "See my result" : "Next question"}</button></div></div>
              )}
            </div>
          </div>
        ) : (
          <div className="pp-done" data-testid="done">
            <p className="pp-bigscore" data-testid="score">{score} / {ROUND_LENGTH}</p>
            <div className="pp-stars" role="img" aria-label={`${st} of 3 stars`} data-testid="stars">{[1, 2, 3].map((s) => <Star key={s} size={34} className={s <= st ? "is-on" : ""} aria-hidden="true" fill={s <= st ? "currentColor" : "none"} />)}</div>
            <p>{st === 3 ? "Perfect: you can reason from electronegativity to molecular polarity." : st >= 2 ? "Good work. Review the feedback on the ones you missed." : "Keep going: ΔEN decides bond polarity, geometry decides molecular polarity."}</p>
            <button type="button" className="pp-btn pp-btn--primary" onClick={again} data-testid="again">Play again</button>
          </div>
        )}
      </Card>
    </div>
  );
}
