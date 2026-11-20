import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, BarChart3, BookOpen, Type } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationActions from "../../components/interactive-shell/SimulationActions.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { useSimulationSessionState } from "../../components/interactive-shell/simulationSession.js";
import "../../components/simulation/SimulationDashboard.css"; // frame (.sd-frame*) rules shared by every dashboard-framed simulation
import useReducedMotion from "../shared-3d/useReducedMotion.js";
import { useElementSize, useIsDark, layoutClass, useEquilibriumStore, useSimLoop, useTestHooks } from "./ui/hooks.js";
import { MODES, MODE_LABELS } from "./model/store.js";
import { REACTIONS } from "./model/reactions.js";
import { everydaySnapshot } from "./model/everyday.js";
import { chemSnapshot } from "./model/chem.js";
import { normalizeConfig, configFromSearch } from "./model/config.js";
import { fmt } from "./model/explain.js";
import { totalPressureBar } from "./model/chem.js";
import { ModeSelector, RunControls, PresetSelector, EverydayDisturb, ReactionSelector, ChemConditions, FluctToggle } from "./ui/Controls.jsx";
import { EquilibriumIndicator, SpeciesTable, QKPanel, Guide, Explanation } from "./ui/Panels.jsx";
import EverydayScene from "./ui/EverydayScene.jsx";
import VesselCanvas from "./ui/VesselCanvas.jsx";
import Graph from "./ui/Graph.jsx";
import "./EquilibriumLab.css";

// EQUILIBRIUM LAB -- DYNAMIC BALANCE (IB DP Chemistry R2.3 "How far? The extent of chemical change").
// One integrated simulation with three modes (Everyday Analogy | Chemical Model | Compare Both).  All state lives in ./model/store.js;
// scenes, graphs and panels only present it.  Architecture, parameters with sources and limitations: docs/EQUILIBRIUM_LAB.md.
// Lesson integration: <EquilibriumLab config={{ initialMode: "everyday" | "chemical" | "compare" }} /> (see model/config.js).
const FWD = "#2563eb"; const REV = "#ea580c";
const SIM_UNITS = { ev: "time units", ch: "s" };

function useSeries(tr, kind, fluct = false) {
  const h = tr.hist; const rx = kind === "ch" ? REACTIONS[tr.s.rid] : null;
  return useMemo(() => {
    if (kind === "ev") {
      return {
        rates: [
          { key: "fwd", label: "A → B", color: FWD, dash: "", x: h.t, y: h.rfDet },
          { key: "rev", label: "B → A", color: REV, dash: "7 4", x: h.t, y: h.rrDet },
          ...(fluct ? [{ key: "fwdM", label: "A → B (random trips)", color: "#60a5fa", dash: "2 3", x: h.t, y: h.rfMeas }, { key: "revM", label: "B → A (random trips)", color: "#fdba74", dash: "2 3", x: h.t, y: h.rrMeas }] : []),
        ],
        pop: [
          { key: "popA", label: "People in A (average)", color: "#0d9488", dash: "", x: h.t, y: h.detA },
          { key: "popB", label: "People in B (average)", color: "#7c3aed", dash: "7 4", x: h.t, y: h.detB },
          ...(fluct ? [{ key: "popAr", label: "A (random)", color: "#5eead4", dash: "2 3", x: h.t, y: h.A }, { key: "popBr", label: "B (random)", color: "#c4b5fd", dash: "2 3", x: h.t, y: h.B }] : []),
        ],
      };
    }
    return {
      rates: [
        { key: "fwd", label: "Forward rate", color: FWD, dash: "", x: h.t, y: h.rf },
        { key: "rev", label: "Reverse rate", color: REV, dash: "7 4", x: h.t, y: h.rr },
      ],
      conc: rx.species.map((s) => ({ key: s.id, label: s.formula, color: s.color, dash: s.dash, x: h.t, y: h.c[s.id] })),
    };
  }, [h, kind, rx, fluct]);
}

