// Challenge mode: recover every component of an unknown mixture by choosing a SEQUENCE of methods. Each step is executed by the
// same run models as Explore (headless), so the result always agrees with the simulation. Scored on correctness, efficiency
// (extra or wasted steps cost points) and hints used.
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Lightbulb, RotateCcw, XCircle } from "lucide-react";
import { DashPanel } from "../../../components/simulation/SimulationDashboard.jsx";
import { SUBSTANCES } from "../model/chem.js";
import { CHALLENGES, CHALLENGE_BY_ID, applyStep, isSolved, scoreChallenge, startChallenge, targetStatus } from "../model/challenge.js";
import { METHODS, getMethod } from "../model/methods.js";
import { describeSample, fmtG, totalMass } from "../model/mixtures.js";
import { liquidColour, solidColour } from "./look.js";
import { Rich } from "./Rich.jsx";
import { VERDICT } from "./Results.jsx";

const STEP_METHODS = METHODS.filter((m) => m.id !== "chromatography");

function Vessel({ c, selected, onSelect, targetSubs }) {
  const total = totalMass(c.sample) || 1;
  const liquidG = c.sample.parts.filter((p) => p.form !== "solid").reduce((a, p) => a + p.g, 0);
  const solidG = total - liquidG;
  const lq = liquidColour(c.sample); const sc = solidColour(c.sample);
  const liquidH = Math.min(1, liquidG / 140) * 58; const heap = Math.min(1, solidG / 40) * 22;
  const pure = targetSubs.length ? targetSubs : [];
  return (
    <button type="button" role="radio" aria-checked={selected} className="ms-vessel" data-selected={selected ? "yes" : "no"} onClick={() => onSelect(c.id)} data-testid={`vessel-${c.id}`}
      aria-label={`${c.label}: ${describeSample(c.sample)}`}>
      <svg viewBox="0 0 80 84" aria-hidden="true" className="ms-vessel-svg">
        <path d="M12,6 L16,74 Q16,80 22,80 L58,80 Q64,80 64,74 L68,6" fill="#f4f8ff" fillOpacity="0.55" stroke="#4b5a7c" strokeWidth="2.2" strokeLinejoin="round" />
        {liquidH > 0.5 && <path d={`M16.5,${80 - liquidH} L63.5,${80 - liquidH} L64,74 Q64,80 58,80 L22,80 Q16,80 16,74 Z`} fill={lq.colour} opacity={lq.opacity} />}
        {heap > 0.5 && sc && <path d={`M20,79 Q40,${79 - heap * 1.6} 60,79 Z`} fill={sc} stroke="#00000033" />}
      </svg>
      <span className="ms-vessel-name">{c.label}</span>
      <span className="ms-vessel-mass">{fmtG(total)}</span>
      <ul className="ms-vessel-list">
        {c.sample.parts.map((p, i) => <li key={i}><span className="ms-dot" style={{ background: SUBSTANCES[p.sub].colour, opacity: p.form === "dissolved" ? 0.55 : 1 }} aria-hidden="true" />{SUBSTANCES[p.sub].name.split(" (")[0]} <em>({p.form})</em> {fmtG(p.g)}</li>)}
      </ul>
      {pure.length > 0 && <span className="ms-vessel-flag"><CheckCircle2 size={13} aria-hidden="true" /> target met</span>}
    </button>
  );
}

