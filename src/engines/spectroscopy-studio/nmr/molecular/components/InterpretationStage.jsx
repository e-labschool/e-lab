import { fmtMHz } from "./palette.js";
import { useEffect, useMemo, useState } from "react";
import MoleculePicker from "./MoleculePicker.jsx";
import MoleculeViewer from "./MoleculeViewer.jsx";
import SpectrumPlot from "./SpectrumPlot.jsx";
import { EnvChip } from "./EnvBits.jsx";
import { Explain, Feedback, Segmented, Toggle, useStepRequest } from "./shared.jsx";
import useStageState from "./useStageState.js";
import { layoutOf, useLinkedSelection, useMolecule } from "./useSelection.js";
import { selectAtom } from "../model/linking.js";
import { MOLECULES, getMolecule } from "../model/molecules.js";
import { buildSignals, spectrumRows, simplestRatio, viewForSignal, DEFAULT_FREQ_MHZ } from "../model/spectrum.js";
import { CANDIDATE_SETS, checkEnvCount, checkIdentify, checkRatio, checkSplitting, envCountQuestion, identifyQuestion, integralUnit, ratioQuestion, shuffled, splittingQuestion } from "../model/challenges.js";
import "./molecular.css";

// Stage 5 "Interpretation": the investigative challenges 3-6. Every question is generated from the molecule data model (so it works for
// every molecule), answers are checked with an explanation, and every challenge can be retried.
const TABS = [
  { value: "c3", label: "3 · Hydrogen environments", testId: "tab-c3" },
  { value: "c4", label: "4 · Integration", testId: "tab-c4" },
  { value: "c5", label: "5 · Splitting", testId: "tab-c5" },
  { value: "c6", label: "6 · Identify the molecule", testId: "tab-c6" },
];
const MULTS = ["singlet", "doublet", "triplet", "quartet", "quintet", "sextet", "septet"];
const blank = { choice: null, inputs: [], checked: false, tries: 0, right: 0, shown: false };

