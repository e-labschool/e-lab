// Explore mode: any mixture x any method. A set-up step (assemble the apparatus in the right order), live run controls, a
// particle-level view, a live thermometer / graph and an honest results panel. All chemistry comes from ../model.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FastForward, Pause, Play, RotateCcw, Wrench } from "lucide-react";
import { ChamberToolbar, DashPanel, PredictPopover, SliderRow, ToolButton } from "../../../components/simulation/SimulationDashboard.jsx";
import { createFrameClock } from "../../../lib/frameTime.js";
import { SUBSTANCES } from "../model/chem.js";
import { MIXTURES, fmtG, getMixture, sampleOf } from "../model/mixtures.js";
import { GROUP_LABEL, METHODS, checkSetupChoice, getMethod } from "../model/methods.js";
import { autoControls, createRun, runToEnd } from "../model/runs.js";
import { makeParticleView, particleCaption, particleCtl } from "../model/particleSpec.js";
import { controlDefaults, liveItems, narrate, shuffledOptions } from "../model/narration.js";
import { SCENES } from "./scenes/scenes.jsx";
import ParticleCanvas, { Legend } from "./ParticleCanvas.jsx";
import Graph from "./Graph.jsx";
import Results from "./Results.jsx";
import { Rich } from "./Rich.jsx";

const SPEEDS = [1, 2, 4, 8];
export const DEFAULT_MIXTURE = "muddy-water";
export const DEFAULT_METHOD = "filtration";
const METHOD_GROUPS = ["prep", "solid-liquid", "heating", "analysis", "solid-solid", "liquid-liquid"];
const PLATE_CHOICES = [{ id: 2, label: "Short column (2 plates)" }, { id: 6, label: "Standard column (6 plates)" }, { id: 12, label: "Long column (12 plates)" }];

const methodLabel = (id) => getMethod(id).label;

