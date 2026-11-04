import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Tag } from "lucide-react";
import MoleculePicker from "./MoleculePicker.jsx";
import MoleculeViewer from "./MoleculeViewer.jsx";
import ShieldingExplorer from "./ShieldingExplorer.jsx";
import { EnvChip, EnvMark } from "./EnvBits.jsx";
import { DensityLegend, Explain, Feedback, Segmented, Toggle, useStepRequest } from "./shared.jsx";
import useStageState from "./useStageState.js";
import { layoutOf, useIdentified, useLinkedSelection, useMolecule } from "./useSelection.js";
import { selectAtom } from "../model/linking.js";
import { equivalenceReason } from "../model/topology.js";
import { checkEnvCount, envCountQuestion } from "../model/challenges.js";
import { shieldingVerdict } from "../model/shielding.js";
import "./molecular.css";

// Stage 3 "Molecular Process": pick a molecule, rotate it in 3D, select hydrogens, see all equivalent hydrogens light up together,
// then explore why each environment resonates where it does (shielding). Selection is shared with the spectrum stage.

export default function MolecularProcessStage({ studio }) {
  const mol = useMolecule(studio);
  const token = studio?.resetToken ?? 0;
  const L = layoutOf(studio?.containerSize);
  const { selectedEnvId, select, clear } = useLinkedSelection(studio, mol);
  const idn = useIdentified(mol, studio);
  const [view, setView] = useStageState("mp:view", { bonds: true, labels: true, style: "ball" }, token);
  const [tab, setTab] = useStageState("mp:tab", "env", token);
  const [formulaMode, setFormulaMode] = useStageState("mp:formula", "condensed", token);
  const [compareEnvId, setCompareEnvId] = useStageState(`mp:cmp:${mol.id}`, null, token);
  const [predict, setPredict] = useStageState(`mp:predict:${mol.id}`, { choice: null, checked: false }, token);
  const [focusAtom, setFocusAtom] = useState(null);
  const teacher = studio?.mode === "teacher";
  const env = mol.environments.find((e) => e.id === selectedEnvId) ?? null;

  useEffect(() => { setFocusAtom(null); }, [mol.id, token]);
  useEffect(() => { if (!selectedEnvId) setFocusAtom(null); }, [selectedEnvId]);

  const ctx = useMemo(() => ({ selectedEnvId, identified: idn.identified, coupledEnvIds: [], style: view.style, focusAtom }), [selectedEnvId, idn.identified, view.style, focusAtom]);

  const onAtomClick = (idx) => {
    const s = selectAtom(mol, idx);
    setFocusAtom(idx);
    if (s.selectedEnvId) { select(s.selectedEnvId); idn.identify(s.selectedEnvId); } else clear();
  };
  const onBackground = () => { setFocusAtom(null); clear(); };

  // step forward / back: walk through the environments from left (high δ) to right
  useStepRequest(studio?.stepRequest, (dir) => {
    const ids = mol.environments.map((e) => e.id); const cur = selectedEnvId ? ids.indexOf(selectedEnvId) : -1;
    const next = Math.min(ids.length - 1, Math.max(0, cur + dir)); const id = ids[next];
    select(id); idn.identify(id); setFocusAtom(null);
  });

  const nIdentified = idn.ids.length;
  const total = mol.environments.length;
  const q = useMemo(() => envCountQuestion(mol.id), [mol.id]);
  const result = predict.checked ? checkEnvCount(q, predict.choice) : null;
  const cmpEnv = compareEnvId ? mol.environments.find((e) => e.id === compareEnvId) : null;

  const explain = env
    ? `Environment ${env.letter}: ${env.label}, ${env.count} equivalent hydrogen${env.count > 1 ? "s" : ""}. ${equivalenceReason(mol, env.id)}`
    : nIdentified === 0 ? "Click any hydrogen atom. Every hydrogen in the same chemical environment will light up in the same colour." : `${nIdentified} of ${total} environment${total > 1 ? "s" : ""} identified. Click another hydrogen, or press Predict to check how many there are.`;

  const wide = L.wide;
  return (
    <section className={`nm-root nm-stage${wide ? " nm-wide" : ""}${L.short ? " nm-short" : ""}`} data-testid="molecular-process-stage" data-molecule={mol.id} data-mode={studio?.mode ?? "student"} style={{ width: L.w ? "100%" : undefined, height: "100%" }}
      aria-label="Molecular process: hydrogen environments">
      <header className="nm-bar">
        <MoleculePicker value={mol.id} onChange={(id) => { studio?.setMoleculeId?.(id); }} />
        <div className="nm-formulas" data-testid="formulas">
          <span className="nm-fname">{mol.name}</span>
          <span className="nm-fchip" title="Molecular formula">{mol.formula}</span>
          <span className="nm-fchip nm-fchip--cond" title="Condensed formula" data-testid="condensed-formula">{mol.condensed}</span>
        </div>
        <Segmented label="Formula shown" value={formulaMode} onChange={setFormulaMode} testId="formula-mode" small options={[{ value: "condensed", label: "Condensed", testId: "formula-condensed" }, { value: "structural", label: "Structural", testId: "formula-structural" }]} />
      </header>
      <div className="nm-main">
        <div className="nm-viewer-col">
          <MoleculeViewer molecule={mol} ctx={ctx} showBonds={view.bonds} showLabels={view.labels} onAtomClick={onAtomClick} onBackgroundClick={onBackground} reducedMotion={studio?.reducedMotion}>
            <div className="nm-viewopts" role="group" aria-label="Display options">
              <Toggle label="Bonds" pressed={view.bonds} onChange={(v) => setView({ ...view, bonds: v })} testId="opt-bonds" icon={view.bonds ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />} title="Show or hide the bonds" />
              <Toggle label="Labels" pressed={view.labels} onChange={(v) => setView({ ...view, labels: v })} testId="opt-labels" icon={<Tag size={14} aria-hidden="true" />} title="Show or hide the atom labels" />
              <Segmented label="Molecule style" value={view.style} onChange={(v) => setView({ ...view, style: v })} testId="opt-style" small options={[{ value: "ball", label: "Ball-and-stick", testId: "style-ball" }, { value: "density", label: "Electron density", testId: "style-density", title: "Qualitative electron-density / shielding colouring" }]} />
            </div>
            {formulaMode === "structural" && <pre className="nm-structural" data-testid="structural-formula" aria-label={`Structural formula of ${mol.name}`}>{mol.structural}</pre>}
          </MoleculeViewer>
          {view.style === "density" && <DensityLegend />}
        </div>
        <aside className="nm-side nm-panel" aria-label="Environments and shielding">
          <Segmented label="Panel" value={tab} onChange={setTab} testId="mp-tabs" options={[{ value: "env", label: "Hydrogen environments", testId: "tab-env" }, { value: "shield", label: "Shielding", testId: "tab-shield" }]} />
          {tab === "env" ? (
            <div className="nm-side-body" data-testid="env-panel">
              <Explain testId="mp-explain">{explain}</Explain>
              <div className="nm-env-list" role="group" aria-label="Hydrogen environments">
                {mol.environments.map((e) => {
                  const known = idn.identified.has(e.id);
                  return (
                    <div key={e.id} className={`nm-envcard${e.id === selectedEnvId ? " is-sel" : ""}`} style={e.id === selectedEnvId ? { borderColor: e.color } : undefined} data-testid={`envcard-${e.id}`}>
                      <EnvChip env={e} selected={e.id === selectedEnvId} identified={known} onClick={() => { if (known) { select(e.id); setFocusAtom(null); } else { select(e.id); idn.identify(e.id); } }} testId={`env-chip-${e.id}`} title={known ? "Highlight these hydrogens" : "Reveal this environment"} />
                      {known && <p className="nm-envdesc">{e.descriptor}</p>}
                    </div>
                  );
                })}
              </div>
              <div className="nm-row">
                <span className="nm-note-s" data-testid="identified-count">{nIdentified} of {total} identified</span>
                <button type="button" className="sim-btn nm-textbtn" onClick={idn.identifyAll} disabled={nIdentified === total} data-testid="reveal-all">Reveal all equivalent hydrogens</button>
                <button type="button" className="sim-btn nm-textbtn" onClick={() => { idn.clearAll(); clear(); setFocusAtom(null); }} disabled={nIdentified === 0} data-testid="hide-all">Hide all</button>
              </div>
              {env && (
                <div className="nm-detail" data-testid="env-detail">
                  <p><b>{env.count} equivalent H</b> · δ ≈ {env.delta.toFixed(1)} ppm · {shieldingVerdict(env).level}</p>
                  <button type="button" className="sim-btn nm-textbtn" onClick={() => setTab("shield")} data-testid="why-shift">Why is the shift here? (shielding)</button>
                  {env.exchangeable && <p className="nm-note-s" data-testid="exchange-note">{teacher ? env.exchangeNote : "Special case: an O–H hydrogen exchanges rapidly, so its shift varies and it usually does not split its neighbours."}</p>}
                </div>
              )}
              <div className="nm-predict" data-testid="predict-signals">
                <h4 className="nm-h">Predict the number of signals</h4>
                <p className="nm-note-s">How many different hydrogen environments (so signals) does {mol.name} have?</p>
                <div className="nm-row" role="group" aria-label="Number of signals">
                  {q.options.map((n) => <button key={n} type="button" className="sim-btn nm-numbtn" aria-pressed={predict.choice === n} onClick={() => setPredict({ choice: n, checked: false })} data-testid={`predict-${n}`}>{n}</button>)}
                  <button type="button" className="sim-btn sim-btn--primary nm-textbtn" disabled={predict.choice === null} onClick={() => { setPredict({ ...predict, checked: true }); idn.identifyAll(); }} data-testid="predict-check">Check</button>
                  {predict.checked && <button type="button" className="sim-btn nm-textbtn" onClick={() => setPredict({ choice: null, checked: false })} data-testid="predict-retry">Try again</button>}
                </div>
                <Feedback result={result} testId="predict-feedback" />
              </div>
              {teacher && (
                <div className="nm-teacher" data-testid="teacher-compare">
                  <h4 className="nm-h">Teacher: compare two environments</h4>
                  <div className="nm-row" role="group" aria-label="Environment to compare with">
                    {mol.environments.filter((e) => e.id !== selectedEnvId).map((e) => <button key={e.id} type="button" className="sim-btn nm-textbtn" aria-pressed={compareEnvId === e.id} onClick={() => setCompareEnvId(compareEnvId === e.id ? null : e.id)} data-testid={`cmp-${e.id}`}><EnvMark env={e} size={16} /> {e.label}</button>)}
                  </div>
                  {env && cmpEnv ? (
                    <table className="nm-table" data-testid="compare-table">
                      <thead><tr><th scope="col" /><th scope="col">{env.label} ({env.letter})</th><th scope="col">{cmpEnv.label} ({cmpEnv.letter})</th></tr></thead>
                      <tbody>
                        <tr><th scope="row">Hydrogens</th><td>{env.count}</td><td>{cmpEnv.count}</td></tr>
                        <tr><th scope="row">δ / ppm</th><td>{env.delta.toFixed(1)}</td><td>{cmpEnv.delta.toFixed(1)}</td></tr>
                        <tr><th scope="row">More shielded</th><td>{env.delta < cmpEnv.delta ? "yes" : env.delta > cmpEnv.delta ? "no" : "same"}</td><td>{cmpEnv.delta < env.delta ? "yes" : cmpEnv.delta > env.delta ? "no" : "same"}</td></tr>
                        <tr><th scope="row">Why</th><td>{env.descriptor}</td><td>{cmpEnv.descriptor}</td></tr>
                      </tbody>
                    </table>
                  ) : <p className="nm-note-s">Select an environment, then choose another to compare their count, shift and surroundings.</p>}
                  <p className="nm-note-s" data-testid="teacher-note">{mol.teacherNote}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="nm-side-body" data-testid="shield-panel">
              <ShieldingExplorer mol={mol} selectedEnvId={selectedEnvId} onSelectEnv={(id) => { select(id); idn.identify(id); setFocusAtom(null); }} compareEnvId={compareEnvId} onCompare={setCompareEnvId}
                freqMHz={studio?.operatingFrequencyMHz ?? 400} b0Tesla={studio?.b0Tesla ?? 9.39} mode={studio?.mode} onClose={() => setTab("env")} />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