function GraphsEv({ tr, ui, hide, toggle, cmpOn, onPop, compact }) {
  const S = useSeries(tr, "ev", ui.fluct); const b = tr.before;
  const ghost = useMemo(() => (cmpOn && b ? [{ key: "fwd", y: b.rf, color: FWD, label: "Forward rate before the disturbance" }, { key: "rev", y: b.rr, color: REV, label: "Reverse rate before the disturbance" }] : []), [cmpOn, b]);
  const popGhost = useMemo(() => (cmpOn && b ? [{ key: "popA", y: b.A, color: "#0d9488", label: "A before" }, { key: "popB", y: b.B, color: "#7c3aed", label: "B before" }] : []), [cmpOn, b]);
  return (
    <section className="eq-card eq-graphs" data-testid="graph-card-ev">
      <Graph testId="rate-graph" title="Transfer rate vs time" ariaLabel="Line graph of the forward transfer rate from A to B and the reverse transfer rate from B to A against time. Both stay above zero at equilibrium." series={S.rates} hidden={hide.rates} onToggle={(k) => toggle("rates", k)}
        xLabel="Time (time units)" yLabel="People per time unit" xMin={10} marks={tr.marks} ghost={ghost} height={compact ? 170 : 176} empty="Press Start" />
      <div className="eq-poprow">
        {tr.phase === "attained" && <p className="eq-eqnote" data-testid="eq-label"><i /> Forward rate = Reverse rate</p>}
        <button type="button" className="eq-btn eq-btn--small" aria-pressed={ui.showPop} onClick={onPop} data-testid="toggle-pop">{ui.showPop ? "Hide population graph" : "Show Population Graph"}</button>
      </div>
      {ui.showPop && <Graph testId="pop-graph" title="Population vs time" ariaLabel="Line graph of the number of people in City A and City B against time. They approach constant values." series={S.pop} hidden={hide.pop} onToggle={(k) => toggle("pop", k)} xLabel="Time (time units)" yLabel="People" xMin={10} marks={tr.marks} ghost={popGhost} formatY={(v) => String(Math.round(v))} height={compact ? 150 : 168} />}
    </section>
  );
}

function GraphsCh({ tr, hide, toggle, cmpOn, compact }) {
  const S = useSeries(tr, "ch"); const b = tr.before; const rx = REACTIONS[tr.s.rid];
  const rGhost = useMemo(() => (cmpOn && b ? [{ key: "fwd", y: b.rf, color: FWD, label: "Forward rate before" }, { key: "rev", y: b.rr, color: REV, label: "Reverse rate before" }] : []), [cmpOn, b]);
  const cGhost = useMemo(() => (cmpOn && b ? rx.species.map((s) => ({ key: s.id, y: b.c[s.id], color: s.color, label: `${s.formula} before` })) : []), [cmpOn, b, rx]);
  const span = 12 * rx.playback;
  return (
    <section className="eq-card eq-graphs" data-testid="graph-card-ch">
      <Graph testId="conc-graph" title="Concentration vs time" ariaLabel={`Line graph of the concentration of each species in ${rx.name} against time.`} series={S.conc} hidden={hide.conc} onToggle={(k) => toggle("conc", k)} xLabel="Time (s)" yLabel="mol dm⁻³" xMin={span} marks={tr.marks} ghost={cGhost} height={compact ? 160 : 178} empty="Press Start" />
      <Graph testId="chem-rate-graph" title="Reaction rate vs time" ariaLabel="Line graph of the forward and reverse reaction rates against time. They become equal at equilibrium but do not fall to zero." series={S.rates} hidden={hide.chemRates} onToggle={(k) => toggle("chemRates", k)} xLabel="Time (s)" yLabel="mol dm⁻³ s⁻¹" xMin={span} marks={tr.marks} ghost={rGhost} height={compact ? 160 : 178} />
    </section>
  );
}

function VesselCard({ scene, running, reduced, dark, simple }) {
  const tr = scene.ch; const trRef = useRef(tr); trRef.current = tr; const rx = REACTIONS[tr.s.rid]; const p = totalPressureBar(tr.s);
  return (
    <section className="eq-card eq-vesselcard" data-testid="vessel-card">
      <div className="eq-vesselhead">
        <p className="eq-eqn eq-eqn--big" aria-label={rx.equationText}>{rx.equation}</p>
        <ul className="eq-chipsline" aria-label="Conditions">
          <li data-testid="chip-T">T {Math.round(tr.s.T)} K</li>
          {rx.gas && <li data-testid="chip-V">V {tr.s.V.toFixed(2)} dm³</li>}
          {rx.gas && <li data-testid="chip-p">p {fmt(p, 3)} bar</li>}
          {rx.controls.catalyst && <li data-testid="chip-cat">{tr.s.cat ? "catalyst" : "no catalyst"}</li>}
        </ul>
      </div>
      <div className="eq-vesselrow">
        <div className="eq-vesselbox"><VesselCanvas trRef={trRef} rid={rx.id} running={running} reduced={reduced} dark={dark} /></div>
        <div className="eq-vesselside"><SpeciesTable tr={tr} />
          <p className="eq-faint eq-vnote">{simple ? "Each drawn molecule stands for a fixed amount. The vessel is not drawn to scale." : `One drawn molecule = ${rx.run.unit} mol. The vessel size is schematic; the numbers come from the engine. Not every collision reacts.`}</p></div>
      </div>
    </section>
  );
}