function Segmented({ options, value, onChange, label, testId }) {
  return (
    <div role="radiogroup" aria-label={label} className="ms-seg" data-testid={testId}>
      {options.map((o, i) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} tabIndex={value === o.id ? 0 : -1} className="ms-seg-btn" data-testid={`${testId}-${o.id}`}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => { const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0; if (d) { e.preventDefault(); onChange(options[(i + d + options.length) % options.length].id); } }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function useExploreTab({ reduced, request }) {
  const [mixtureId, setMixtureId] = useState(DEFAULT_MIXTURE);
  const [methodId, setMethodId] = useState(DEFAULT_METHOD);
  const [solvent, setSolvent] = useState("water");
  const [plates, setPlates] = useState(6);
  const [stage, setStage] = useState("setup"); // setup | run | done
  const [placed, setPlaced] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [ctl, setCtlState] = useState(() => controlDefaults(DEFAULT_METHOD));
  const [showParticles, setShowParticles] = useState(false);
  const [result, setResult] = useState(null);
  const [epoch, setEpoch] = useState(0);
  const [, setFrame] = useState(0);
  const [autoStart, setAutoStart] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const runRef = useRef(null);
  const ctlRef = useRef(ctl);
  const speedRef = useRef(speed);
  const playingRef = useRef(playing);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const mixture = getMixture(mixtureId);
  const method = getMethod(methodId);
  const sample = useMemo(() => sampleOf(mixture), [mixture]);
  const nSteps = method.setup.length;
  const setupDone = placed >= nSteps;

  // A run object always exists: before "Start" it is a preview (initial state), so the scene can draw spots, levels, etc.
  const preview = useMemo(() => createRun(methodId, sample, { solvent, plates }), [methodId, sample, solvent, plates, epoch]);
  const run = runRef.current ?? preview;
  const view = run.view ?? {};
  const bump = useCallback(() => setFrame((f) => (f + 1) % 1e9), []);

  const setCtl = useCallback((patch) => { ctlRef.current = { ...ctlRef.current, ...patch }; setCtlState(ctlRef.current); }, []);

  const resetToSetup = useCallback((keepPlaced = false, m = methodId) => {
    runRef.current = null; setStage("setup"); setResult(null); setFeedback(null); setPlaying(true); setRevealed(false);
    if (!keepPlaced) setPlaced(0);
    ctlRef.current = controlDefaults(m); setCtlState(ctlRef.current); setEpoch((e) => e + 1);
  }, [methodId]);

  const chooseMixture = (id) => { setMixtureId(id); resetToSetup(); };
  const chooseMethod = (id) => { setMethodId(id); resetToSetup(false, id); };
  const chooseSolvent = (id) => { setSolvent(id); resetToSetup(true); };
  const choosePlates = (n) => { setPlates(n); resetToSetup(true); };

  const finish = useCallback(() => {
    const r = runRef.current; if (!r) return;
    setResult(r.result()); setStage("done"); setPlaying(false); bump();
  }, [bump]);

  const begin = useCallback(() => {
    const r = createRun(methodId, sample, { solvent, plates });
    runRef.current = r; ctlRef.current = { ...controlDefaults(methodId), ...(r.controls ?? {}) }; setCtlState(ctlRef.current);
    setResult(null); setEpoch((e) => e + 1); setStage("run"); setPlaying(true); setFeedback(null);
  }, [methodId, sample, solvent, plates]);

  // ---- Quiz -> "Watch it run": load that mixture + method, assemble and start
  useEffect(() => {
    if (!request) return;
    setMixtureId(request.mixtureId); setMethodId(request.methodId);
    runRef.current = null; setResult(null); setStage("setup"); setFeedback(null); setRevealed(false);
    setPlaced(getMethod(request.methodId).setup.length);
    ctlRef.current = controlDefaults(request.methodId); setCtlState(ctlRef.current);
    setAutoStart(true);
  }, [request]);
  useEffect(() => { if (autoStart) { setAutoStart(false); begin(); } }, [autoStart, begin]);

  // ---- The animation loop: the run model is the only writer of what the scene shows
  useEffect(() => {
    if (stage !== "run" || !playing) return undefined;
    const clock = createFrameClock(); let raf = 0; let n = 0;
    const tick = (now) => {
      const r = runRef.current;
      const dt = clock.tick(now);
      if (r && dt > 0 && !r.done) {
        let rem = dt * speedRef.current;
        while (rem > 1e-9 && !r.done) { const h = Math.min(0.1, rem); r.step(h, ctlRef.current); rem -= h; }
        if (r.done) { finish(); return; }
        n += 1; if (n % 2 === 0) bump();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, playing, finish, bump]);

  const skipToEnd = () => {
    let r = runRef.current;
    if (!r) { begin(); return; }
    const c = { ...ctlRef.current }; let g = 0;
    while (!r.done && g++ < 8000) { autoControls(methodId, r, c, sample); r.step(0.25, c); }
    finish();
  };

  const act = (fn) => { const r = runRef.current; if (!r || r.done) return; fn(r); if (r.done) finish(); else bump(); };

  // ---- Set-up
  const options = useMemo(() => (setupDone ? [] : shuffledOptions(methodId, placed)), [methodId, placed, setupDone]);
  const choose = (opt) => {
    const res = checkSetupChoice(methodId, placed, opt.id);
    if (res.ok) { setPlaced((p) => p + 1); setFeedback({ ok: true, text: res.why }); } else setFeedback({ ok: false, text: res.why });
  };
  const assembleAll = () => { setPlaced(nSteps); setFeedback({ ok: true, text: "Apparatus assembled for you. Check each part in the picture, then press Start." }); };

  // ---- Particle view
  const pv = useMemo(() => makeParticleView(methodId, sample, solvent, 7), [methodId, sample, solvent, epoch]);
  const getCtl = useCallback(() => particleCtl(methodId, runRef.current ?? undefined), [methodId]);

  // ---- Predict
  const predicted = useMemo(() => (revealed ? runToEnd(methodId, sample, { solvent, plates }).result : null), [revealed, methodId, sample, solvent, plates]);

  const Scene = SCENES[methodId];
  const sceneStage = stage;
    const lcFirst = (t) => t[0].toLowerCase() + t.slice(1);
  const eachG = mixture.parts.map((p) => `${fmtG(p.g)} ${lcFirst(SUBSTANCES[p.sub].name)}${p.form === "dissolved" ? " (dissolved)" : ""}`);

  // ------------------------------------------------------------------------------------------ controls column
  const controls = (
    <div className="ms-left" data-testid="ms-left">
      <DashPanel title="1. Choose" fixed className="ms-panel" testId="ms-choose">
        <label className="ms-label" htmlFor="ms-mixture">Mixture</label>
        <select id="ms-mixture" className="ms-select" value={mixtureId} onChange={(e) => chooseMixture(e.target.value)} data-testid="ms-mixture">
          {MIXTURES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <p className="ms-mixinfo" data-testid="ms-mixinfo"><b>{mixture.kind.split(":")[0]}.</b> {eachG.join(" + ")}.</p>
        <label className="ms-label" htmlFor="ms-method">Method</label>
        <select id="ms-method" className="ms-select" value={methodId} onChange={(e) => chooseMethod(e.target.value)} data-testid="ms-method">
          {METHOD_GROUPS.map((g) => <optgroup key={g} label={GROUP_LABEL[g]}>{METHODS.filter((m) => m.group === g).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</optgroup>)}
        </select>
        {methodId === "chromatography" && (
          <div className="ms-field"><span className="ms-label" id="ms-solv-l">Solvent</span>
            <Segmented label="Solvent" testId="ms-solvent" value={solvent} onChange={chooseSolvent} options={[{ id: "water", label: "Water" }, { id: "ethanol", label: "Ethanol" }]} />
          </div>
        )}
        {methodId === "fractional-distillation" && (
          <div className="ms-field"><label className="ms-label" htmlFor="ms-plates">Fractionating column</label>
            <select id="ms-plates" className="ms-select" value={plates} onChange={(e) => choosePlates(Number(e.target.value))} data-testid="ms-plates">{PLATE_CHOICES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          </div>
        )}
        <p className="ms-principle"><Rich text={method.principle} /></p>
      </DashPanel>

      {stage === "setup" && (
        <DashPanel title={setupDone ? "2. Apparatus ready" : `2. Set-up: step ${placed + 1} of ${nSteps}`} fixed className="ms-panel" testId="ms-setup">
          <ol className="ms-steps" aria-label="Set-up progress">
            {method.setup.map((s, i) => <li key={s.id} data-state={i < placed ? "done" : i === placed ? "now" : "todo"} aria-current={i === placed && !setupDone ? "step" : undefined}><span>{i < placed ? "✓" : i + 1}</span><span className="ms-sr">{i < placed ? "done" : i === placed ? "current" : "to do"}</span></li>)}
          </ol>
          {!setupDone ? (
            <>
              <p className="ms-prompt" id="ms-prompt" data-testid="ms-prompt">{method.setup[placed].prompt}</p>
              <div role="group" aria-labelledby="ms-prompt" className="ms-opts">
                {options.map((o) => <button key={o.id} type="button" className="ms-opt" onClick={() => choose(o)} data-testid={`ms-opt-${o.id}`} data-correct={o.id === method.setup[placed].correct ? "yes" : "no"}>{o.label}</button>)}
              </div>
            </>
          ) : <p className="ms-prompt">Every part is in place.</p>}
          {feedback && <p className={`ms-msg ms-msg--${feedback.ok ? "ok" : "bad"}`} role="status" data-testid="ms-feedback">{feedback.ok ? "Right. " : "Not quite. "}{feedback.text}</p>}
          <div className="ms-row">
            {setupDone && <button type="button" className="sd-btn sd-btn--primary" onClick={begin} data-testid="ms-start"><Play size={14} aria-hidden="true" /> Start</button>}
            {!setupDone && <button type="button" className="sd-btn sd-btn--sm" onClick={assembleAll} data-testid="ms-assemble"><Wrench size={13} aria-hidden="true" /> Assemble for me</button>}
          </div>
        </DashPanel>
      )}

      {stage !== "setup" && (
        <DashPanel title={stage === "run" ? "2. Run controls" : "2. Finished"} fixed className="ms-panel" testId="ms-run">
          <RunControls methodId={methodId} stage={stage} ctl={ctl} setCtl={setCtl} run={run} view={view} act={act} sample={sample} />
          <div className="ms-row">
            {stage === "done" && <button type="button" className="sd-btn sd-btn--primary" onClick={begin} data-testid="ms-again"><RotateCcw size={14} aria-hidden="true" /> Run again</button>}
            <button type="button" className="sd-btn sd-btn--sm" onClick={() => resetToSetup(true)} data-testid="ms-back">Back to set-up</button>
          </div>
        </DashPanel>
      )}
    </div>
  );

  // ------------------------------------------------------------------------------------------ chamber
  const sceneLabel = `${method.label} of ${mixture.name.toLowerCase()}: ${stage === "setup" ? `${placed} of ${nSteps} parts in place` : stage === "run" ? "running" : "finished"}`;
  const chamber = (
    <div className="ms-chamber" data-testid="ms-chamber" data-stage={stage} data-reduced={reduced ? "true" : "false"}>
      <div className="ms-stage"><Scene placed={placed} stage={sceneStage} view={view} ctl={ctl} sample={sample} method={methodId} run={run} solvent={solvent} label={sceneLabel} /></div>
      <ChamberToolbar>
        {stage === "setup" && <ToolButton primary icon={<Play size={15} aria-hidden="true" />} label="Start" title={setupDone ? "Start the experiment" : "Finish the set-up first (or press Assemble for me)"} disabled={!setupDone} onClick={begin} testId="ms-start-tool" />}
        {stage === "run" && <ToolButton primary icon={playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)} testId="ms-play" />}
        {stage === "run" && <ToolButton icon={<FastForward size={15} aria-hidden="true" />} label="Skip to end" title="Run to the end using careful settings" onClick={skipToEnd} testId="ms-skip" />}
        {stage === "done" && <ToolButton primary icon={<RotateCcw size={15} aria-hidden="true" />} label="Run again" onClick={begin} testId="ms-again-tool" />}
        <ToolButton icon={<span className="ms-speed" aria-hidden="true">{speed}×</span>} label="Speed" title={`Animation speed ${speed}×. Press to change.`} ariaLabel={`Animation speed ${speed} times. Press to change.`} onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} testId="ms-speed" disabled={stage !== "run"} />
        <ToolButton icon={<Eye size={15} aria-hidden="true" />} label="Particles" title="Show what the particles are doing" pressed={showParticles} onClick={() => setShowParticles((v) => !v)} testId="ms-particles-toggle" />
      </ChamberToolbar>
    </div>
  );

  // ------------------------------------------------------------------------------------------ right column
  const bps = useMemo(() => {
    if (!/distillation/.test(methodId)) return [];
    const colours = ["#0f766e", "#7c3aed", "#b45309", "#be123c"];
    return [...new Set(sample.parts.filter((p) => p.form === "liquid" && !SUBSTANCES[p.sub].nonvolatile).map((p) => p.sub))].map((sub, i) => ({ label: SUBSTANCES[sub].name.split(" ")[0], T: SUBSTANCES[sub].bp, colour: colours[i % colours.length] }));
  }, [methodId, sample]);
  const hasGraph = ["evaporation", "crystallisation", "simple-distillation", "fractional-distillation", "sublimation"].includes(methodId);
  const graph = (
    <div className="ms-right" data-testid="ms-right">
      {stage === "done" && result && <Results result={result} methodId={methodId} runView={run.view} />}
      {showParticles && (
        <section className="ms-card" aria-label="Particle view" data-testid="ms-particles">
          <h3 className="ms-h3">Particle view</h3>
          <ParticleCanvas view={pv} getCtl={getCtl} paused={stage === "run" ? !playing : false} reduced={reduced} label={`Particle-level picture of ${method.label.toLowerCase()}`} />
          <Legend view={pv} />
          <p className="ms-caption"><Rich text={particleCaption(methodId, run, sample)} /></p>
        </section>
      )}
      {hasGraph && (
        <section className="ms-card" aria-label="Temperature graph" data-testid="ms-graph-card">
          <h3 className="ms-h3">Temperature against time</h3>
          <Graph series={run.series ?? []} bps={bps} showHead={/distillation/.test(methodId)} tMaxHint={methodId === "sublimation" ? 140 : /distillation/.test(methodId) ? 110 : 110} caption={`Temperature of the ${/distillation/.test(methodId) ? "flask and the vapour" : "contents"} against time`} />
        </section>
      )}
      {stage !== "done" && (
        <section className="ms-card" aria-label="Why this method" data-testid="ms-about">
          <h3 className="ms-h3">{method.label}</h3>
          <p className="ms-caption"><Rich text={method.principle} /></p>
          <p className="ms-caption"><b>Think:</b> which <em>property</em> of the components could this method use? Compare your idea with the result.</p>
        </section>
      )}
    </div>
  );

  const explain = stage === "setup"
    ? (feedback ? `${feedback.ok ? "Right. " : "Not quite. "}${feedback.text}` : setupDone ? "Every part is in place. Press Start." : `Step ${placed + 1} of ${nSteps}: ${method.setup[placed].prompt}`)
    : stage === "done" && result ? result.headline : narrate(methodId, view, ctl, sample, stage);

  const live = { items: liveItems(methodId, stage, stage === "setup" ? null : run, sample, ctl) };
  const predict = (
    <PredictPopover
      question={`Before you run it: will ${method.label.toLowerCase()} separate ${mixture.name.toLowerCase()}? Which component should end up where, and which property decides?`}
      answer={predicted ? `${predicted.headline} ${predicted.lines[0] ?? ""}` : ""}
      revealed={revealed} onToggle={() => setRevealed((r) => !r)}
    />
  );

  const reset = () => {
    setMixtureId(DEFAULT_MIXTURE); setMethodId(DEFAULT_METHOD); setSolvent("water"); setPlates(6); setSpeed(1); setShowParticles(false);
    runRef.current = null; setStage("setup"); setResult(null); setFeedback(null); setPlaying(true); setPlaced(0); setRevealed(false);
    ctlRef.current = controlDefaults(DEFAULT_METHOD); setCtlState(ctlRef.current); setEpoch((e) => e + 1);
  };

  return { controls, chamber, graph, explain, live, predict, reset, state: { mixtureId, methodId, stage, placed, result } };
}

// ---------------------------------------------------------------------------------------------------- live run controls
function RunControls({ methodId, stage, ctl, setCtl, run, view, act, sample }) {
  const run_ = stage === "run";
  const heat = (
    <SliderRow id="ms-heat" label="Burner flame" value={ctl.heat ?? 0} min={0} max={1} step={0.05} onChange={(v) => setCtl({ heat: v })} color="#c2410c" badgeText={`${Math.round((ctl.heat ?? 0) * 100)} %`} valueText={`${Math.round((ctl.heat ?? 0) * 100)} percent`} minText="0" maxText="100 %" testId="heat"
      note={methodId === "sublimation" ? "0 to 100 %. Gentle (about 10 %) is enough: too hot and iodine melts." : /distillation/.test(methodId) ? "0 to 100 %. Too fierce makes the liquid boil over; too gentle never reaches the boiling point." : "0 to 100 %. A lower flame near the end stops spitting."} />
  );
  const stopBtn = <button type="button" className="sd-btn sd-btn--sm" onClick={() => act((r) => (r.stop ? r.stop() : r.finish?.()))} disabled={!run_} data-testid="ms-stop">{methodId === "crystallisation" ? "Stop heating and cool" : "Stop heating"}</button>;
  switch (methodId) {
    case "dissolve":
      return <label className="ms-check"><input type="checkbox" checked={ctl.stir !== false} disabled={!run_} onChange={(e) => setCtl({ stir: e.target.checked })} data-testid="ms-stir" /> Stir with the glass rod</label>;
    case "filtration":
      return <SliderRow id="ms-pour" label="Pouring speed" value={ctl.pour ?? 0.5} min={0} max={1} step={0.05} onChange={(v) => setCtl({ pour: v })} color="#0e7490" badgeText={`${Math.round((ctl.pour ?? 0.5) * 100)} %`} valueText={`${Math.round((ctl.pour ?? 0.5) * 100)} percent`} minText="stop" maxText="fast" testId="pour" note="0 to 100 %. Pour slowly: too fast and the paper overflows." />;
    case "decanting":
      return (
        <>
          <label className="ms-check"><input type="checkbox" checked={!!ctl.tilt} disabled={!run_} onChange={(e) => setCtl({ tilt: e.target.checked })} data-testid="ms-tilt" /> Tilt the beaker and pour</label>
          <SliderRow id="ms-pour" label="Pouring speed" value={ctl.pour ?? 0.3} min={0} max={1} step={0.05} onChange={(v) => setCtl({ pour: v })} color="#0e7490" badgeText={`${Math.round((ctl.pour ?? 0.3) * 100)} %`} valueText={`${Math.round((ctl.pour ?? 0.3) * 100)} percent`} minText="slow" maxText="fast" testId="pour" note="0 to 100 %. Slow pouring keeps the sediment from being carried over." />
        </>
      );
    case "evaporation": return <>{heat}{stopBtn}</>;
    case "crystallisation":
      return (
        <>
          {heat}
          <p className="ms-hint" data-testid="ms-rod-state">{view.rod ? "Crystals are forming on the glass rod: the solution is saturated." : view.phase === "cool" ? "Cooling." : "Dip a cold glass rod now and then: crystals on it mean it is time to stop."}</p>
          {stopBtn}
        </>
      );
    case "simple-distillation": case "fractional-distillation": {
      const bpsSorted = [...new Set(sample.parts.filter((p) => p.form === "liquid" && !SUBSTANCES[p.sub].nonvolatile).map((p) => SUBSTANCES[p.sub].bp))].length;
      return (
        <>
          {heat}
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => act((r) => r.changeReceiver())} disabled={!run_ || (run.currentReceiver?.() ?? 0) >= 3} data-testid="ms-receiver" title={`Swap the receiving flask (max 4). Flask ${(run.currentReceiver?.() ?? 0) + 1} is in place.`}>Change flask ({(run.currentReceiver?.() ?? 0) + 1} of 4)</button>
          {bpsSorted > 1 && <p className="ms-hint">Swap the flask when the head thermometer jumps to the next boiling point.</p>}
          {stopBtn}
        </>
      );
    }
    case "chromatography": return <p className="ms-hint">The solvent rises by capillary action: just watch, then measure from the baseline.</p>;
    case "magnetic":
      return (
        <>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => act((r) => r.sweep())} disabled={!run_ || view.sweeping} data-testid="ms-sweep">Sweep the magnet</button>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => act((r) => r.finish())} disabled={!run_} data-testid="ms-finish">Finish</button>
        </>
      );
    case "separating-funnel":
      return (
        <>
          <SliderRow id="ms-tap" label="Tap opening" value={ctl.tap ?? 0} min={0} max={1} step={0.05} onChange={(v) => setCtl({ tap: v })} color="#0e7490" badgeText={`${Math.round((ctl.tap ?? 0) * 100)} %`} valueText={`${Math.round((ctl.tap ?? 0) * 100)} percent open`} minText="shut" maxText="open" testId="tap" note="0 (shut) to 100 % (fully open). Slow down near the boundary." />
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => act((r) => r.finish())} disabled={!run_} data-testid="ms-finish">Finish</button>
        </>
      );
    case "sublimation": return <>{heat}{stopBtn}</>;
    default: return null;
  }
}

export { methodLabel };