export default function useChallengeTab() {
  const [chId, setChId] = useState(CHALLENGES[0].id);
  const ch = CHALLENGE_BY_ID[chId];
  const [state, setState] = useState(() => startChallenge(CHALLENGES[0]));
  const [selected, setSelected] = useState(() => state.containers[0].id);
  const [methodId, setMethodId] = useState("filtration");
  const [hints, setHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [last, setLast] = useState(null);

  const load = (id) => { const c = CHALLENGE_BY_ID[id]; const s = startChallenge(c); setChId(id); setState(s); setSelected(s.containers[0].id); setHints(0); setShowSolution(false); setLast(null); };
  const reset = () => load(CHALLENGES[0].id);

  const status = useMemo(() => targetStatus(ch, state), [ch, state]);
  const solved = isSolved(ch, state);
  const score = useMemo(() => scoreChallenge(ch, state, hints), [ch, state, hints]);
  const containerIds = state.containers.map((c) => c.id);
  const sel = containerIds.includes(selected) ? selected : containerIds[0];
  const targetOf = (cid) => status.filter((t) => t.container === cid);

  const apply = () => {
    if (!sel || solved) return;
    const out = applyStep(ch, state, sel, methodId);
    if (!out.step) return;
    setState(out.state); setLast(out.step);
    const ids = out.state.containers.map((c) => c.id);
    const fresh = ids.filter((id) => !containerIds.includes(id));
    setSelected(fresh[0] ?? ids[0] ?? null);
  };
  const lostTotal = Object.values(state.lostTotals).reduce((a, b) => a + b, 0);

  const controls = (
    <div className="ms-left" data-testid="ms-left">
      <DashPanel title="Challenge" fixed className="ms-panel" testId="ch-pick">
        <label className="ms-label" htmlFor="ch-select">Mixture to separate</label>
        <select id="ch-select" className="ms-select" value={chId} onChange={(e) => load(e.target.value)} data-testid="ch-select">
          {CHALLENGES.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.level})</option>)}
        </select>
        <p className="ms-mixinfo" data-testid="ch-story"><Rich text={ch.story} /></p>
        <ul className="ms-targets" aria-label="Targets" data-testid="ch-targets">
          {status.map((t) => (
            <li key={`${t.sub}-${t.form}`} data-done={t.done ? "yes" : "no"}>
              {t.done ? <CheckCircle2 size={15} aria-label="done" role="img" /> : <Circle size={15} aria-label="not yet" role="img" />}
              <span>{SUBSTANCES[t.sub].name.split(" (")[0]} {t.form === "liquid" ? "as a pure liquid" : "as a pure solid"}{t.done ? ` (${Math.round(t.purity * 100)} %)` : ""}</span>
            </li>
          ))}
        </ul>
      </DashPanel>
      <DashPanel title="Next step" fixed className="ms-panel" testId="ch-step">
        <p className="ms-hint">1. Pick a container in the picture. 2. Pick a method. 3. Apply.</p>
        <label className="ms-label" htmlFor="ch-method">Method to apply</label>
        <select id="ch-method" className="ms-select" value={methodId} onChange={(e) => setMethodId(e.target.value)} data-testid="ch-method" disabled={solved}>
          {STEP_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <div className="ms-row">
          <button type="button" className="sd-btn sd-btn--primary" onClick={apply} disabled={solved || !sel} data-testid="ch-apply">Apply to selected</button>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => setHints((h) => Math.min(ch.hints.length, h + 1))} disabled={hints >= ch.hints.length || solved} data-testid="ch-hint"><Lightbulb size={13} aria-hidden="true" /> Hint ({hints}/{ch.hints.length})</button>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => load(chId)} data-testid="ch-restart"><RotateCcw size={13} aria-hidden="true" /> Restart</button>
        </div>
        {hints > 0 && <ol className="ms-hints" data-testid="ch-hints">{ch.hints.slice(0, hints).map((h, i) => <li key={i}>{h}</li>)}</ol>}
        <p className="ms-hint">Each hint costs 5 points (at most 3 count). Extra or wasted steps cost points too.</p>
      </DashPanel>
    </div>
  );

  const chamber = (
    <div className="ms-chamber ms-chamber--bench" data-testid="ms-chamber" data-stage={solved ? "done" : "run"}>
      <div className="ms-bench" role="radiogroup" aria-label="Containers on the bench">
        {state.containers.map((c) => <Vessel key={c.id} c={c} selected={c.id === sel} onSelect={setSelected} targetSubs={targetOf(c.id)} />)}
      </div>
      <p className="ms-bench-note">{state.lostTotals && lostTotal > 0.05 ? `Lost to the air or the bench so far: ${fmtG(lostTotal)}.` : "Every gram is accounted for."}</p>
    </div>
  );

  const graph = (
    <div className="ms-right" data-testid="ms-right">
      {(solved || showSolution) && (
        <section className="ms-card ms-results" aria-label="Score" data-testid="ch-score" data-solved={solved ? "yes" : "no"}>
          <div className={`ms-verdict ms-verdict--${solved ? "ok" : "info"}`}>{solved ? <CheckCircle2 size={16} aria-hidden="true" /> : <Lightbulb size={16} aria-hidden="true" />}<span>{solved ? "Solved" : "Model solution"}</span></div>
          {solved && (
            <>
              <h3 className="ms-h3" data-testid="ch-total">Score: {score.total} / 100</h3>
              <ul className="ms-lines">
                <li>Correctness: {score.correctness} / 60 ({score.done} of {score.of} components)</li>
                <li>Efficiency: {score.efficiency} / 25 ({score.steps} step{score.steps === 1 ? "" : "s"}; the shortest plan has {score.optimal})</li>
                <li>No wasted steps: {score.tidy} / 15 ({score.wasted} wasted, {score.hazards} unsafe or reacting)</li>
                <li>Hints: -{score.hintCost}</li>
              </ul>
            </>
          )}
          <p className="ms-idea"><b>Shortest plan:</b> {ch.solution.map((id) => getMethod(id).label).join(" then ")}.</p>
          {ch.why && <p className="ms-idea"><Rich text={ch.why} /></p>}
        </section>
      )}
      <section className="ms-card" aria-label="Steps taken" data-testid="ch-log">
        <h3 className="ms-h3">Steps taken ({state.log.length})</h3>
        {state.log.length === 0 && <p className="ms-caption">Nothing yet. Choose a container and a method, then Apply.</p>}
        <ol className="ms-log">
          {state.log.map((s, i) => {
            const v = VERDICT[s.verdict] ?? VERDICT.fails; const Icon = s.hazard ? AlertTriangle : s.wasted ? XCircle : v.Icon;
            return (
              <li key={i} data-wasted={s.wasted ? "yes" : "no"}>
                <div className="ms-log-head"><Icon size={14} aria-hidden="true" /><b>{i + 1}. {getMethod(s.method).label}</b> on {s.containerLabel.toLowerCase()}</div>
                <p className="ms-caption">{s.headline}{s.wasted && !s.hazard ? " (this step changed nothing useful)" : ""}</p>
                {i === state.log.length - 1 && <ul className="ms-lines">{s.lines.slice(0, 3).map((l, k) => <li key={k}><Rich text={l[0].toUpperCase() + l.slice(1)} /></li>)}</ul>}
              </li>
            );
          })}
        </ol>
        {!solved && state.log.length > 0 && <button type="button" className="sd-btn sd-btn--sm" onClick={() => setShowSolution((v) => !v)} aria-expanded={showSolution} data-testid="ch-solution">{showSolution ? "Hide solution" : "Show the model solution"}</button>}
      </section>
    </div>
  );

  const explain = last ? `${getMethod(last.method).label}: ${last.headline}` : ch.story;
  const live = { items: [
    { id: "steps", label: "Steps", value: `${state.log.length}`, bg: "#eef2ff", testId: "live-steps" },
    { id: "targets", label: "Targets", value: `${status.filter((t) => t.done).length} / ${status.length}`, bg: "#dcfce7", testId: "live-targets" },
    { id: "hints", label: "Hints", value: `${hints}`, bg: "#fef9c3", testId: "live-hints" },
    { id: "score", label: "Score", value: solved ? `${score.total}` : "-", bg: "#e0f2fe", testId: "live-score" },
  ] };
  return { controls, chamber, graph, explain, live, predict: null, reset, state: { chId, solved, log: state.log, hints } };
}