function Shell({ config, standalone }) {
  const { frameRef, simulationId, isViewport } = useSimulationPresentation();
  const rootRef = useRef(null); const size = useElementSize(rootRef); const layout = layoutClass(size.width);
  const reduced = useReducedMotion(); const dark = useIsDark();
  const cfg = useMemo(() => normalizeConfig(config ?? (standalone && typeof window !== "undefined" ? configFromSearch(window.location.search) : null)), [config, standalone]);
  const [savedMode, setSavedMode] = useSimulationSessionState("mode", cfg.initialMode, (v) => MODES.includes(v));
  const [savedSimple, setSavedSimple] = useSimulationSessionState("simple", false, (v) => typeof v === "boolean");
  const [state, dispatch, stateRef] = useEquilibriumStore(MODES.includes(savedMode) ? savedMode : cfg.initialMode);
  useTestHooks(stateRef, dispatch);
  const mode = state.mode; const sc = state.scenes[mode]; const ui = state.ui; const simple = ui.simple;
  useSimLoop(sc.status === "running", dispatch);
  // a lesson editor changed the configured opening mode: follow it
  const seen = useRef(cfg.initialMode);
  useEffect(() => { if (seen.current === cfg.initialMode) return; seen.current = cfg.initialMode; dispatch({ type: "mode/set", mode: cfg.initialMode }); setSavedMode(cfg.initialMode); }, [cfg.initialMode, dispatch, setSavedMode]);
  useEffect(() => { if (savedSimple && !ui.simple) dispatch({ type: "ui/simple", value: true }); }, []); // restore after reload
  const setMode = useCallback((m) => { dispatch({ type: "mode/set", mode: m }); setSavedMode(m); }, [dispatch, setSavedMode]);
  const setSimple = (v) => { dispatch({ type: "ui/simple", value: v }); setSavedSimple(v); };
  const [hide, setHide] = useState({ rates: new Set(["fwdM", "revM"]), pop: new Set(), conc: new Set(), chemRates: new Set() });
  const toggle = useCallback((g, k) => setHide((h) => { const n = new Set(h[g]); if (n.has(k)) n.delete(k); else n.add(k); return { ...h, [g]: n }; }), []);
  const [cmpOn, setCmpOn] = useState(false);
  // the random-trip curves are visible exactly when random fluctuations are switched on
  useEffect(() => { setHide((h) => { const n = new Set(h.rates); for (const k of ["fwdM", "revM"]) { if (ui.fluct) n.delete(k); else n.add(k); } return { ...h, rates: n }; }); }, [ui.fluct]);
  const running = sc.status === "running"; const narrow = layout === "narrow";
  const evTr = sc.ev; const chTr = sc.ch;
  const main = mode === "chemical" ? "ch" : "ev";
  const mainTr = main === "ch" ? chTr : evTr;
  const evSnap = evTr ? everydaySnapshot(evTr.s) : null; const chSnap = chTr ? chemSnapshot(chTr.s) : null;
  const status = main === "ch" ? chSnap.status : evSnap.status;
  const mismatch = main === "ch" ? chSnap.mismatch : evSnap.mismatch;
  const notice = state.last && !state.last.ok ? state.last.message : "";

  const runControls = <RunControls scene={sc} speed={ui.speed} narrow={narrow} onAction={dispatch} onSpeed={(s) => dispatch({ type: "ui/speed", speed: s })} />;
  const indicator = <EquilibriumIndicator status={mode === "compare" ? chSnap.status : status} kind={mode === "compare" ? "ch" : main} simple={simple} mismatch={mode === "compare" ? chSnap.mismatch : mismatch} />;
  const explanation = ui.showExplanation && <Explanation kind={main} tr={mainTr} scene={sc} simple={simple} mode={mode} cmpOn={cmpOn} onCmp={() => setCmpOn((v) => !v)} />;
  const guide = <Guide progress={sc.progress} kind={mode === "chemical" ? "ch" : "ev"} simple={simple} />;
  const msg = <p className="eq-msg" role="status" aria-live="polite" data-testid="status-msg">{notice}</p>;

  let body;
  if (mode === "everyday") {
    body = (
      <div className="eq-grid">
        <div className="eq-col eq-col--main">
          <section className="eq-card eq-stagecard"><EverydayScene ev={evTr} running={running} reduced={reduced} speed={ui.speed} layout={layout} simple={simple} fluct={ui.fluct} /><FluctToggle on={ui.fluct} onChange={(v) => dispatch({ type: "ui/fluct", value: v })} ev={evTr} simple={simple} /></section>
          <section className="eq-card eq-controls"><PresetSelector scene={sc} onPick={(p) => dispatch({ type: "setup/preset", preset: p })} simple={simple} />{runControls}</section>
          {guide}
        </div>
        <div className="eq-col eq-col--side">
          {indicator}
          {ui.showGraph && <GraphsEv tr={evTr} ui={ui} hide={hide} toggle={toggle} cmpOn={cmpOn} onPop={() => dispatch({ type: "ui/pop" })} />}
          <section className="eq-card"><EverydayDisturb scene={sc} onAction={dispatch} simple={simple} />{msg}</section>
          {explanation}
        </div>
      </div>);
  } else if (mode === "chemical") {
    body = (
      <div className="eq-grid">
        <div className="eq-col eq-col--main">
          <section className="eq-card eq-controls eq-rxcard"><ReactionSelector scene={sc} simple={simple} onReaction={(id) => dispatch({ type: "setup/reaction", id })} onRates={(r) => dispatch({ type: "setup/rates", ...r })} />{runControls}</section>
          <VesselCard scene={sc} running={running} reduced={reduced} dark={dark} simple={simple} />
          <section className="eq-card"><ChemConditions scene={sc} onAction={dispatch} simple={simple} />{msg}</section>
          {guide}
        </div>
        <div className="eq-col eq-col--side">
          {indicator}
          {ui.showGraph && <GraphsCh tr={chTr} hide={hide} toggle={toggle} cmpOn={cmpOn} />}
          <QKPanel tr={chTr} simple={simple} />
          {explanation}
        </div>
      </div>);
  } else {
    body = (
      <div className="eq-grid eq-grid--compare">
        <div className="eq-compare-top">
          <section className="eq-card eq-cmp-left"><h3 className="eq-cmp-title"><i className="eq-dot eq-dot--a" /> Everyday analogy</h3><EverydayScene ev={evTr} running={running} reduced={reduced} speed={ui.speed} layout={narrow ? "narrow" : layout} compact simple={simple} fluct={ui.fluct} /><FluctToggle on={ui.fluct} onChange={(v) => dispatch({ type: "ui/fluct", value: v })} ev={evTr} simple={simple} /></section>
          <section className="eq-card eq-cmp-right"><h3 className="eq-cmp-title"><i className="eq-dot eq-dot--b" /> Chemical model: A ⇌ B</h3>
            <VesselCard scene={sc} running={running} reduced={reduced} dark={dark} simple={simple} /></section>
        </div>
        <div className="eq-compare-mid">
          <section className="eq-card eq-controls"><PresetSelector scene={sc} onPick={(p) => dispatch({ type: "setup/preset", preset: p })} simple={simple} />{runControls}</section>
          <section className="eq-card"><EverydayDisturb scene={sc} onAction={dispatch} simple={simple} />{msg}<p className="eq-faint">Each press changes both models at once: 20 people = 0.20 mol dm⁻³ of A or B.</p></section>
        </div>
        <div className="eq-compare-bot">
          {indicator}
          {ui.showGraph && <ComparePair evTr={evTr} chTr={chTr} hide={hide} toggle={toggle} fluct={ui.fluct} />}
          <QKPanel tr={chTr} simple={simple} />
          {guide}
          {explanation}
        </div>
      </div>);
  }

  return (
    <div ref={rootRef} className="eq-root elab-sim" data-testid="equilibrium-lab" data-layout={layout} data-theme={dark ? "dark" : "light"} data-viewport={isViewport ? "1" : "0"} data-mode={mode} data-status={sc.status} data-reduced={reduced ? "1" : "0"}>
      <header className="eq-header">
        <div className="eq-brand"><span className="eq-logo" aria-hidden="true"><FlaskConical size={18} /></span>
          <div><h2 className="eq-title">Equilibrium Lab — Dynamic Balance</h2><p className="eq-sub">Discover how forward and reverse processes continue at equal rates, and how equilibrium responds to change.</p></div></div>
        <div className="eq-actions">
          <label className="eq-simple" title="Simple wording: shorter, plainer sentences"><input type="checkbox" checked={simple} onChange={(e) => setSimple(e.target.checked)} data-testid="toggle-simple" /><Type size={14} aria-hidden="true" /><span>Simple wording</span></label>
          <button type="button" className="eq-btn eq-btn--small" aria-pressed={ui.showGraph} onClick={() => dispatch({ type: "ui/graph" })} data-testid="toggle-graph"><BarChart3 size={14} aria-hidden="true" /><span>{ui.showGraph ? "Hide Graph" : "Show Graph"}</span></button>
          <button type="button" className="eq-btn eq-btn--small" aria-pressed={ui.showExplanation} onClick={() => dispatch({ type: "ui/explanation" })} data-testid="toggle-explanation"><BookOpen size={14} aria-hidden="true" /><span>{ui.showExplanation ? "Hide Explanation" : "Show Explanation"}</span></button>
          <SimulationActions targetRef={frameRef} simulationId={simulationId} iconOnly />
        </div>
      </header>
      <ModeSelector mode={mode} onChange={setMode} />
      <main className="eq-body" aria-label={MODE_LABELS[mode]}>{body}</main>
    </div>
  );
}
function ComparePair({ evTr, chTr, hide, toggle, fluct }) {
  const evS = useSeriesRates(evTr, "ev", fluct); const chS = useSeriesRates(chTr, "ch");
  return (
    <section className="eq-card eq-graphs eq-graphs--pair" data-testid="graph-card-compare">
      <Graph testId="rate-graph" title="Everyday: transfer rate" ariaLabel="Transfer rates of the two buses against time" series={evS} hidden={hide.rates} onToggle={(k) => toggle("rates", k)} xLabel="Time (time units)" yLabel="People per time unit" xMin={10} marks={evTr.marks} height={170} />
      <Graph testId="chem-rate-graph" title="Chemical: reaction rate" ariaLabel="Forward and reverse reaction rates against time" series={chS} hidden={hide.chemRates} onToggle={(k) => toggle("chemRates", k)} xLabel="Time (time units)" yLabel="mol dm⁻³ s⁻¹" xMin={6} marks={chTr.marks} height={170} />
    </section>
  );
}
function useSeriesRates(tr, kind, fluct = false) {
  const h = tr.hist;
  return useMemo(() => (kind === "ev"
    ? [{ key: "fwd", label: "A → B", color: FWD, dash: "", x: h.t, y: h.rfDet }, { key: "rev", label: "B → A", color: REV, dash: "7 4", x: h.t, y: h.rrDet }, ...(fluct ? [{ key: "fwdM", label: "A → B (random trips)", color: "#60a5fa", dash: "2 3", x: h.t, y: h.rfMeas }, { key: "revM", label: "B → A (random trips)", color: "#fdba74", dash: "2 3", x: h.t, y: h.rrMeas }] : [])]
    : [{ key: "fwd", label: "Forward", color: FWD, dash: "", x: h.t, y: h.rf }, { key: "rev", label: "Reverse", color: REV, dash: "7 4", x: h.t, y: h.rr }]), [h, kind, fluct]);
}

// Registered under the id "equilibrium-lab"; the title MUST equal the catalogue label (InteractiveFrame resolves "Open in New Tab" from it).
export default function EquilibriumLab({ compact = false, standalone = false, config }) {
  return (
    <InteractiveFrame title="Equilibrium Lab — Dynamic Balance" subtitle="Dynamic balance: reversible change, rates, K and Le Chatelier" compact={compact} standalone={standalone} dashboard>
      <Shell config={config} standalone={standalone} />
    </InteractiveFrame>
  );
}
export { SIM_UNITS };
