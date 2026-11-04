import { fmtMHz } from "./palette.js";
import { useEffect, useMemo, useState } from "react";
import MoleculePicker from "./MoleculePicker.jsx";
import MoleculeViewer from "./MoleculeViewer.jsx";
import SplitDiagram from "./SplitDiagram.jsx";
import { EnvChip } from "./EnvBits.jsx";
import { Explain, Feedback, PascalBars, Segmented, Toggle, useStepRequest, useTween } from "./shared.jsx";
import useStageState from "./useStageState.js";
import { layoutOf, useLinkedSelection, useMolecule } from "./useSelection.js";
import { selectAtom } from "../model/linking.js";
import { buildSignals, jInPpm, neighbourSpins, MULT_NAMES, pascalRow, pascalText, DEFAULT_FREQ_MHZ, integrateSignal } from "../model/spectrum.js";
import { checkSplitting, splittingExplanation, splittingQuestion } from "../model/challenges.js";
import "./molecular.css";

// 'Splitting Patterns' tab: (1) the n + 1 rule with 0-3 equivalent neighbours, J in Hz versus ppm, animated division of one resonance;
// (2) the same animation for any environment of any molecule (neighbours highlighted in the molecule, predict before reveal);
// (3) optional teacher notes on where the simple first-order picture stops working.
const FREQS = [60, 90, 100, 200, 300, 400, 500, 600, 800];
const GENERIC_DELTA = 2.0; // illustrative position of the generic H group in the n + 1 demonstration (not molecule data)

function Contrast({ J, freq }) {
  // a triplet (one environment, spacing J) versus three separate environments (spacing in ppm)
  const w = 360; const h = 96; const L = 14; const R = 14;
  const lw = 1.2; // Hz
  const line = (hz0, area, v0, v1, X, Yv) => { let d = ""; for (let i = 0; i <= 160; i += 1) { const x = v0 + ((v1 - v0) * i) / 160; let v = lorentz(x, hz0, lw, area); d += `${i ? "L" : "M"}${X(x).toFixed(1)} ${Yv(v).toFixed(1)}`; } return d; };
  const half = (w - L - R) / 2;
  const xA = (hz) => L + half * 0.5 - (hz / 28) * (half * 0.45); const XA = (hz) => xA(hz);
  const centresB = [-90, 0, 90]; const XB = (hz) => L + half + 10 + half * 0.5 - (hz / 130) * (half * 0.42) - 5;
  const peak = lorentz(0, 0, lw, 1); const Yv = (v) => 70 - (v / peak) * 48;
  const tri = [-J, 0, J];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="nm-shield-svg" role="img" aria-label="Comparison of one triplet and three separate environments" data-testid="contrast-diagram" style={{ maxHeight: 140 }}>
      <text x={L} y={12} fontSize="10.5" fontWeight="800" fill="#e8f0ff" className="nm-svgtext">One environment: triplet (J = {J} Hz)</text>
      <path d={(() => { let d = ""; const xs = []; for (let i = 0; i <= 200; i += 1) xs.push(-28 + (56 * i) / 200); xs.sort((a, b) => b - a); xs.forEach((hz, i) => { let v = 0; tri.forEach((o, k) => { v += lorentz(hz, o, lw, [0.25, 0.5, 0.25][k]); }); d += `${i ? "L" : "M"}${XA(hz).toFixed(1)} ${Yv(v).toFixed(1)}`; }); return d; })()} fill="none" stroke="#22d3ee" strokeWidth="2" />
      <text x={L + half * 0.5} y={88} textAnchor="middle" fontSize="9.5" fill="#a9bbe3" className="nm-svgtext">total area 1 (1:2:1 inside it)</text>
      <text x={L + half + 10} y={12} fontSize="10.5" fontWeight="800" fill="#e8f0ff" className="nm-svgtext">Three environments: three singlets</text>
      <path d={(() => { let d = ""; const xs = []; for (let i = 0; i <= 260; i += 1) xs.push(-130 + (260 * i) / 260); xs.sort((a, b) => b - a); centresB.forEach((c) => { for (let k = 0; k < 40; k += 1) xs.push(c + 0.6 * Math.tan(Math.PI * ((k + 0.5) / 40 - 0.5)) * 1); xs.push(c); }); xs.sort((a, b) => b - a); xs.forEach((hz, i) => { if (Math.abs(hz) > 130) return; let v = 0; centresB.forEach((o) => { v += lorentz(hz, o, lw, 1 / 3); }); d += `${d ? "L" : "M"}${XB(hz).toFixed(1)} ${Yv(v * 3 * 0.75).toFixed(1)}`; }); return d; })()} fill="none" stroke="#a78bfa" strokeWidth="2" />
      <text x={L + half + 10 + half * 0.5} y={88} textAnchor="middle" fontSize="9.5" fill="#a9bbe3" className="nm-svgtext">three areas, each its own δ</text>
    </svg>
  );
}
function lorentz(x, x0, w, a) { return (a * (w / 2)) / (Math.PI * ((x - x0) ** 2 + (w / 2) ** 2)); }

