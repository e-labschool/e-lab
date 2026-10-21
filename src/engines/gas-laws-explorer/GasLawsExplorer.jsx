import { useCallback, useEffect, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashboardTabs, ExplainLine } from "../../components/simulation/SimulationDashboard.jsx";
import {
  MODES, MODE_IDS, defaultExplanation, defaultGraphId, defaultState, selectExplanation, setVariable, switchMode,
} from "./model.js";
import { createSimulation } from "./physics.js";
import { ACCENTS } from "./theme.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./GasLawsExplorer.css";
import ControlPanel, { GasLawsSettings } from "./components/ControlPanel.jsx";
import { ChamberPanel, LiveValues } from "./components/ChamberPanel.jsx";
import GraphPanel from "./components/GraphPanel.jsx";
import { ExplanationDetails, PredictPanel } from "./components/BottomPanels.jsx";

// Gas Laws Explorer (IB DP Chemistry S1.5.1-S1.5.3). React owns the controls;
// model.js owns the physics of PV = nRT (one source of truth: mode, P, V, T, n);
// physics.js animates the particles; render.js draws them. (The physics files are unchanged by the
// simplified dashboard: only the arrangement of controls, graph and text changed.)
//
// INVESTIGATION PHASES (documented design decision)
//   ready    initial / after Reset / after any change of the starting values: only the
//            independent variable is a slider; the two controlled variables are a read-only row.
//   running  begins on the FIRST change of the independent variable. "Back to starting values"
//            (Settings) returns the gas to the baseline the investigation started from.
// Initial conditions live in the header Settings popover: moving a slider there sets a NEW baseline
// (clears the trail, returns to `ready`). Reset (header) -> default baseline, `ready`. Switching tab keeps
// all four values (they are consistent already, so nothing jumps) and starts a fresh `ready`
// investigation from them. Changing graph type never touches the state.
const EXPLAIN_DEBOUNCE_MS = 250;
const HISTORY_MAX = 120;

export default function GasLawsExplorer({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame
      title="Gas Laws Explorer"
      subtitle="Investigate how pressure, volume, temperature and amount of gas are related."
      compact={compact}
      standalone={standalone}
      dashboard
    >
      <Workspace />
    </InteractiveFrame>
  );
}

