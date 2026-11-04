import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Scissors, Sigma, Sparkles } from "lucide-react";
import StepFrame from "../../components/StepFrame.jsx";
import { Readouts } from "../../components/ui.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useReducedMotion, useStudio, useStudioActions } from "../../state/StudioContext.jsx";
import { FIRST_MOLECULE_ID } from "../../state/studioState.js";
import { SUBSTAGES, subIndex } from "../../state/stepMachine.js";
import { larmorMHz } from "../physics/constants.js";
import { getMolecule } from "../molecular/model/molecules.js";
import { buildSignals, pascalText, simplestRatio } from "../molecular/model/spectrum.js";
import { selectAtom } from "../molecular/model/linking.js";
import { equivalenceReason } from "../molecular/model/topology.js";
import { checkSplitting, splittingQuestion } from "../molecular/model/challenges.js";
import MoleculePicker from "../molecular/components/MoleculePicker.jsx";
import MoleculeViewer from "../molecular/components/MoleculeViewer.jsx";
import SpectrumPlot from "../molecular/components/SpectrumPlot.jsx";
import ShieldingDiagram from "../molecular/components/ShieldingDiagram.jsx";
import { EnvChip } from "../molecular/components/EnvBits.jsx";
import { useLinkedSelection } from "../molecular/components/useSelection.js";
import SpinStatesCard from "./SpinStatesCard.jsx";
import "../molecular/components/molecular.css";

const EMPTY = [];
const SUB_ICON = { environments: Sparkles, shift: ArrowRight, integration: Sigma, coupling: Scissors };

