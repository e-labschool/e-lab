import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Star, XCircle } from "lucide-react";
import { Card } from "./parts.jsx";
import { BondArrowOption, MoleculeSketch, PairSketch } from "./Sketch.jsx";
import { WORDS } from "./wording.js";
import { buildRound, check, stars } from "../model/challenge.js";
import { elementBond } from "../../shared-3d/electronCloud/electronegativity.js";

const LETTERS = ["A", "B", "C", "D"];
const HINT = { en: "Think: which atom attracts the shared electrons more strongly?", partial: "The less electronegative atom is δ+.", arrow: "Crossed tail on δ+, arrowhead towards δ−.", polar: "Bond polarity first, then the shape: do the bond dipoles cancel?", cancel: "Imagine the bond dipoles as arrows added head to tail.",
  match: "Name the shape, then decide if the bond dipoles cancel.", rank: "Bigger ΔEN = more polar bond.", pick: "Look at the shape and the bond dipoles of each one.", direction: "The net dipole points towards the δ− (more electronegative) side." };

function Visual({ q, answered }) {
  const v = q.visual;
  if (v.kind === "molecule") return <div className="pp-visual-big"><MoleculeSketch id={v.id} reveal={answered} delta={!!v.delta} /></div>;
  if (v.kind === "set") return <div className="pp-visual-set" data-testid="set-visual">{v.ids.map((id, k) => <figure key={id}><MoleculeSketch id={id} reveal={answered} /><figcaption>{LETTERS[k]}</figcaption></figure>)}</div>;
  if (v.kind === "bonds") return <div className="pp-bondchips" data-testid="bond-chips">{v.bonds.map(([a, b]) => <span key={`${a}${b}`} className="pp-bondchip">{a}–{b}{answered ? <small>ΔEN {elementBond(a, b).dEN.toFixed(2)}</small> : null}</span>)}</div>;
  return <div className="pp-visual-big"><PairSketch a={v.a} b={v.b} reveal={answered} />{answered && !elementBond(v.a, v.b).equal && <p className="pp-hint" data-testid="pair-hint">{elementBond(v.a, v.b).less} δ+ → {elementBond(v.a, v.b).more} δ− (ΔEN {elementBond(v.a, v.b).dEN.toFixed(2)})</p>}</div>;
}

export default function ChallengeTab({ simple = false }) {
  const W = WORDS(simple); void W;
  const [seed, setSeed] = useState(1); const round = useMemo(() => buildRound(seed), [seed]);
  const [retryQs, setRetryQs] = useState(null); // null = the main round; otherwise the missed questions being retried
  const qs = retryQs ?? round; const total = qs.length;
  const [i, setI] = useState(0); const [picks, setPicks] = useState([]); const [done, setDone] = useState(false);
  const q = qs[i]; const pick = picks[i]; const answered = pick !== undefined; const res = answered ? check(q, pick) : null;
  const score = picks.filter((p, k) => p === qs[k]?.right).length; const missed = qs.filter((x, k) => picks[k] !== x.right);
  const choose = (id) => { if (!answered) setPicks((a) => { const n = [...a]; n[i] = id; return n; }); };
  const next = () => { document.activeElement?.blur?.(); if (i + 1 >= total) setDone(true); else setI(i + 1); };
  const again = () => { setSeed((s) => s + 1); setRetryQs(null); setI(0); setPicks([]); setDone(false); };
  const retry = () => { setRetryQs(missed); setI(0); setPicks([]); setDone(false); };
  const st = stars(score, total);
  return (
    <div className="pp-tabpanel pp-tabpanel--challenge" data-testid="tab-challenge" role="tabpanel" aria-labelledby="pp-tab-challenge">
      <Card className="pp-card--wide" title={<><span className="pp-n">4</span>Polarity Challenge{retryQs ? " · retry" : ""}</>}
        aside={<div className="pp-dots" role="img" aria-label={`Question ${Math.min(i + 1, total)} of ${total}`} data-testid="progress"><span>Question {Math.min(i + 1, total)} of {total}</span>{qs.map((r, k) => <i key={`${r.id}${k}`} className={"pp-dot" + (picks[k] !== undefined ? (picks[k] === r.right ? " is-ok" : " is-no") : k === i ? " is-now" : "")} />)}</div>}>
        {!done ? (
          <div className="pp-q" data-testid="question" data-type={q.type}>
            <div className="pp-q-main">
              <p className="pp-q-prompt" data-testid="prompt">{q.prompt}</p>
              <Visual q={q} answered={answered} />
              {!answered && <p className="pp-q-hint" data-testid="q-hint">{HINT[q.type]}</p>}
            </div>
            <div className="pp-q-side">
              <div className="pp-options" role="group" aria-label="Answers">
                {q.options.map((o, k) => {
                  const state = !answered ? "" : o.id === q.right ? " is-right" : o.id === pick ? " is-wrong" : " is-dim";
                  return (
                    <button key={o.id} type="button" aria-pressed={answered ? pick === o.id : undefined} disabled={answered} className={"pp-option" + state} onClick={() => choose(o.id)} data-testid={`option-${o.id}`} data-correct={answered && o.id === q.right ? "1" : undefined}>
                      <span className="pp-letter" aria-hidden="true">{LETTERS[k]}</span>
                      <span className="pp-option-body">{q.type === "arrow" ? <BondArrowOption a={q.visual.a} b={q.visual.b} tail={o.arrow.tail} /> : o.label}</span>
                      {answered && o.id === q.right && <CheckCircle2 size={22} className="pp-ico-ok" aria-label="correct answer" />}
                      {answered && o.id === pick && o.id !== q.right && <XCircle size={22} className="pp-ico-no" aria-label="your answer, not correct" />}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <div className={"pp-feedback pp-feedback--big " + (res.correct ? "is-ok" : "is-no")} role="status" data-testid="feedback">
                  <b>{res.correct ? "Correct!" : "Not quite."}</b> {res.explain}
                  <div className="pp-btnrow"><button type="button" className="pp-btn pp-btn--primary" onClick={next} data-testid="next">{i + 1 >= total ? "See my result" : "Next question"}</button></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="pp-done" data-testid="done">
            <p className="pp-bigscore" data-testid="score">{score} / {total}</p>
            <div className="pp-stars" role="img" aria-label={`${st} of 3 stars`} data-testid="stars">{[1, 2, 3].map((s) => <Star key={s} size={40} className={s <= st ? "is-on" : ""} aria-hidden="true" fill={s <= st ? "currentColor" : "none"} />)}</div>
            <p className="pp-done-msg">{st === 3 ? "Perfect: you can reason from electronegativity to molecular polarity." : st >= 2 ? "Good work. Review the ones you missed." : "Keep going: ΔEN decides bond polarity, geometry decides molecular polarity."}</p>
            <ul className="pp-review" data-testid="review">{qs.map((x, k) => (<li key={`${x.id}${k}`} className={picks[k] === x.right ? "is-ok" : "is-no"}>{picks[k] === x.right ? <CheckCircle2 size={18} aria-label="correct" /> : <XCircle size={18} aria-label="not correct" />}<span>{x.prompt}</span></li>))}</ul>
            <div className="pp-btnrow">
              {missed.length > 0 && <button type="button" className="pp-btn" onClick={retry} data-testid="retry"><RotateCcw size={15} aria-hidden="true" /> Retry the {missed.length} I missed</button>}
              <button type="button" className="pp-btn pp-btn--primary" onClick={again} data-testid="again">Play again (new questions)</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
