import { fmtMHz } from "./palette.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MoleculePicker from "./MoleculePicker.jsx";
import MoleculeViewer from "./MoleculeViewer.jsx";
import SpectrumPlot from "./SpectrumPlot.jsx";
import { EnvChip } from "./EnvBits.jsx";
import { Explain, Feedback, PascalBars, Segmented, Toggle, useStepRequest, useTween } from "./shared.jsx";
import useStageState from "./useStageState.js";
import { layoutOf, useIdentified, useLinkedSelection, useMolecule } from "./useSelection.js";
import { selectAtom } from "../model/linking.js";
import { buildSignals, integrateSignal, jInPpm, viewForSignal, DEFAULT_FREQ_MHZ, pascalText } from "../model/spectrum.js";
import { shieldingVerdict, offsetHz } from "../model/shielding.js";
import { checkRatio, ratioQuestion } from "../model/challenges.js";
import "./molecular.css";

// Stage 4 "The Spectrum": the spectrum is BUILT from the environments the student has identified (uncoupled first), then splitting is
// switched on (the animation divides each single resonance, area conserved), integration is shown, and every element of the spectrum
// links back to the molecule: peak -> atoms, integral -> count, splitting -> coupled neighbours, shift -> shielding explanation.

export default function SpectrumStage({ studio }) {
  const mol = useMolecule(studio);
  const token = studio?.resetToken ?? 0;
  const L = layoutOf(studio?.containerSize);
  const freq = studio?.operatingFrequencyMHz ?? DEFAULT_FREQ_MHZ;
  const teacher = studio?.mode === "teacher";
  const { selectedEnvId, select, toggle, clear } = useLinkedSelection(studio, mol);
  const idn = useIdentified(mol, studio);
  const [coupled, setCoupled] = useStageState(`sp:coupled:${mol.id}`, false, token);
  const [opts, setOpts] = useStageState("sp:opts", { integration: false, assignments: true, splitting: false }, token);
  const [tab, setTab] = useStageState("sp:tab", "signal", token);
  const [coupledFocus, setCoupledFocus] = useStageState(`sp:cf:${mol.id}`, false, token);
  const [ratio, setRatio] = useStageState(`sp:ratio:${mol.id}`, { inputs: [], checked: false, revealed: false }, token);
  const [compareEnvId, setCompareEnvId] = useStageState(`sp:cmp:${mol.id}`, null, token);
  const [replay, setReplay] = useState(0);
  const focusToken = 0;
  const [focusAtom, setFocusAtom] = useState(null);

  // splitting progress t: 0 = single resonances, 1 = fully split. Areas are constant at every t.
  const t = useTween(coupled ? 1 : 0, { durationMs: 1800, speed: studio?.speed ?? 1, reducedMotion: studio?.reducedMotion, restartToken: replay, from: 0 });
  const doneCoupled = coupled && t >= 0.999;

  const idsKey = idn.ids.join("|");
  const signals = useMemo(() => buildSignals(mol, { freqMHz: freq, coupling: true, progress: t, envIds: idn.ids }), [mol, freq, Math.round(t * 200), idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const fullSignals = useMemo(() => buildSignals(mol, { freqMHz: freq, coupling: true, progress: 1 }), [mol, freq]);
  const sel = signals.find((s) => s.envId === selectedEnvId) ?? null;
  const selFull = fullSignals.find((s) => s.envId === selectedEnvId) ?? null;
  const env = sel?.env ?? mol.environments.find((e) => e.id === selectedEnvId) ?? null;

  useEffect(() => { if (selectedEnvId && !idn.identified.has(selectedEnvId)) idn.identify(selectedEnvId); }, [selectedEnvId, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFocusAtom(null); }, [mol.id, token]);
  useEffect(() => { if (!selectedEnvId) setFocusAtom(null); }, [selectedEnvId]);

  const coupledEnvIds = useMemo(() => (coupledFocus && selFull ? selFull.neighbours.map((n) => n.envId) : []), [coupledFocus, selFull]);
  const ctx = useMemo(() => ({ selectedEnvId, identified: idn.identified, coupledEnvIds, style: "ball", focusAtom }), [selectedEnvId, idn.identified, coupledEnvIds, focusAtom]);

  // events: identify each environment in turn -> couple -> integrate
  const eventStep = useCallback((dir) => {
    const order = mol.environments.map((e) => e.id);
    if (dir > 0) {
      const next = order.find((id) => !idn.identified.has(id));
      if (next) { idn.identify(next); select(next); }
      else if (!coupled) setCoupled(true);
      else if (!opts.integration) setOpts({ ...opts, integration: true });
    } else if (opts.integration) setOpts({ ...opts, integration: false });
    else if (coupled) setCoupled(false);
    else { const last = [...order].reverse().find((id) => idn.identified.has(id)); if (last) { idn.unidentify(last); if (last === selectedEnvId) clear(); } }
  }, [mol, idn, coupled, opts, select, clear, selectedEnvId, setCoupled, setOpts]);
  useStepRequest(studio?.stepRequest, eventStep);
  // Play = walk through the events automatically (pausing is just Pause); stops after the last event
  const stepRef = useRef(eventStep); stepRef.current = eventStep;
  const atEnd = idn.ids.length === mol.environments.length && coupled && opts.integration;
  useEffect(() => {
    if (!studio?.playing) return undefined;
    if (atEnd) { studio?.setPlaying?.(false); return undefined; }
    const id = setTimeout(() => stepRef.current(1), (studio?.reducedMotion ? 900 : 2300) / (studio?.speed ?? 1));
    return () => clearTimeout(id);
  }, [studio?.playing, idsKey, coupled, opts.integration, atEnd, studio?.speed]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSelectEnv = (envId, part) => {
    if (part === "splitting") { select(envId); setCoupledFocus(true); setTab("splitting"); if (!opts.splitting) setOpts({ ...opts, splitting: true }); return; }
    if (part === "integral") { select(envId); setTab("area"); return; }
    if (part === "shift") { select(envId); setTab("shift"); return; }
    toggle(envId); if (envId === selectedEnvId) return; setTab((cur) => (cur === "area" || cur === "splitting" || cur === "shift" ? cur : "signal"));
  };
  const onAtomClick = (idx) => {
    const s = selectAtom(mol, idx); setFocusAtom(idx);
    if (s.selectedEnvId) { select(s.selectedEnvId); idn.identify(s.selectedEnvId); } else clear();
  };

  const nId = idn.ids.length; const total = mol.environments.length;
  const allIdentified = nId === total;
  const q = useMemo(() => ratioQuestion(mol.id), [mol.id]);
  const ratioResult = ratio.checked ? checkRatio(q, q.rows.map((_, i) => ratio.inputs[i] ?? "")) : null;
  const showNumbers = teacher || ratio.checked || ratio.revealed;
  const maxArea = Math.max(...signals.map((s) => s.count), 1);

  const explain = (() => {
    if (nId === 0) return "The spectrum is empty. Identify each hydrogen environment (click a hydrogen in the molecule, or choose Add next environment): every environment adds one resonance at its chemical shift.";
    if (!coupled && t < 0.001) return `${nId} of ${total} environments shown, each as a single resonance (coupling switched off, so no splitting yet). Different environments resonate at different δ because their electrons shield the nuclei differently.`;
    if (coupled && t < 0.999) return "Each resonance is dividing into a multiplet: the line separation is J in hertz, and the total area under each signal is unchanged.";
    if (env && doneCoupled) {
      const s = selFull; const n = s.multiplicity.nNeighbours;
      if (env.exchangeable) return `${env.label}: an exchangeable O–H proton shows a broadened singlet; exchange averages out its coupling to neighbouring protons.`;
      return n ? `${env.label} (${env.count} H) has ${n} neighbouring H, so it is split into ${n} + 1 = ${n + 1} lines: a ${s.multiplicity.name}. The splitting comes from the neighbours, not from its own H.` : `${env.label} (${env.count} H) has no neighbouring H on adjacent atoms: a singlet.`;
    }
    return doneCoupled ? "Select a multiplet (or a hydrogen in the molecule) to see its neighbours, area and shift." : "Switch on coupling to see the splitting.";
  })();

  const wide = L.wide; const xwide = L.w >= 1180;
  const emptyMsg = "No signals yet — identify hydrogen environments to build the spectrum.";
  const showPartner = (id) => mol.environments.find((e) => e.id === id);

  return (
    <section className={`nm-root nm-stage${wide ? " nm-wide" : ""}${xwide ? " nm-xwide" : ""}${L.short ? " nm-short" : ""}`} data-testid="spectrum-stage" data-molecule={mol.id} data-mode={studio?.mode ?? "student"} aria-label="The spectrum">
      <header className="nm-bar">
        <MoleculePicker value={mol.id} onChange={(id) => studio?.setMoleculeId?.(id)} compact />
        <div className="nm-row" data-testid="build-controls">
          <button type="button" className="sim-btn sim-btn--primary nm-textbtn" onClick={() => eventStep(1)} disabled={allIdentified} data-testid="add-next">Add next environment</button>
          <button type="button" className="sim-btn nm-textbtn" onClick={idn.identifyAll} disabled={allIdentified} data-testid="show-all">Show all</button>
          <button type="button" className="sim-btn nm-textbtn" onClick={() => { idn.clearAll(); clear(); setCoupled(false); setFocusAtom(null); }} disabled={nId === 0} data-testid="clear-spectrum">Clear spectrum</button>
        </div>
        <Segmented label="Coupling" value={coupled} onChange={(v) => { setCoupled(v); if (v) setReplay((r) => r + 0); }} testId="coupling-toggle" small options={[{ value: false, label: "Uncoupled", testId: "coupling-off", title: "Simplified view: one line per environment" }, { value: true, label: "Splitting on", testId: "coupling-on", title: "Show spin–spin splitting" }]} />
        <button type="button" className="sim-btn nm-textbtn" onClick={() => { setCoupled(true); setReplay((r) => r + 1); }} disabled={nId === 0} data-testid="replay-split" title="Repeat the splitting animation">Replay splitting</button>
        <Toggle label="Integration" pressed={opts.integration} onChange={(v) => setOpts({ ...opts, integration: v })} testId="opt-integration" title="Show or hide the integration trace" />
        <Toggle label="Assignments" pressed={opts.assignments} onChange={(v) => setOpts({ ...opts, assignments: v })} testId="opt-assignments" title="Label each signal with its environment" />
        <Toggle label="Splitting marks" pressed={opts.splitting} onChange={(v) => setOpts({ ...opts, splitting: v })} testId="opt-splitting" title="Number the lines and show J" />
      </header>
      <div className="nm-spec-layout">
        <div className="nm-spec-left">
          <MoleculeViewer molecule={mol} ctx={ctx} onAtomClick={onAtomClick} onBackgroundClick={() => { setFocusAtom(null); clear(); }} reducedMotion={studio?.reducedMotion} testId="mol-stage-mini" ariaLabel={`3D model of ${mol.name}, linked to the spectrum`} />
          <div className="nm-env-row" role="group" aria-label="Hydrogen environments">
            {mol.environments.map((e) => <EnvChip key={e.id} env={e} selected={e.id === selectedEnvId} identified={idn.identified.has(e.id)} coupled={coupledEnvIds.includes(e.id)} showShift={idn.identified.has(e.id)} onClick={() => { if (!idn.identified.has(e.id)) { idn.identify(e.id); select(e.id); } else toggle(e.id); }} testId={`env-chip-${e.id}`} />)}
          </div>
        </div>
        <div className="nm-spec-plot">
          <SpectrumPlot molecule={mol} signals={signals} freqMHz={freq} selectedEnvId={selectedEnvId} coupledEnvIds={coupledEnvIds} compareEnvId={teacher ? compareEnvId : null} showIntegration={opts.integration} showAssignments={opts.assignments}
            showSplitting={opts.splitting && t > 0.98} onSelectEnv={onSelectEnv} resetToken={token} emptyMessage={emptyMsg} reducedMotion={studio?.reducedMotion} labelMult={doneCoupled} focusToken={focusToken} />
        </div>
        <div className="nm-panel nm-inspect" data-testid="inspector">
          <div className="nm-inspect-in">
            <div className="nm-row" style={{ justifyContent: "space-between" }}>
              <Segmented label="Signal information" value={tab} onChange={setTab} testId="inspect-tabs" small options={[{ value: "signal", label: "Signal", testId: "tab-signal" }, { value: "area", label: "Area", testId: "tab-area" }, { value: "splitting", label: "Splitting", testId: "tab-splitting" }, { value: "shift", label: "Shift", testId: "tab-shift" }]} />
              {teacher && allIdentified && <div className="nm-row" role="group" aria-label="Compare with">{mol.environments.filter((e) => e.id !== selectedEnvId).map((e) => <button key={e.id} type="button" className="sim-btn nm-textbtn" aria-pressed={compareEnvId === e.id} onClick={() => setCompareEnvId(compareEnvId === e.id ? null : e.id)} data-testid={`cmp-${e.id}`}>vs {e.letter}</button>)}</div>}
            </div>
            <Explain testId="sp-explain">{explain}</Explain>
            <div className="nm-inspect-body" data-testid="inspect-body">
              {tab === "area" ? (
                <div className="nm-bars" data-testid="area-panel">
                  <p className="nm-note-s">Integration compares the <b>area</b> of each whole multiplet (not the height, and not the number of lines): area ∝ number of equivalent H.</p>
                  {signals.length === 0 && <p className="nm-note-s">Add signals first.</p>}
                  {signals.map((s) => (
                    <button key={s.envId} type="button" className="nm-bar-row sim-btn" style={{ background: "transparent", boxShadow: "none", justifyContent: "stretch", padding: "2px 4px", minHeight: 26, borderColor: s.envId === selectedEnvId ? s.env.color : "transparent" }} aria-pressed={s.envId === selectedEnvId} onClick={() => toggle(s.envId)} data-testid={`area-bar-${s.envId}`}>
                      <span style={{ textAlign: "left" }}>{s.env.letter} · {s.label}</span>
                      <span className="nm-bar-track"><span className="nm-bar-fill" style={{ display: "block", width: `${(s.count / maxArea) * 100}%`, background: s.env.color }} /></span>
                      <span style={{ textAlign: "right", fontWeight: 800 }} data-testid={`area-val-${s.envId}`}>{showNumbers || s.envId === selectedEnvId && opts.integration ? `${s.count} H` : "?"}</span>
                    </button>
                  ))}
                  {allIdentified && (
                    <div className="nm-predict" data-testid="ratio-predict">
                      <p className="nm-note-s">Predict the ratio of hydrogens (left to right, high δ to low δ), then check.</p>
                      <div className="nm-ratio-inputs">
                        {q.rows.map((r, i) => (
                          <label key={r.envId} className="nm-ratio-input">{mol.environments.find((e) => e.id === r.envId).label}
                            <input type="text" inputMode="numeric" value={ratio.inputs[i] ?? ""} onChange={(e) => { const inputs = [...ratio.inputs]; inputs[i] = e.target.value; setRatio({ ...ratio, inputs, checked: false }); }} data-testid={`ratio-in-${i}`} aria-label={`Hydrogens for signal ${i + 1}`} />
                          </label>
                        ))}
                        <button type="button" className="sim-btn sim-btn--primary nm-textbtn" onClick={() => setRatio({ ...ratio, checked: true })} data-testid="ratio-check">Check</button>
                        <button type="button" className="sim-btn nm-textbtn" onClick={() => setRatio({ ...ratio, revealed: true, checked: false })} data-testid="ratio-reveal">Reveal</button>
                      </div>
                      <Feedback result={ratioResult} testId="ratio-feedback" />
                    </div>
                  )}
                </div>
              ) : tab === "splitting" ? (
                sel && selFull ? (
                  <div data-testid="splitting-panel" className="nm-split2">
                    <div className="nm-split2-a">
                      <dl className="nm-kv">
                        <dt>Neighbouring H</dt><dd data-testid="n-neighbours">{selFull.multiplicity.nNeighbours}{selFull.neighbours.length ? ` (${selFull.neighbours.map((n) => `${n.count} on ${showPartner(n.envId).label}`).join(" + ")})` : ""}</dd>
                        <dt>Pattern</dt><dd data-testid="pattern-name">{selFull.multiplicity.nPlusOne ? `${selFull.multiplicity.nNeighbours} + 1 = ${selFull.multiplicity.nLines} lines: ${selFull.multiplicity.name}` : selFull.multiplicity.name}</dd>
                        <dt>Line intensities</dt><dd>{pascalText(selFull.multiplicity.nNeighbours)}</dd>
                        {selFull.spins.length > 0 && <><dt>J</dt><dd data-testid="j-value">{selFull.spins[0].J} Hz = {jInPpm(selFull.spins[0].J, freq).toFixed(4)} ppm at {fmtMHz(freq)} MHz</dd></>}
                      </dl>
                      <div className="nm-row">
                        {selFull.neighbours.map((n) => <EnvChip key={n.envId} env={showPartner(n.envId)} selected={false} coupled={coupledFocus} onClick={() => setCoupledFocus(!coupledFocus)} testId={`neighbour-${n.envId}`} title="Show or hide the coupled neighbours in the molecule and the spectrum" />)}
                        {selFull.neighbours.length > 0 && <Toggle label="Highlight coupled neighbours" pressed={coupledFocus} onChange={setCoupledFocus} testId="toggle-coupled" />}
                      </div>
                      <p className="nm-note-s">{selFull.exchangeable ? (teacher ? env.exchangeNote : "An exchangeable O–H proton usually does not split its neighbours (and is not split by them) under typical conditions.") : selFull.multiplicity.nNeighbours === 0 ? "No H on the neighbouring atoms, and the H within a group are equivalent, so there is no splitting." : "J in hertz belongs to the coupled pair and does not change with spectrometer frequency; the ppm gap between lines does."}</p>
                      {mol.firstOrderCaveat?.envId === env.id && <p className="nm-note-s" data-testid="first-order-caveat">{mol.firstOrderCaveat.text}</p>}
                      {teacher && <p className="nm-note-s" data-testid="teacher-note">{mol.teacherNote}</p>}
                    </div>
                    <div className="nm-split2-b">
                      <div className="nm-inset" data-testid="inset-wrap" role="img" aria-label={`Zoomed view of the ${env.label} multiplet`}>
                        <SpectrumPlot molecule={mol} signals={[selFull]} freqMHz={freq} selectedEnvId={null} showSplitting showAssignments={false} hideToolbar hideLabels interactive={false} fixedView={viewForSignal(selFull)} testId="inset-spectrum" reducedMotion />
                      </div>
                      <PascalBars n={selFull.multiplicity.nNeighbours} color={env.color} />
                    </div>
                  </div>
                ) : <p className="nm-note-s" data-testid="splitting-empty">Select a multiplet to see its neighbours and the n + 1 pattern.</p>
              ) : tab === "shift" ? (
                env ? (
                  <div className="nm-bars" data-testid="shift-panel">
                    <p><b>{env.label}</b> (environment {env.letter}): δ ≈ {env.delta.toFixed(2)} ppm ({offsetHz(env.delta, freq).toFixed(0)} Hz from TMS at {fmtMHz(freq)} MHz). {shieldingVerdict(env).text}</p>
                    <p className="nm-note-s">δ = (ν − ν<sub>ref</sub>)/ν<sub>ref</sub> × 10⁶. Higher δ = downfield = more deshielded. {env.exchangeable ? "O–H shifts are variable." : `Representative range ${env.range[0]}–${env.range[1]} ppm.`}</p>
                    <p className="nm-note-s" data-testid="shift-provenance">Source: {env.basis === "booklet" ? `IB Chemistry data booklet 2025, §21 (“${env.bookletRow}”)` : `standard reference value${env.bookletRow ? ` (nearest booklet row: “${env.bookletRow}”)` : " (no booklet row)"}`}. {env.note}</p>
                  </div>
                ) : <p className="nm-note-s">Select a multiplet or its δ label to see the shielding explanation.</p>
              ) : (
                sel ? (
                  <div data-testid="signal-panel">
                    <dl className="nm-kv nm-kv-wide">
                      <div><dt>Assignment</dt><dd>{env.letter} · {env.label}</dd></div>
                      <div><dt>Hydrogens</dt><dd>{env.count}</dd></div>
                      <div><dt>δ</dt><dd>{env.delta.toFixed(2)} ppm ({offsetHz(env.delta, freq).toFixed(0)} Hz)</dd></div>
                      <div><dt>Multiplicity</dt><dd data-testid="mult-name">{doneCoupled ? selFull.multiplicity.name : "single line (coupling off)"}</dd></div>
                    </dl>
                    <p className="nm-note-s" style={{ marginTop: 6 }}>{env.descriptor}</p>
                    <p className="nm-note-s">Area under this signal: {integrateSignal(selFull).toFixed(2)} (≈ {env.count} H, independent of splitting).</p>
                  </div>
                ) : <p className="nm-note-s" data-testid="signal-empty">Click a multiplet in the spectrum, or a hydrogen in the molecule: they highlight each other.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