/** Step 6: one molecule, one spectrum, four inline sub-stages (environments, chemical shift, integration, coupling). */
export default function Step6Molecules() {
  const a = useStudioActions();
  const reduced = useReducedMotion();
  const moleculeId = useStudio((s) => s.moleculeId);
  const selectedEnvId = useStudio((s) => s.selectedEnvId);
  const selectedMultipletId = useStudio((s) => s.selectedMultipletId);
  const sub = useStudio((s) => s.sub);
  const mode = useStudio((s) => s.mode);
  const speed = useStudio((s) => s.speed);
  const b0 = useStudio((s) => s.b0Tesla);
  const state = useStudio((s) => s.mol);
  const molecule = useMemo(() => getMolecule(moleculeId ?? FIRST_MOLECULE_ID), [moleculeId]);
  const freq = larmorMHz(b0);
  const teacher = mode === "teacher";
  const si = subIndex(sub);

  useEffect(() => { if (!moleculeId) a.setMolecule(FIRST_MOLECULE_ID); }, [moleculeId, a]);

  // ---- selection (molecule <-> spectrum), identified environments ----
  const studioLike = useMemo(() => ({ selectedEnvId, selectedMultipletId, setSelectedEnvId: a.setSelectedEnv, setSelectedMultipletId: a.setSelectedMultiplet }), [selectedEnvId, selectedMultipletId, a]);
  const { selectedEnvId: selId, select, toggle, clear } = useLinkedSelection(studioLike, molecule);
  const ids = state.identified[molecule.id] ?? EMPTY;
  const allIds = useMemo(() => molecule.environments.map((e) => e.id), [molecule]);
  const identify = useCallback((envId) => {
    const cur = a.getState().mol; const list = cur.identified[molecule.id] ?? EMPTY;
    if (envId && !list.includes(envId)) a.patch("mol", { identified: { ...cur.identified, [molecule.id]: [...list, envId] } });
  }, [a, molecule.id]);
  const identifyAll = useCallback(() => { const cur = a.getState().mol; a.patch("mol", { identified: { ...cur.identified, [molecule.id]: allIds } }); }, [a, molecule.id, allIds]);
  const allIdentified = ids.length === allIds.length;
  const [focusAtom, setFocusAtom] = useState(null);
  useEffect(() => { setFocusAtom(null); }, [molecule.id]);
  useEffect(() => { if (!selId) setFocusAtom(null); }, [selId]);

  // later sub-stages need the whole spectrum
  useEffect(() => { if ((sub === "integration" || sub === "coupling") && !allIdentified) identifyAll(); }, [sub, allIdentified, identifyAll]);

  // "Build the spectrum": add the remaining environments one after the other
  const timers = useRef([]);
  const stopBuild = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  useEffect(() => stopBuild, [stopBuild, molecule.id]);
  const build = () => {
    stopBuild(); a.setPaused(false);
    const pending = allIds.filter((id) => !ids.includes(id));
    if (!pending.length) return;
    if (reduced) { identifyAll(); return; }
    pending.forEach((id, i) => timers.current.push(setTimeout(() => identify(id), ((i + 1) * 650) / speed)));
  };

  // ---- coupling animation ----
  const coupledOn = state.coupled && sub === "coupling";
  const tRaw = useTransition({ id: `couple-${molecule.id}`, target: coupledOn ? 1 : 0, seconds: 2.6 });
  const t = Math.round(tRaw * 120) / 120;
  const [focusTick, setFocusTick] = useState(0);
  const [resetTick, setResetTick] = useState(0);
  const fullSignals = useMemo(() => buildSignals(molecule, { freqMHz: freq, coupling: true, progress: 1 }), [molecule, freq]);
  const shown = sub === "environments" || sub === "shift" ? ids : allIds;
  const signals = useMemo(() => buildSignals(molecule, { freqMHz: freq, coupling: true, progress: t, envIds: shown }), [molecule, freq, t, shown.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const selFull = fullSignals.find((s) => s.envId === selId) ?? null;
  const env = molecule.environments.find((e) => e.id === selId) ?? null;
  const coupledEnvIds = useMemo(() => (coupledOn && selFull ? selFull.neighbours.map((n) => n.envId) : EMPTY), [coupledOn, selFull]);
  const ctx = useMemo(() => ({ selectedEnvId: selId, identified: new Set(shown), coupledEnvIds, style: "ball", focusAtom }), [selId, shown.join("|"), coupledEnvIds, focusAtom]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickEnv = (envId) => { select(envId); identify(envId); setFocusAtom(null); if (sub === "coupling") setFocusTick((n) => n + 1); };
  const onAtomClick = (idx) => { const s = selectAtom(molecule, idx); setFocusAtom(idx); if (s.selectedEnvId) pickEnv(s.selectedEnvId); else clear(); };
  const onSpectrumSelect = (envId, part) => { if (part === "peak" || !part) toggle(envId); else select(envId); };

  const applyCoupling = () => {
    a.setPaused(false);
    let target = selId;
    if (!target) {
      const best = [...fullSignals].filter((s) => !s.exchangeable).sort((x, y) => y.multiplicity.nNeighbours - x.multiplicity.nNeighbours)[0] ?? fullSignals[0];
      target = best.envId; select(target);
    }
    a.patch("mol", { coupled: true }); setFocusTick((n) => n + 1);
  };
  const removeCoupling = () => { a.patch("mol", { coupled: false }); setResetTick((n) => n + 1); };
  const continueSub = () => a.nav({ type: "subNext" });
  const counts = molecule.environments.map((e) => e.count);
  const ratio = simplestRatio(counts);

  // Student mode: predict the multiplicity of the selected signal before the coupling is applied
  const [guess, setGuess] = useState({ envId: null, choice: null });
  const q = useMemo(() => (env && !env.exchangeable ? splittingQuestion(molecule.id, env.id) : null), [molecule.id, env]);
  useEffect(() => { setGuess({ envId: null, choice: null }); }, [selId, molecule.id]);
  const verdict = q && guess.choice ? checkSplitting(q, guess.choice) : null;

  const mult = selFull?.multiplicity;
  const doneCoupling = coupledOn && t >= 0.99;

  // ---- viz ----
  const viz = (
    <div className="ss-mol-split" data-testid="molecule-view" data-molecule={molecule.id} data-sub={sub}>
      <div className="ss-molbox" data-testid="mol-box">
        <MoleculeViewer molecule={molecule} ctx={ctx} onAtomClick={onAtomClick} onBackgroundClick={() => { setFocusAtom(null); clear(); }} reducedMotion={reduced} testId="mol-stage" ariaLabel={`3D model of ${molecule.name}. Click a hydrogen to highlight its equivalent hydrogens and its resonance.`} />
      </div>
      <div className="ss-specbox" data-testid="spec-box" data-integrated={state.integrated && (sub === "integration" || sub === "coupling") ? "1" : "0"} data-coupling-progress={t.toFixed(2)}>
        <SpectrumPlot
          molecule={molecule} signals={signals} freqMHz={freq} selectedEnvId={selId} coupledEnvIds={coupledEnvIds} showIntegration={state.integrated && (sub === "integration" || sub === "coupling")}
          showSplitting={t > 0.98 && coupledOn} showAssignments labelMult={doneCoupling} onSelectEnv={onSpectrumSelect} hideToolbar
          focusToken={focusTick} resetToken={resetTick} reducedMotion={reduced} emptyMessage="Click a hydrogen in the molecule to reveal its resonance." testId="spectrum"
        />
      </div>
    </div>
  );

  // ---- strip: sub-stage navigation + the principal action ----
  const action = sub === "environments" ? (
    <button type="button" className="sim-btn ss-bigbtn" onClick={() => { identifyAll(); }} disabled={allIdentified} data-testid="reveal-all"><Sparkles size={18} aria-hidden="true" /> Show all environments</button>
  ) : sub === "shift" ? (
    <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={build} disabled={allIdentified} data-testid="build-spectrum"><Sparkles size={18} aria-hidden="true" /> Build the spectrum</button>
  ) : sub === "integration" ? (
    <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={() => a.patch("mol", { integrated: !state.integrated })} aria-pressed={state.integrated} data-testid="show-integration"><Sigma size={18} aria-hidden="true" /> {state.integrated ? "Hide integration" : "Show integration"}</button>
  ) : !state.coupled ? (
    <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={applyCoupling} data-testid="apply-coupling"><Scissors size={18} aria-hidden="true" /> Apply Coupling</button>
  ) : (
    <button type="button" className="sim-btn ss-bigbtn" onClick={removeCoupling} data-testid="remove-coupling"><Scissors size={18} aria-hidden="true" /> Remove coupling</button>
  );
  const strip = (
    <div className="ss-controlrow ss-controlrow--sub">
      <ol className="ss-subnav" aria-label="Interpretation stages" data-testid="sub-nav">
        {SUBSTAGES.map((s, i) => {
          const Icon = SUB_ICON[s.id];
          return (
            <li key={s.id}>
              <button type="button" className="sim-btn ss-subbtn" aria-current={s.id === sub ? "step" : undefined} onClick={() => a.setSub(s.id)} data-testid={`sub-${s.id}`} title={s.label}>
                <span className="ss-subn" aria-hidden="true">{String.fromCharCode(97 + i)}</span><Icon size={14} aria-hidden="true" /><span className="ss-subl">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="ss-actions">
        {action}
        {si < SUBSTAGES.length - 1 && <button type="button" className="sim-btn ss-bigbtn" onClick={continueSub} data-testid="sub-next">Continue <ArrowRight size={16} aria-hidden="true" /></button>}
      </div>
    </div>
  );

  // ---- panel text ----
  const nId = ids.length; const total = allIds.length;
  const body = (() => {
    if (sub === "environments") {
      return (
        <>
          <p data-testid="what-is-happening" aria-live="polite">
            {env ? <><b>Environment {env.letter}: {env.label}</b>, {env.count} equivalent hydrogen{env.count > 1 ? "s" : ""}. {equivalenceReason(molecule, env.id)} Its resonance is now in the spectrum.</>
              : nId === 0 ? <>Click any <b>hydrogen</b> atom in the molecule. Every hydrogen in the <b>same chemical environment</b> lights up, and one resonance appears in the spectrum for each environment.</>
                : <>{nId} of {total} environment{total > 1 ? "s" : ""} identified. Click another hydrogen.</>}
          </p>
          <div className="nm-env-row" role="group" aria-label="Hydrogen environments">
            {molecule.environments.map((e) => <EnvChip key={e.id} env={e} selected={e.id === selId} identified={ids.includes(e.id)} onClick={() => pickEnv(e.id)} />)}
          </div>
        </>
      );
    }
    if (sub === "shift") {
      return (
        <>
          <p data-testid="what-is-happening" aria-live="polite">
            Each environment resonates at its own <b>chemical shift δ</b> (in ppm, relative to TMS). Electrons around a nucleus <b>shield</b> it from B₀: less electron density means less shielding, a higher δ and a position further <b>left</b>.
            {allIdentified ? "" : " Press Build the spectrum to add the remaining environments."}
          </p>
          <div className="nm-env-row" role="group" aria-label="Hydrogen environments">
            {molecule.environments.map((e) => <EnvChip key={e.id} env={e} selected={e.id === selId} identified={ids.includes(e.id)} showShift onClick={() => pickEnv(e.id)} />)}
          </div>
          <ShieldingDiagram env={env && ids.includes(env.id) ? env : null} freqMHz={freq} b0Tesla={b0} />
        </>
      );
    }
    if (sub === "integration") {
      return (
        <>
          <p data-testid="what-is-happening" aria-live="polite">
            The <b>area</b> under each signal is proportional to the number of equivalent hydrogens that produce it. The integration trace climbs by that amount across each signal.
            {state.integrated ? <> For {molecule.name} the areas are in the ratio <b data-testid="area-ratio">{ratio.join(" : ")}</b>, which is the ratio of hydrogens in each environment.</> : " Press Show integration."}
          </p>
          <Readouts items={molecule.environments.map((e) => ({ id: `int-${e.id}`, label: `${e.letter} · ${e.label}`, value: state.integrated ? `${e.count} H` : "?", tone: "mag" }))} ariaLabel="Hydrogens per signal" />
        </>
      );
    }
    return (
      <>
        <p data-testid="what-is-happening" aria-live="polite">
          {!state.coupled ? <>Neighbouring hydrogens split a signal into a <b>multiplet</b>. Select a signal, then press <b>Apply Coupling</b> to see its neighbours and the splitting.</>
            : env && mult ? (env.exchangeable
              ? <><b>{env.label}</b>: an O–H hydrogen exchanges rapidly, so it stays a singlet and does not split its neighbours.</>
              : mult.nNeighbours === 0 ? <><b>{env.label}</b> has no neighbouring hydrogens on adjacent atoms: it stays a <b>singlet</b>.</>
                : <><b>{env.label}</b> has {mult.nNeighbours} neighbouring H ({coupledEnvIds.map((id) => molecule.environments.find((x) => x.id === id)?.label).join(", ")}), so n + 1 = {mult.nNeighbours + 1} lines: a <b data-testid="multiplicity-name">{mult.name}</b> with intensities <b>{pascalText(mult.nNeighbours)}</b> (Pascal's triangle). The lines are J = {selFull.spins[0]?.J} Hz apart, and the <b>total area is unchanged</b>.</>)
              : <>Select a signal (click it, or a hydrogen) to see which neighbours split it.</>}
        </p>
        {!teacher && !state.coupled && q && (
          <fieldset className="ss-predict" data-testid="predict-split">
            <legend>Predict: what will {env.label} look like?</legend>
            <div className="ss-chips" role="radiogroup" aria-label="Multiplicity">
              {q.options.map((o) => <button key={o} type="button" role="radio" aria-checked={guess.choice === o} className="sim-btn ss-chipbtn" onClick={() => setGuess({ envId: env.id, choice: o })} data-testid={`guess-${o}`}>{o}</button>)}
            </div>
            {verdict && <p className={`ss-fb ${verdict.correct ? "is-ok" : "is-no"}`} role="status" data-testid="guess-feedback"><b>{verdict.message}</b> {verdict.explanation}</p>}
          </fieldset>
        )}
        {state.coupled && (
          <p className="ss-note" data-testid="first-order-note">First-order assumptions: the signals are far apart compared with J, equivalent neighbours share one J, and each neighbouring set splits by n + 1. O–H splitting is not seen because of rapid exchange.</p>
        )}
        <div className="ss-btnrow">
          <button type="button" className="sim-btn ss-chipbtn" aria-pressed={state.spinStates} onClick={() => a.patch("mol", { spinStates: !state.spinStates })} data-testid="spin-states-toggle">Why? Neighbouring spin states</button>
          {state.coupled && <button type="button" className="sim-btn ss-chipbtn" onClick={() => setFocusTick((n) => n + 1)} disabled={!selId} data-testid="zoom-signal">Zoom to this signal</button>}
          {state.coupled && <button type="button" className="sim-btn ss-chipbtn" onClick={() => setResetTick((n) => n + 1)} data-testid="show-whole">Whole spectrum</button>}
        </div>
        {state.spinStates && <SpinStatesCard molecule={molecule} envId={selId} />}
      </>
    );
  })();

  const teacherText = (
    <>
      <p>{molecule.teacherNote}</p>
      {sub === "shift" && <p>Shielded means more electron density, a bigger induced field opposing B₀, a smaller effective field B₀(1 − σ), a lower frequency and so a lower δ (upfield). δ = (ν − ν<sub>ref</sub>)/ν<sub>ref</sub> × 10⁶ is the same number at any spectrometer frequency; the offset in Hz is not.</p>}
      {sub === "integration" && <p>Compare areas, not heights: a multiplet's area is shared among its lines, so a quartet is much lower than a singlet of the same area.</p>}
      {sub === "coupling" && <p>Splitting does not change the area. The separation of the lines (J, in Hz) is independent of B₀. Real multiplets are only first order when Δν ≫ J, and unequal neighbours (different J) give more complicated patterns; this model assumes one J for equivalent neighbours.</p>}
      <p className="ss-note">{molecule.name} spectrum: representative, idealised values, not an experimental spectrum.</p>
    </>
  );
  return (
    <StepFrame step={6} viz={viz} strip={strip} teacher={teacherText} vizClass="ss-viz--mol">
      <div className="ss-pickwrap ss-pickwrap--top"><MoleculePicker value={molecule.id} onChange={(id) => { a.setMolecule(id); if (id !== molecule.id) a.setSub("environments"); }} compact testId="molecule-picker" /></div>
      <p className="ss-subtitle" data-testid="sub-title">Stage {String.fromCharCode(97 + si)}: <b>{SUBSTAGES[si].label}</b> · {molecule.name} ({molecule.formula}) at {freq.toFixed(1)} MHz</p>
      {body}
    </StepFrame>
  );
}
