import { useCallback, useEffect, useRef, useState } from "react";
import { ChartColumn, MoveUpRight, TrendingDown, TrendingUp } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashboardTabs } from "../../components/simulation/SimulationDashboard.jsx";
import {
  MODES, MODE_IDS, TEXT_ONE_LINER, defaultExplanation, defaultGraphId, defaultState, selectExplanation, setVariable, switchMode,
} from "./model.js";
import { createSimulation } from "./physics.js";
import { ACCENTS } from "./theme.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./GasLawsExplorer.css";
import ControlPanel from "./components/ControlPanel.jsx";
import { ChamberPanel, LiveValues } from "./components/ChamberPanel.jsx";
import GraphPanel from "./components/GraphPanel.jsx";
import { PredictPanel, WhatIsHappening } from "./components/BottomPanels.jsx";

// Gas Laws Explorer (IB DP Chemistry S1.5.1-S1.5.3). React owns the controls;
// model.js owns the physics of PV = nRT (one source of truth: mode, P, V, T, n);
// physics.js animates the particles; render.js draws them.
//
// INVESTIGATION PHASES (documented design decision)
//   ready    initial / after Reset: the two locked variables are locked, only the
//            independent variable moves. "Set initial conditions" is available.
//   editing  entered with "Set initial conditions": every non-calculated variable
//            is adjustable so the baseline can be chosen. "Start investigation"
//            confirms it and returns to `ready`.
//   running  begins on the FIRST change of the independent variable. The locked
//            variables stay fixed; "New investigation" returns the gas to the
//            baseline it started from and re-opens `editing`.
// Reset (header) -> default baseline, `ready`. Switching tab keeps all four
// values (they are consistent already, so nothing jumps) and starts a fresh
// `ready` investigation from them. Changing graph type never touches the state.
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

  // "What is happening?": compare the last settled state with the current one
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

  const handleChange = useCallback((key, value) => {
    const dep = MODES[state.mode].dependent;
    if (key === dep) return;
    if (phase !== "editing" && key !== MODES[state.mode].independent) return; // locked
    const r = setVariable(state, key, value);
    if (!r.changed) return;
    if (phase === "ready") { baselineRef.current = state; setPhase("running"); }
    setState(r.state);
    if (phase !== "editing") pushHistory(r.state);
  }, [state, phase, pushHistory]);

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

  const handleEditBaseline = useCallback(() => { setPhase("editing"); setHistory([]); }, []);
  const handleStart = useCallback(() => { baselineRef.current = state; setPhase("ready"); }, [state]);
  const handleNewInvestigation = useCallback(() => {
    const base = baselineRef.current;
    setState(base);
    setPhase("editing");
    setHistory([]);
    setRevealed(false);
  }, []);
  const handleResetGraph = useCallback(() => { setGraphId(defaultGraphId(state.mode)); setAllView(false); setHistory([]); }, [state.mode]);

  const tabs = MODE_IDS.map((id) => {
    const md = MODES[id];
    const a = ACCENTS[id];
    return {
      id, label: `${md.title} (${md.short})`, sub: md.law, icon: TAB_ICONS[id], testId: `tab-${id}`,
      title: `${md.title} (${md.short}): ${md.law}`, solid: a.solid, soft: a.tabBg, border: a.border, text: a.text,
    };
  });

  return (
    <SimulationDashboard
      id="gl-workspace"
      role="tabpanel"
      ariaLabel={`${m.title} investigation`}
      title="Gas Laws Explorer"
      subtitle="How P, V, T and n are related"
      subtitleLong={`How P, V, T and n are related. ${TEXT_ONE_LINER}`}
      onReset={handleReset}
      tabs={<DashboardTabs tabs={tabs} value={state.mode} onChange={handleMode} ariaLabel="Gas law relationship" idPrefix="gl-tab" controls="gl-workspace" testId="mode-tabs" />}
      controls={
        <ControlPanel state={state} phase={phase} unit={unit} onUnit={setUnit} onChange={handleChange}
          onEditBaseline={handleEditBaseline} onStart={handleStart} onNewInvestigation={handleNewInvestigation} accent={accent} />
      }
      chamber={
        <ChamberPanel sim={sim} state={state} accent={accent} playing={playing} onTogglePlay={() => setPlaying((p) => !p)}
          display={display} onDisplay={(d) => setDisplay((x) => ({ ...x, ...d }))} reducedMotion={reducedMotion} />
      }
      graph={
        <GraphPanel state={state} accent={accent} graphId={graphId} onGraphId={setGraphId} allView={allView}
          onToggleAll={() => setAllView((v) => !v)} onResetGraph={handleResetGraph} onOpenMode={handleOpenFromGrid} trail={history} />
      }
      live={<LiveValues state={state} unit={unit} />}
      predict={<PredictPanel state={state} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />}
      explain={<WhatIsHappening text={explain.text} accent={accent} />}
    />
  );
}

const TAB_ICONS = { pv: TrendingDown, vt: TrendingUp, pt: MoveUpRight, vn: ChartColumn };
