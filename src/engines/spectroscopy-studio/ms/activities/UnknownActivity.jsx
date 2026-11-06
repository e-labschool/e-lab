import { useMemo } from "react";
import { Check, ChevronRight, RotateCcw, Send } from "lucide-react";
import ActivityFrame from "../components/ActivityFrame.jsx";
import { ChipGroup, Scene } from "../components/ui.jsx";
import MsSpectrum from "../components/MsSpectrum.jsx";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { ROUNDS, ISO_OPTIONS, TASKS, CANDIDATES, answered, candidateOrder, evaluateAnswers, peakHint } from "../physics/challenge.js";
import { SPECTRA, SPECTRA_NOTE } from "../data/spectra.js";

const MARK = { correct: "Correct", partial: "Partly right", wrong: "Not correct" };
const ISO_LABEL = Object.fromEntries(ISO_OPTIONS.map((o) => [o.id, o.label]));
/** Unknown-compound challenge (was stage 12): identify an unknown from its representative spectrum. No answer is shown until the student submits. */
export default function UnknownActivity() {
  const a = useMsActions(); const s12 = useMs((s) => s.s12); const roundId = ROUNDS[s12.round]; const spec = SPECTRA[roundId];
  const { task, sel, picks, submitted } = s12;
  const order = useMemo(() => candidateOrder(roundId, s12.seed), [roundId, s12.seed]);
  const cands = order.map((id) => CANDIDATES[roundId].find((c) => c.id === id));
  const hint = sel !== null ? peakHint(spec, sel) : null;
  const result = submitted ? evaluateAnswers(roundId, picks) : null;
  const pickedMz = [picks.t1, picks.t2, ...picks.t3].filter((x) => x !== null);
  const ready = answered(picks);
  const nameOf = (id) => CANDIDATES[roundId].find((c) => c.id === id);
  const viz = (
    <div className="ms-boxfill" data-testid="unknown-view" data-round={s12.round + 1} data-submitted={submitted ? "1" : "0"}>
      <Scene>{({ w, h }) => <MsSpectrum width={w} height={h} peaks={spec.peaks} colorBy={submitted ? "role" : "plain"} marks={submitted} baseMz={submitted ? spec.baseMz : null} mMz={submitted ? spec.mMz : null} labels="mz" selected={sel} onSelect={submitted ? null : (mz) => a.pickPeak(mz)} picked={submitted ? [] : pickedMz} ariaLabel={`Unknown spectrum number ${s12.round + 1}, representative`} testId="unknown-spectrum" />}</Scene>
      <p className="ss-badge ss-badge--tl" data-testid="unknown-title">Unknown {s12.round + 1} of {ROUNDS.length} · representative spectrum</p>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <span className="ss-stripnote">Task</span>
      <ChipGroup label="Task" options={TASKS.map((t) => ({ id: String(t.n), label: `${t.n}. ${t.label}` }))} value={String(task)} onChange={(id) => a.setTask(Number(id))} testId="task" small />
    </div>
  );
  const cur = TASKS[task - 1];
  return (
    <ActivityFrame id="unknown" title="Identify unknown compounds" viz={viz} strip={strip} teacher={(
      <>
        <p>{SPECTRA_NOTE} The six unknowns are simple: real identification also uses the exact mass, the full fragmentation and other techniques (see the separate Structure Investigation tab).</p>
        <p>The wrong choices share the same nominal molecular-ion mass wherever possible (for example three compounds with M = 46 or 58), so M alone never decides. The hint for a peak describes it (height, gaps to other peaks, isotope pairs) but never names the answer.</p>
      </>
    )}>
      {!submitted ? (
        <>
          <p className="ms-prompt" data-testid="task-prompt"><b>{task}. {cur.label}.</b> {cur.prompt}</p>
          <div className="ms-hint" data-testid="hint" aria-live="polite">
            {hint ? (<><b>Hint for m/z {hint.mz}</b><ul>{hint.lines.map((l) => <li key={l}>{l}</li>)}</ul></>) : <span className="ss-note">{cur.kind === "choice" ? "Click any peak in the spectrum for a hint." : "Click a peak in the spectrum for a hint."}</span>}
          </div>
          {cur.kind !== "choice" && (
            <div className="ss-controlrow">
              <button type="button" className="sim-btn ss-chipbtn" onClick={a.usePeak} disabled={sel === null} data-testid="use-peak"><Check size={15} aria-hidden="true" /> {task === 3 ? "Add / remove this peak" : "Use this peak"}</button>
              <span className="ss-note" data-testid="picked-line">{task === 1 && (picks.t1 !== null ? `Your molecular ion: m/z ${picks.t1}` : "Not chosen yet")}{task === 2 && (picks.t2 !== null ? `Your base peak: m/z ${picks.t2}` : "Not chosen yet")}{task === 3 && (picks.t3.length ? `Your fragments: ${[...picks.t3].sort((x, y) => x - y).join(", ")}` : "None chosen yet")}</span>
            </div>
          )}
          {task === 4 && <ChipGroup label="Isotope pattern" options={ISO_OPTIONS.map((o) => ({ id: o.id, label: o.label, sub: o.sub }))} value={picks.t4} onChange={(id) => a.choose("t4", id)} testId="iso" />}
          {task === 5 && <ChipGroup label="Compound" options={cands.map((c) => ({ id: c.id, label: c.name, sub: c.formula }))} value={picks.t5} onChange={(id) => a.choose("t5", id)} testId="cand" />}
          <div className="ss-controlrow">
            <button type="button" className="sim-btn sim-btn--primary ss-cta" disabled={!ready} onClick={a.submit} data-testid="submit"><Send size={16} aria-hidden="true" /> Submit answers</button>
            <span className="ss-note" data-testid="progress-line">{[picks.t1 !== null, picks.t2 !== null, picks.t3.length > 0, picks.t4 !== null, picks.t5 !== null].filter(Boolean).length} of 5 tasks answered</span>
          </div>
        </>
      ) : (
        <div className="ms-reveal" data-testid="reveal">
          <p className={`ms-outcome is-${result.all ? "ok" : "no"}`} data-testid="reveal-score"><b>{result.all ? "All five correct." : `${Object.entries(result).filter(([k, v]) => k !== "all" && v === "correct").length} of 5 correct.`}</b> The unknown was <b data-testid="reveal-name">{nameOf(roundId).name}</b> ({nameOf(roundId).formula}).</p>
          <ul className="ms-results" data-testid="results">
            {TASKS.map((t) => (<li key={t.n} className={`is-${result[`t${t.n}`]}`} data-testid={`result-${t.n}`}><b>{t.n}. {t.label}</b>: {MARK[result[`t${t.n}`]]}</li>))}
          </ul>
          <p data-testid="explanation">{spec.explain}</p>
          {picks.t5 && picks.t5 !== roundId && <p className="ss-note" data-testid="why-not"><b>Why not {nameOf(picks.t5).name}?</b> {nameOf(picks.t5).why}</p>}
          {picks.t4 && picks.t4 !== spec.isotopePattern && <p className="ss-note">The isotope pattern here is: {ISO_LABEL[spec.isotopePattern]}.</p>}
          <div className="ss-controlrow">
            <button type="button" className="sim-btn sim-btn--primary ss-cta" onClick={a.nextRound} data-testid="next-unknown"><ChevronRight size={16} aria-hidden="true" /> Next unknown</button>
            <button type="button" className="sim-btn ss-chipbtn" onClick={a.restartRound} data-testid="try-again"><RotateCcw size={15} aria-hidden="true" /> Try this one again</button>
          </div>
        </div>
      )}
    </ActivityFrame>
  );
}