export default function SplittingLab({ studio }) {
  const mol = useMolecule(studio);
  const token = studio?.resetToken ?? 0;
  const L = layoutOf(studio?.containerSize);
  const teacher = studio?.mode === "teacher";
  const [localFreq, setLocalFreq] = useState(DEFAULT_FREQ_MHZ);
  const freq = studio?.operatingFrequencyMHz ?? localFreq;
  const setFreq = (f) => { if (studio?.setOperatingFrequencyMHz) studio.setOperatingFrequencyMHz(f); else setLocalFreq(f); };
  const [mode, setMode] = useStageState("sl:mode", "rule", token);
  const [n, setN] = useStageState("sl:n", 2, token);
  const [J, setJ] = useStageState("sl:J", 7, token);
  const [showContrast, setShowContrast] = useStageState("sl:contrast", false, token);
  const [k, setK] = useStageState("sl:k:rule", 0, token); // current step (number of neighbours already divided)
  const { selectedEnvId, select, clear } = useLinkedSelection(studio, mol);
  const [kMol, setKMol] = useStageState(`sl:k:mol:${mol.id}:${selectedEnvId ?? "-"}`, 0, token);
  const [predict, setPredict] = useStageState(`sl:predict:${mol.id}:${selectedEnvId ?? "-"}`, { choice: null, checked: false }, token);
  const [replay, setReplay] = useState(0);
  const [focusAtom, setFocusAtom] = useState(null);
  useEffect(() => { setFocusAtom(null); }, [mol.id, token]);

  // ---- which spins are dividing the line ----
  const ruleSpins = useMemo(() => Array.from({ length: n }, () => ({ envId: "x", J })), [n, J]);
  const molEnv = mode === "molecule" && selectedEnvId ? mol.environments.find((e) => e.id === selectedEnvId) : null;
  const molSpins = useMemo(() => (molEnv ? neighbourSpins(mol, molEnv.id) : []), [mol, molEnv]);
  const spins = mode === "rule" ? ruleSpins : molSpins;
  const nSp = spins.length;
  const kk = Math.min(mode === "rule" ? k : kMol, nSp); const setKK = mode === "rule" ? setK : setKMol;
  const revealed = mode === "rule" || !teacher ? (mode === "rule" || predict.checked) : true;
  const phase = useTween(mode === "molecule" && !revealed ? 0 : kk, { durationMs: 1100, speed: studio?.speed ?? 1, reducedMotion: studio?.reducedMotion, restartToken: replay, from: 0 });
  const phaseC = Math.min(phase, nSp);
  const centerPpm = mode === "rule" ? GENERIC_DELTA : molEnv?.delta ?? GENERIC_DELTA;
  const partnerById = useMemo(() => (mode === "rule" ? { x: { color: "#22d3ee", letter: "n", label: "neighbour" } } : Object.fromEntries(mol.environments.map((e) => [e.id, e]))), [mode, mol]);

  // events: one neighbour at a time
  useStepRequest(studio?.stepRequest, (dir) => { if (mode === "molecule" && !revealed) return; setKK((v) => Math.max(0, Math.min(nSp, v + dir))); });
  useEffect(() => {
    if (!studio?.playing) return undefined;
    if (mode === "molecule" && !revealed) { studio?.setPlaying?.(false); return undefined; }
    if (kk >= nSp) { if (Math.abs(phase - nSp) < 1e-3) studio?.setPlaying?.(false); return undefined; }
    if (Math.abs(phase - kk) > 1e-3) return undefined; // wait for the current division to finish: a pause at every neighbour
    const id = setTimeout(() => setKK(kk + 1), (studio?.reducedMotion ? 500 : 800) / (studio?.speed ?? 1));
    return () => clearTimeout(id);
  }, [studio?.playing, kk, nSp, phase, mode, revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const pr = pascalRow(nSp);
  const complete = Math.abs(phaseC - nSp) < 1e-6;
  const nLinesShown = complete ? nSp + 1 : Math.floor(phaseC + 1e-9) + 1;
  const sigFull = useMemo(() => (molEnv ? buildSignals(mol, { freqMHz: freq, coupling: true, envIds: [molEnv.id] })[0] : null), [mol, molEnv, freq]);
  const q = molEnv ? splittingQuestion(mol.id, molEnv.id) : null;
  const pres = predict.checked && q ? checkSplitting(q, predict.choice) : null;
  const MULTS = MULT_NAMES.slice(0, 7);

  // coupled partner for the first-order criterion (delta nu / J)
  const partnerEnv = molEnv && sigFull?.neighbours[0] ? mol.environments.find((e) => e.id === sigFull.neighbours[0].envId) : null;
  const dnu = partnerEnv ? Math.abs(partnerEnv.delta - molEnv.delta) * freq : null;
  const ctxMol = useMemo(() => ({ selectedEnvId: molEnv?.id ?? null, identified: new Set(mol.environments.map((e) => e.id)), coupledEnvIds: molEnv && (revealed || predict.choice !== null || true) ? sigFull?.neighbours.map((x) => x.envId) ?? [] : [], style: "ball", focusAtom }), [mol, molEnv, sigFull, revealed, predict.choice, focusAtom]);
  const onAtomClick = (idx) => { const s = selectAtom(mol, idx); setFocusAtom(idx); if (s.selectedEnvId) { select(s.selectedEnvId); } else clear(); };

  const wide = L.wide;
  const ruleName = MULT_NAMES[nSp] ?? "multiplet";
  const explain = mode === "rule"
    ? (nSp === 0 ? "No neighbouring hydrogens: the signal is a singlet. A group with many hydrogens (such as CH₃) is still a singlet if it has no non-equivalent neighbours."
      : `${nSp} equivalent neighbouring H: each one divides every line into two, so after ${nSp} divisions there are ${nSp} + 1 = ${nSp + 1} lines (a ${ruleName}) with intensities ${pascalText(nSp)}. The total area is unchanged; only the height falls.`)
    : !molEnv ? "Select a hydrogen environment in the molecule. Its coupled neighbours will be outlined, and you can predict the pattern before the splitting is shown."
      : !revealed ? `Look at the neighbours outlined in the molecule: how many equivalent hydrogens do they contain? Predict the multiplicity of the ${molEnv.label} signal, then check.`
        : splittingExplanation(mol, molEnv.id);
  const status = (
    <div className="nm-statusbar" data-testid="split-status" aria-live="polite">
      <span>Neighbours <b data-testid="st-neighbours">{nSp}</b></span>
      <span>Lines <b data-testid="st-lines">{nLinesShown}</b></span>
      <span>Pattern <b data-testid="st-pattern">{complete ? ruleName : "dividing…"}</b></span>
      <span>Intensities <b data-testid="st-intensities">{complete ? pascalText(nSp) : "…"}</b></span>
      <span>Total area <b data-testid="st-area">1.00</b> <span className="nm-note-s">(unchanged)</span></span>
      {nSp > 0 && <span>J <b data-testid="st-j">{spins[0].J} Hz</b> = <b data-testid="st-jppm">{jInPpm(spins[0].J, freq).toFixed(4)} ppm</b> at {fmtMHz(freq)} MHz</span>}
    </div>
  );

  const freqSelect = (
    <div className="nm-field"><label htmlFor="sl-freq">Spectrometer</label>
      <select id="sl-freq" className="nm-select" value={freq} onChange={(e) => setFreq(Number(e.target.value))} data-testid="freq-select">{(FREQS.includes(freq) ? FREQS : [...FREQS, freq].sort((a, b) => a - b)).map((f) => <option key={f} value={f}>{fmtMHz(f)} MHz (B₀ ≈ {(f / 42.577478).toFixed(2)} T)</option>)}</select>
    </div>
  );

  return (
    <section className={`nm-root nm-stage${wide ? " nm-wide" : ""}${L.short ? " nm-short" : ""}`} data-testid="splitting-lab" data-mode={studio?.mode ?? "student"} data-lab-mode={mode} aria-label="Splitting patterns">
      <header className="nm-bar">
        <Segmented label="Splitting lab mode" value={mode} onChange={setMode} testId="sl-mode" options={[{ value: "rule", label: "n + 1 rule", testId: "mode-rule" }, { value: "molecule", label: "In a molecule", testId: "mode-molecule" }]} />
        {mode === "molecule" && <MoleculePicker value={mol.id} onChange={(id) => { studio?.setMoleculeId?.(id); clear(); }} compact />}
        {freqSelect}
      </header>
      <div className="nm-split-layout">
        <div className="nm-split-main">
          {mode === "rule" ? (
            <div className="nm-split-ctrl" data-testid="rule-controls">
              <Segmented label="Equivalent neighbouring hydrogens" value={n} onChange={(v) => { setN(v); setK(v); setReplay((r) => r + 1); }} testId="n-select" options={[0, 1, 2, 3].map((v) => ({ value: v, label: `${v} neighbour${v === 1 ? "" : "s"}`, testId: `n-${v}` }))} />
              <div className="nm-field"><label htmlFor="sl-j">Coupling constant J = {J} Hz</label><input id="sl-j" className="nm-range" type="range" min="1" max="20" step="0.5" value={J} onChange={(e) => setJ(Number(e.target.value))} data-testid="j-slider" aria-valuetext={`${J} hertz`} /></div>
              <Segmented label="Coupling" value={k > 0} onChange={(v) => { setK(v ? n : 0); }} testId="coupling" small options={[{ value: false, label: "Coupling off", testId: "coupling-off" }, { value: true, label: "Coupling on", testId: "coupling-on" }]} />
              <button type="button" className="sim-btn nm-textbtn" onClick={() => { setK(n); setReplay((r) => r + 1); }} data-testid="replay">Replay</button>
              <div className="nm-row" role="group" aria-label="Step through the divisions">
                <button type="button" className="sim-btn nm-textbtn" onClick={() => setK(Math.max(0, k - 1))} disabled={k === 0} data-testid="sl-step-back">Step back</button>
                <button type="button" className="sim-btn nm-textbtn" onClick={() => setK(Math.min(n, k + 1))} disabled={k >= n} data-testid="sl-step-fwd">Divide by one neighbour</button>
              </div>
            </div>
          ) : (
            <div className="nm-split-ctrl" data-testid="mol-controls">
              <div className="nm-env-row" role="group" aria-label="Environment to split">
                {mol.environments.map((e) => <EnvChip key={e.id} env={e} selected={e.id === molEnv?.id} onClick={() => select(e.id)} showShift testId={`sl-env-${e.id}`} />)}
              </div>
              <div className="nm-row">
                <button type="button" className="sim-btn nm-textbtn" onClick={() => { setKMol(nSp); setReplay((r) => r + 1); }} disabled={!molEnv || !revealed} data-testid="mol-replay">Replay</button>
                <button type="button" className="sim-btn nm-textbtn" onClick={() => setKMol(Math.max(0, kk - 1))} disabled={!molEnv || !revealed || kk === 0} data-testid="mol-step-back">Step back</button>
                <button type="button" className="sim-btn nm-textbtn" onClick={() => setKMol(Math.min(nSp, kk + 1))} disabled={!molEnv || !revealed || kk >= nSp} data-testid="mol-step-fwd">Divide by one neighbour</button>
              </div>
            </div>
          )}
          <SplitDiagram spins={spins} phase={phaseC} centerPpm={centerPpm} freqMHz={freq} partnerById={partnerById} widthHz={1.2} showCombos={mode === "rule" || revealed} />
          {status}
          <Explain testId="sl-explain">{explain}</Explain>
        </div>
        <aside className="nm-split-side nm-panel" aria-label="Notes">
          {mode === "molecule" && (
            <div className="nm-spec-left" style={{ minHeight: 230 }}>
              <MoleculeViewer molecule={mol} ctx={ctxMol} onAtomClick={onAtomClick} onBackgroundClick={() => { setFocusAtom(null); clear(); }} reducedMotion={studio?.reducedMotion} testId="mol-stage-mini" ariaLabel={`3D model of ${mol.name}: the selected hydrogens and their coupled neighbours`} />
            </div>
          )}
          {mode === "molecule" && molEnv && (
            <div className="nm-predict" data-testid="mol-predict">
              <h4 className="nm-h">{molEnv.label}: {molEnv.count} H · neighbours: {sigFull?.neighbours.length ? sigFull.neighbours.map((x) => `${x.count} on ${mol.environments.find((e) => e.id === x.envId).label}`).join(" + ") : "none that couple"}</h4>
              {!revealed ? (
                <>
                  <p className="nm-note-s">Predict the multiplicity, then check.</p>
                  <div className="nm-row" role="group" aria-label="Multiplicity">{MULTS.map((m) => <button key={m} type="button" className="sim-btn nm-textbtn" aria-pressed={predict.choice === m} onClick={() => setPredict({ choice: m, checked: false })} data-testid={`pred-${m}`}>{m}</button>)}</div>
                  <div className="nm-row">
                    <button type="button" className="sim-btn sim-btn--primary nm-textbtn" disabled={!predict.choice} onClick={() => { setPredict({ ...predict, checked: true }); setKMol(nSp); setReplay((r) => r + 1); }} data-testid="pred-check">Check and animate</button>
                    {teacher && <button type="button" className="sim-btn nm-textbtn" onClick={() => { setPredict({ choice: q.answer, checked: true }); setKMol(nSp); setReplay((r) => r + 1); }} data-testid="pred-skip">Show directly</button>}
                  </div>
                </>
              ) : (
                <>
                  <Feedback result={pres} testId="pred-feedback" />
                  <div className="nm-row"><button type="button" className="sim-btn nm-textbtn" onClick={() => { setPredict({ choice: null, checked: false }); setKMol(0); }} data-testid="pred-retry">Try again</button></div>
                </>
              )}
            </div>
          )}
          {(mode === "rule" || (molEnv && revealed)) && (
            <div className="nm-bars">
              <h4 className="nm-h">Relative line intensities {pr.join(" : ")}</h4>
              <PascalBars n={nSp} />
              <p className="nm-note-s">Pascal's triangle: {nSp} neighbours → {nSp + 1} lines. Lines in a multiplet are <b>not</b> separate environments: the whole multiplet is one signal with a single integral.</p>
              {mode === "molecule" && molEnv?.exchangeable && <p className="nm-note-s" data-testid="exchange-note">{teacher ? molEnv.exchangeNote : "Exchangeable O–H: usually a singlet; exchange averages out its coupling."}</p>}
              {mode === "molecule" && mol.firstOrderCaveat?.envId === molEnv?.id && <p className="nm-note-s" data-testid="first-order-caveat">{mol.firstOrderCaveat.text}</p>}
              {mode === "molecule" && sigFull && <p className="nm-note-s">Integral of the whole multiplet = {integrateSignal(sigFull).toFixed(2)} ≈ {molEnv.count} H (unchanged by splitting).</p>}
            </div>
          )}
          <div className="nm-bars" data-testid="hz-ppm">
            <h4 className="nm-h">J in hertz, not ppm</h4>
            <p className="nm-note-s">J = {mode === "rule" ? J : spins[0]?.J ?? "—"} Hz is {mode === "rule" || spins[0] ? jInPpm(mode === "rule" ? J : spins[0].J, freq).toFixed(4) : "—"} ppm at {fmtMHz(freq)} MHz and {mode === "rule" || spins[0] ? jInPpm(mode === "rule" ? J : spins[0].J, 2 * freq).toFixed(4) : "—"} ppm at {2 * freq} MHz. Change the spectrometer and the Hz axis does not move while the ppm labels do: the chemical shift (ppm) is field-independent, the coupling (Hz) is too, but their ppm expression is not.</p>
            {dnu !== null && <p className="nm-note-s" data-testid="dnu-j">Shift difference to the coupled group: Δν = {dnu.toFixed(0)} Hz at {fmtMHz(freq)} MHz, Δν/J ≈ {(dnu / (spins[0]?.J || 1)).toFixed(0)}. First-order patterns are a good approximation when Δν is much larger than J (rule of thumb: many times larger).</p>}
          </div>
          <div className="nm-row"><Toggle label="Triplet vs three environments" pressed={showContrast} onChange={setShowContrast} testId="toggle-contrast" /></div>
          {showContrast && <Contrast J={mode === "rule" ? J : spins[0]?.J ?? 7} freq={freq} />}
          {teacher && (
            <details className="nm-teachnote" open data-testid="teacher-limits">
              <summary><b>Teacher notes — where the simple picture stops</b></summary>
              <ul>
                <li><b>Exchangeable O–H.</b> Fast exchange averages out coupling: usually a broad singlet that does not split (or get split by) neighbours. Dry/pure samples or DMSO can show it; do not over-generalise.</li>
                <li><b>Overlapping signals.</b> If two environments have similar δ their multiplets overlap and cannot be read independently.</li>
                <li><b>Non-first-order behaviour.</b> When Δν is not much larger than J the intensities lean toward each other and extra lines appear; a higher-field instrument (bigger Δν in Hz, same J) simplifies it.</li>
                <li><b>Several non-equivalent neighbour sets.</b> n + 1 only holds for equivalent neighbours (or similar J): propan-1-ol's middle CH₂ is an apparent sextet; with different J it is a more complex multiplet.</li>
                <li><b>Convention.</b> The ↑/↓ labels under the lines show the neighbours' spin states; which side is which depends on the sign convention, only the spacing J and the Pascal intensities matter.</li>
                <li>{mol.teacherNote}</li>
              </ul>
            </details>
          )}
        </aside>
      </div>
    </section>
  );
}