function Workspace() {
  const reducedMotion = useReducedMotion();
  const [sim] = useState(() => createSimulation({ seed: (Math.random() * 2 ** 32) >>> 0 }));
  const [state, setState] = useState(() => defaultState("pv"));
  const [phase, setPhase] = useState("ready");
  const [unit, setUnit] = useState("mol");
  const [display, setDisplay] = useState({ trails: true, collisions: false });
  const [playing, setPlaying] = useState(true);
  const [showGraph, setShowGraph] = useState(false);
  const [graphId, setGraphId] = useState(() => defaultGraphId("pv"));
  const [allView, setAllView] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState([]);
  const [explain, setExplain] = useState(() => defaultExplanation("pv"));
  const baselineRef = useRef(state);
  const settledRef = useRef(null);

  useEffect(() => { sim.setTarget(state); }, [sim, state]);
  useEffect(() => { sim.setDisplay(display); }, [sim, display]);
  useEffect(() => { sim.setPaused(!playing); }, [sim, playing]);
  useEffect(() => { sim.setInstant(reducedMotion); }, [sim, reducedMotion]);

  // One-line explanation: compare the last settled state with the current one
  // after a short debounce; a mode change shows the default message at once.
  useEffect(() => {
    if (settledRef.current == null) { settledRef.current = state; return undefined; }
    if (settledRef.current.mode !== state.mode) {
      settledRef.current = state;
      setExplain(defaultExplanation(state.mode));
      return undefined;
    }
    const t = setTimeout(() => {
      const r = selectExplanation(settledRef.current, state);
      settledRef.current = state;
      if (r) setExplain((cur) => (cur.id === r.id ? cur : r));
    }, EXPLAIN_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state]);

  const m = MODES[state.mode];
  const accent = ACCENTS[state.mode];

  const pushHistory = useCallback((s) => setHistory((h) => [...h.slice(-(HISTORY_MAX - 1)), s]), []);

  // The student moves the independent variable (the only slider on the main panel).
  const handleChange = useCallback((key, value) => {
    if (key !== MODES[state.mode].independent) return;
    const r = setVariable(state, key, value);
    if (!r.changed) return;
    if (phase === "ready") { baselineRef.current = state; setPhase("running"); }
    setState(r.state);
    pushHistory(r.state);
  }, [state, phase, pushHistory]);

  // Settings > Initial conditions: any non-calculated variable; becomes the new baseline.
  const handleSetInitial = useCallback((key, value) => {
    if (key === MODES[state.mode].dependent) return;
    const r = setVariable(state, key, value);
    if (!r.changed) return;
    baselineRef.current = r.state;
    setState(r.state);
    setPhase("ready");
    setHistory([]);
    setRevealed(false);
  }, [state]);

  const resetInvestigationUi = useCallback((mode) => {
    setPhase("ready");
    setGraphId(defaultGraphId(mode));
    setRevealed(false);
    setHistory([]);
  }, []);

  const handleMode = useCallback((mode) => {
    if (mode === state.mode) return;
    const next = switchMode(state, mode);
    baselineRef.current = next;
    setState(next);
    resetInvestigationUi(mode);
  }, [state, resetInvestigationUi]);

  const handleOpenFromGrid = useCallback((mode) => {
    setAllView(false);
    if (mode !== state.mode) handleMode(mode);
  }, [state.mode, handleMode]);

  const handleReset = useCallback(() => {
    const next = defaultState(state.mode);
    baselineRef.current = next;
    setState(next);
    sim.reset(next);
    resetInvestigationUi(state.mode);
    setAllView(false);
    setDisplay({ trails: true, collisions: false });
    setPlaying(true);
    settledRef.current = next;
    setExplain(defaultExplanation(state.mode));
  }, [state.mode, sim, resetInvestigationUi]);

  const handleBackToStart = useCallback(() => {
    setState(baselineRef.current);
    setPhase("ready");
    setHistory([]);
    setRevealed(false);
  }, []);
  const handleResetGraph = useCallback(() => { setGraphId(defaultGraphId(state.mode)); setAllView(false); setHistory([]); }, [state.mode]);

  const tabs = MODE_IDS.map((id) => {
    const md = MODES[id];
    return {
      id, label: md.short.replaceAll(" ", ""), icon: undefined, testId: `tab-${id}`,
      title: `${md.title} (${md.short.replaceAll(" ", "")}): ${md.law}`,
    };
  });

  return (
    <SimulationDashboard
      id="gl-workspace"
      role="tabpanel"
      ariaLabel={`${m.title} investigation`}
      title="Gas Laws Explorer"
      subtitle={m.title}
      subtitleLong={`${m.title} \u2013 ${m.law}`}
      onReset={handleReset}
      graphShown={showGraph}
      onGraphToggle={() => setShowGraph((g) => !g)}
      graphId="gl-graph"
      graphWide={showGraph && allView}
      settings={
        <GasLawsSettings state={state} phase={phase} unit={unit} onUnit={setUnit} display={display}
          onDisplay={(d) => setDisplay((x) => ({ ...x, ...d }))} onSetInitial={handleSetInitial} onBackToStart={handleBackToStart} accent={accent} />
      }
      tabs={<DashboardTabs segmented tabs={tabs} value={state.mode} onChange={handleMode} ariaLabel="Gas law relationship" idPrefix="gl-tab" controls="gl-workspace" testId="mode-tabs" />}
      controls={<ControlPanel state={state} unit={unit} onChange={handleChange} accent={accent} />}
      chamber={
        <ChamberPanel sim={sim} state={state} accent={accent} playing={playing} onTogglePlay={() => setPlaying((p) => !p)} reducedMotion={reducedMotion} />
      }
      graph={
        <GraphPanel state={state} accent={accent} graphId={graphId} onGraphId={setGraphId} allView={allView}
          onToggleAll={() => setAllView((v) => !v)} onResetGraph={handleResetGraph} onOpenMode={handleOpenFromGrid} trail={history} />
      }
      live={<LiveValues state={state} unit={unit} />}
      predict={<PredictPanel state={state} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />}
      explain={<ExplainLine text={explain.text} details={<ExplanationDetails mode={state.mode} />} />}
    />
  );
}