export default function InterpretationStage({ studio }) {
  const mol = useMolecule(studio);
  const token = studio?.resetToken ?? 0;
  const L = layoutOf(studio?.containerSize);
  const freq = studio?.operatingFrequencyMHz ?? DEFAULT_FREQ_MHZ;
  const teacher = studio?.mode === "teacher";
  const { selectedEnvId, select, clear } = useLinkedSelection(studio, mol);
  const [tab, setTab] = useStageState("int:tab", "c3", token);
  const [a3, setA3] = useStageState(`int:c3:${mol.id}`, blank, token);
  const [a4, setA4] = useStageState(`int:c4:${mol.id}`, blank, token);
  const [a5, setA5] = useStageState(`int:c5:${mol.id}:${selectedEnvId ?? "-"}`, blank, token);
  const [c6n, setC6n] = useStageState("int:c6:n", 0, token);
  const [a6, setA6] = useStageState(`int:c6:a:${c6n}`, { ...blank, shown: false }, token);
  const [scores, setScores] = useStageState("int:scores", { c3: [0, 0], c4: [0, 0], c5: [0, 0], c6: [0, 0] }, token);
  const [peakSel, setPeakSel] = useState(null);
  const [c6opts, setC6opts] = useState({ integration: true, splitting: true });
  const [showEv, setShowEv] = useState(false);
  const [inspectId, setInspectId] = useState(null);
  const [focusAtom, setFocusAtom] = useState(null);
  useEffect(() => { setPeakSel(null); setFocusAtom(null); setInspectId(null); }, [mol.id, c6n, tab, token]);

  const bump = (k, ok) => setScores((s) => ({ ...s, [k]: [s[k][0] + (ok ? 1 : 0), s[k][1] + 1] }));
  const deck = useMemo(() => shuffled(MOLECULES.map((m) => m.id), 11), []);
  const nextMolecule = () => { const i = deck.indexOf(mol.id); studio?.setMoleculeId?.(deck[(i + 1) % deck.length]); clear(); };

  // ---------- question objects ----------
  const q3 = useMemo(() => envCountQuestion(mol.id), [mol.id]);
  const q4 = useMemo(() => ratioQuestion(mol.id), [mol.id]);
  const q5 = useMemo(() => (selectedEnvId ? splittingQuestion(mol.id, selectedEnvId) : null), [mol.id, selectedEnvId]);
  const q6 = useMemo(() => identifyQuestion(c6n), [c6n]);
  const unknown = useMemo(() => getMolecule(q6.targetId), [q6]);

  const r3 = a3.checked ? checkEnvCount(q3, a3.choice) : null;
  const r4 = a4.checked ? checkRatio(q4, q4.rows.map((_, i) => a4.inputs[i] ?? "")) : null;
  const r5 = a5.checked && q5 ? checkSplitting(q5, a5.choice) : null;
  const r6 = a6.checked && a6.choice ? checkIdentify(q6, a6.choice) : null;

  useStepRequest(studio?.stepRequest, (dir) => {
    if (tab === "c6") setC6n((n) => Math.max(0, n + dir));
    else if (tab === "c3" || tab === "c4") { const i = deck.indexOf(mol.id); studio?.setMoleculeId?.(deck[(i + (dir > 0 ? 1 : deck.length - 1)) % deck.length]); }
    else if (tab === "c5") { const ids = mol.environments.map((e) => e.id); const cur = Math.max(0, ids.indexOf(selectedEnvId)); select(ids[(cur + (dir > 0 ? 1 : ids.length - 1)) % ids.length]); }
  });

  const ctxMol = useMemo(() => {
    const revealAll = (tab === "c3" && (a3.checked || (teacher && a3.shown))) || (tab === "c5");
    return { selectedEnvId: tab === "c5" ? selectedEnvId : tab === "c3" ? selectedEnvId : null, identified: new Set(revealAll ? mol.environments.map((e) => e.id) : []), coupledEnvIds: tab === "c5" && a5.checked && q5 ? buildSignals(mol, { envIds: [selectedEnvId] })[0]?.neighbours.map((n) => n.envId) ?? [] : [], style: "ball", focusAtom };
  }, [tab, a3.checked, a3.shown, teacher, mol, selectedEnvId, a5.checked, q5, focusAtom]);

  const onAtomClick = (idx) => { const s = selectAtom(mol, idx); setFocusAtom(idx); if (s.selectedEnvId) select(s.selectedEnvId); else clear(); };

  const signals = useMemo(() => buildSignals(mol, { freqMHz: freq, coupling: true }), [mol, freq]);
  const unknownSignals = useMemo(() => buildSignals(unknown, { freqMHz: freq, coupling: true }), [unknown, freq]);
  const unit = integralUnit(mol.id); const unitU = integralUnit(unknown.id);
  const wide = L.wide;
  const scoreText = (k) => (scores[k][1] ? `${scores[k][0]} correct of ${scores[k][1]} checked` : "");

  const picker = <MoleculePicker value={mol.id} onChange={(id) => { studio?.setMoleculeId?.(id); clear(); }} compact />;

  return (
    <section className={`nm-root nm-stage${wide ? " nm-wide" : ""}${L.short ? " nm-short" : ""}`} data-testid="interpretation-stage" data-tab={tab} data-molecule={mol.id} data-mode={studio?.mode ?? "student"} aria-label="Interpretation challenges">
      <header className="nm-bar">
        <Segmented label="Challenge" value={tab} onChange={setTab} testId="challenge-tabs" options={TABS} />
        {tab !== "c6" && picker}
        <span className="nm-note-s" data-testid="score-line">{scoreText(tab)}</span>
      </header>

      {tab === "c3" && (
        <div className="nm-int-layout" data-testid="challenge-3">
          <div className="nm-int-stim">
            <MoleculeViewer molecule={mol} ctx={ctxMol} onAtomClick={onAtomClick} onBackgroundClick={() => { setFocusAtom(null); clear(); }} reducedMotion={studio?.reducedMotion} />
          </div>
          <div className="nm-int-q nm-panel">
            <h3 className="nm-h">Challenge 3 — Hydrogen environments</h3>
            <p>Inspect <b>{mol.name}</b> ({mol.condensed}). Rotate it, click hydrogens, and decide how many <b>different</b> hydrogen environments it has. Every environment gives one signal.</p>
            <div className="nm-row" role="group" aria-label="Number of environments">
              {q3.options.map((n) => <button key={n} type="button" className="sim-btn nm-numbtn" aria-pressed={a3.choice === n} onClick={() => setA3({ ...a3, choice: n, checked: false })} data-testid={`c3-opt-${n}`}>{n}</button>)}
            </div>
            <div className="nm-row">
              <button type="button" className="sim-btn sim-btn--primary nm-textbtn" disabled={a3.choice === null} onClick={() => { setA3({ ...a3, checked: true, tries: a3.tries + 1 }); bump("c3", a3.choice === q3.answer); }} data-testid="c3-check">Check</button>
              <button type="button" className="sim-btn nm-textbtn" onClick={() => setA3({ ...blank, tries: a3.tries })} disabled={!a3.checked && a3.choice === null} data-testid="c3-retry">Try again</button>
              <button type="button" className="sim-btn nm-textbtn" onClick={nextMolecule} data-testid="c3-next">Next molecule</button>
              {teacher && <button type="button" className="sim-btn nm-textbtn" onClick={() => setA3({ ...a3, shown: true })} data-testid="c3-reveal">Reveal answer</button>}
            </div>
            <Feedback result={r3 ?? (teacher && a3.shown ? { correct: true, message: `Answer: ${q3.answer}.`, explanation: q3.explanation } : null)} testId="c3-feedback" />
            {(a3.checked || (teacher && a3.shown)) && <div className="nm-env-row" role="group" aria-label="Environments">{mol.environments.map((e) => <EnvChip key={e.id} env={e} selected={e.id === selectedEnvId} onClick={() => select(e.id)} testId={`c3-env-${e.id}`} />)}</div>}
          </div>
        </div>
      )}

      {tab === "c4" && (
        <div className="nm-int-layout" data-testid="challenge-4">
          <div className="nm-int-stim">
            <SpectrumPlot molecule={mol} signals={signals} freqMHz={freq} selectedEnvId={null} showIntegration showAssignments={false} integralLabel={(s) => `${(s.count * unit).toFixed(1)}`} onSelectEnv={() => {}} resetToken={token} reducedMotion={studio?.reducedMotion} testId="c4-spectrum" labelMult />
          </div>
          <div className="nm-int-q nm-panel">
            <h3 className="nm-h">Challenge 4 — Integration</h3>
            <p>The integration trace has one step per signal. Its values are in <b>arbitrary units</b> (not hydrogens). Work out the simplest whole-number ratio of hydrogens for the signals from <b>left (high δ) to right</b>.</p>
            <div className="nm-ratio-inputs">
              {q4.rows.map((r, i) => (
                <label key={r.envId} className="nm-ratio-input">Signal {i + 1}
                  <input type="text" inputMode="numeric" value={a4.inputs[i] ?? ""} onChange={(e) => { const inputs = [...a4.inputs]; inputs[i] = e.target.value; setA4({ ...a4, inputs, checked: false }); }} data-testid={`c4-in-${i}`} aria-label={`Hydrogens in signal ${i + 1}`} />
                </label>
              ))}
            </div>
            <div className="nm-row">
              <button type="button" className="sim-btn sim-btn--primary nm-textbtn" onClick={() => { const rr = checkRatio(q4, q4.rows.map((_, i) => a4.inputs[i] ?? "")); setA4({ ...a4, checked: true, tries: a4.tries + 1 }); if (!rr.invalid) bump("c4", rr.correct); }} data-testid="c4-check">Check</button>
              <button type="button" className="sim-btn nm-textbtn" onClick={() => setA4({ ...blank, tries: a4.tries })} data-testid="c4-retry">Try again</button>
              <button type="button" className="sim-btn nm-textbtn" onClick={nextMolecule} data-testid="c4-next">Next molecule</button>
            </div>
            <Feedback result={r4} testId="c4-feedback" />
            <p className="nm-note-s">Integrate each whole multiplet: a triplet or quartet is one environment, not three or four.</p>
          </div>
        </div>
      )}

      {tab === "c5" && (
        <div className="nm-int-layout" data-testid="challenge-5">
          <div className="nm-int-stim">
            <MoleculeViewer molecule={mol} ctx={ctxMol} onAtomClick={onAtomClick} onBackgroundClick={() => { setFocusAtom(null); clear(); }} reducedMotion={studio?.reducedMotion} />
            <div className="nm-env-row" role="group" aria-label="Choose an environment">
              {mol.environments.map((e) => <EnvChip key={e.id} env={e} selected={e.id === selectedEnvId} onClick={() => select(e.id)} testId={`c5-env-${e.id}`} />)}
            </div>
          </div>
          <div className="nm-int-q nm-panel">
            <h3 className="nm-h">Challenge 5 — Splitting</h3>
            {!q5 ? <p data-testid="c5-prompt">Select a hydrogen environment in the molecule (click a hydrogen or choose a chip), then predict its multiplicity.</p> : (
              <>
                <p>Predict the splitting pattern of the <b>{q5 && mol.environments.find((e) => e.id === selectedEnvId).label}</b> hydrogens ({mol.environments.find((e) => e.id === selectedEnvId).count} H) in <b>{mol.name}</b>. Think about the hydrogens on the <i>neighbouring</i> atoms.</p>
                <div className="nm-row" role="group" aria-label="Multiplicity">
                  {MULTS.map((m) => <button key={m} type="button" className="sim-btn nm-textbtn" aria-pressed={a5.choice === m} onClick={() => setA5({ ...a5, choice: m, checked: false })} data-testid={`c5-opt-${m}`}>{m}</button>)}
                </div>
                <div className="nm-row">
                  <button type="button" className="sim-btn sim-btn--primary nm-textbtn" disabled={!a5.choice} onClick={() => { setA5({ ...a5, checked: true, tries: a5.tries + 1 }); bump("c5", a5.choice === q5.answer); }} data-testid="c5-check">Check</button>
                  <button type="button" className="sim-btn nm-textbtn" onClick={() => setA5({ ...blank, tries: a5.tries })} data-testid="c5-retry">Try again</button>
                  {teacher && <button type="button" className="sim-btn nm-textbtn" onClick={() => setA5({ ...a5, shown: true })} data-testid="c5-reveal">Reveal answer</button>}
                </div>
                <Feedback result={r5 ?? (teacher && a5.shown ? { correct: true, message: `Answer: ${q5.answer}.`, explanation: q5.explanation } : null)} testId="c5-feedback" />
                {(a5.checked || (teacher && a5.shown)) && (() => {
                  const s = signals.find((x) => x.envId === selectedEnvId);
                  return <div className="nm-inset" style={{ height: 130 }} role="img" aria-label="Zoomed multiplet" data-testid="c5-inset"><SpectrumPlot molecule={mol} signals={[s]} freqMHz={freq} selectedEnvId={null} showSplitting hideToolbar hideLabels interactive={false} fixedView={viewForSignal(s)} testId="c5-inset-spectrum" reducedMotion /></div>;
                })()}
              </>
            )}
            <div className="nm-row">
              <button type="button" className="sim-btn nm-textbtn" onClick={() => { const ids = mol.environments.map((e) => e.id); const i = ids.indexOf(selectedEnvId); if (i + 1 < ids.length) select(ids[i + 1]); else { const j = deck.indexOf(mol.id); studio?.setMoleculeId?.(deck[(j + 1) % deck.length]); clear(); } }} data-testid="c5-next">{selectedEnvId ? "Next environment" : "Pick for me"}</button>
            </div>
          </div>
        </div>
      )}

      {tab === "c6" && (
        <div className="nm-int-layout" data-testid="challenge-6" data-unknown={teacher ? unknown.id : undefined}>
          <div className="nm-int-stim">
            <div className="nm-row" style={{ flex: "0 0 auto" }}>
              <Toggle label="Integration" pressed={c6opts.integration} onChange={(v) => setC6opts({ ...c6opts, integration: v })} testId="c6-integration" />
              <Toggle label="Splitting marks" pressed={c6opts.splitting} onChange={(v) => setC6opts({ ...c6opts, splitting: v })} testId="c6-splitting" />
              <span className="nm-note-s">Unknown compound — predicted/idealised spectrum at {fmtMHz(freq)} MHz.</span>
            </div>
            <SpectrumPlot molecule={unknown} signals={unknownSignals} freqMHz={freq} selectedEnvId={peakSel} showIntegration={c6opts.integration} showAssignments={false} showSplitting={c6opts.splitting} integralLabel={(s) => `${(s.count * unitU).toFixed(1)}`} onSelectEnv={(id) => setPeakSel((cur) => (cur === id ? null : id))} resetToken={`${token}-${c6n}`} reducedMotion={studio?.reducedMotion} testId="c6-spectrum" hideLabels={false} labelMult />
          </div>
          <div className="nm-int-q nm-panel">
            <h3 className="nm-h">Challenge 6 — Identify the molecule</h3>
            <p>Use the number of signals, their chemical shifts, the integration (relative areas) and the splitting to decide which candidate gave this spectrum.</p>
            {!teacher && <button type="button" className="sim-btn nm-textbtn" aria-pressed={showEv} onClick={() => setShowEv((v) => !v)} data-testid="c6-evidence-toggle">{showEv ? "Hide readings table" : "Hint: show readings table"}</button>}
            {(teacher || showEv) && (
            <table className="nm-evidence" data-testid="evidence-table">
              <thead><tr><th scope="col">Signal</th><th scope="col">δ / ppm</th><th scope="col">Relative area</th><th scope="col">Splitting</th></tr></thead>
              <tbody>
                {(() => { const rows = spectrumRows(unknown); const ratio = simplestRatio(rows.map((r) => r.count)); return rows.map((r, i) => (
                  <tr key={r.envId} className={peakSel === r.envId ? "is-sel" : ""}><td>{i + 1}</td><td>{r.delta.toFixed(1)}</td><td>{ratio[i]}</td><td>{r.mult.startsWith("multiplet") ? "multiplet" : r.mult}</td></tr>
                )); })()}
              </tbody>
            </table>
            )}
            <div className="nm-cands" role="radiogroup" aria-label="Candidate molecules">
              {q6.candidates.map((id) => { const c = getMolecule(id); return (
                <button key={id} type="button" role="radio" aria-checked={a6.choice === id} className="sim-btn nm-cand" aria-pressed={a6.choice === id} onClick={() => { setA6({ ...a6, choice: id, checked: false }); setInspectId(id); }} data-testid={`cand-${id}`}>
                  <b>{c.name}</b><span>{c.condensed}</span>
                </button>
              ); })}
            </div>
            {inspectId && (() => { const c = getMolecule(inspectId); const rows = spectrumRows(c); const ratio = simplestRatio(rows.map((r) => r.count)); return (
              <div className="nm-detail" data-testid="candidate-prediction">
                <p className="nm-note-s">If it were <b>{c.name}</b> the spectrum would show {rows.length} signal{rows.length > 1 ? "s" : ""}: area ratio {ratio.join(" : ")}, splitting {rows.map((r) => r.abbr).join(", ")} (left to right).</p>
                <pre className="nm-structural" style={{ position: "static", maxWidth: "100%" }} aria-label={`Structural formula of ${c.name}`}>{c.structural}</pre>
              </div>
            ); })()}
            <div className="nm-row">
              <button type="button" className="sim-btn sim-btn--primary nm-textbtn" disabled={!a6.choice} onClick={() => { setA6({ ...a6, checked: true, tries: a6.tries + 1 }); bump("c6", a6.choice === q6.targetId); }} data-testid="c6-check">Check answer</button>
              <button type="button" className="sim-btn nm-textbtn" onClick={() => setA6({ ...blank })} data-testid="c6-retry">Try again</button>
              <button type="button" className="sim-btn nm-textbtn" onClick={() => setC6n((n) => n + 1)} data-testid="c6-next">New unknown</button>
              {teacher && <button type="button" className="sim-btn nm-textbtn" onClick={() => setA6({ ...a6, choice: q6.targetId, checked: true })} data-testid="c6-reveal">Reveal answer</button>}
            </div>
            <Feedback result={r6} testId="c6-feedback" />
            <Explain testId="c6-hint">{CANDIDATE_SETS.length ? "Tip: the number of signals and the ratio of areas narrow it down first; then use the splitting (n + 1) to decide between what is left." : ""}</Explain>
          </div>
        </div>
      )}
    </section>
  );
}
