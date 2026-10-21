import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import {
  MODES, TEXT_ONE_LINER, defaultExplanation, defaultGraphId, defaultState, selectExplanation, setVariable, switchMode,
} from "./model.js";
import { createSimulation } from "./physics.js";
import { ACCENTS } from "./theme.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./GasLawsExplorer.css";
import ModeTabs from "./components/ModeTabs.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import ChamberPanel from "./components/ChamberPanel.jsx";
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
const WIDE_MIN_WIDTH = 900;
const HISTORY_MAX = 120;

export default function GasLawsExplorer({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame
      title="Gas Laws Explorer"
      subtitle="Investigate how pressure, volume, temperature and amount of gas are related."
      compact={compact}
      standalone={standalone}
    >
      <Workspace showTitle={compact} />
    </InteractiveFrame>
  );
}

function Workspace({ showTitle }) {
  const { isViewport } = useSimulationPresentation();
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
  const [wide, setWide] = useState(false);
  const rootRef = useRef(null);
  const baselineRef = useRef(state);
  const settledRef = useRef(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => setWide(el.getBoundingClientRect().width >= WIDE_MIN_WIDTH);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

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

  const dense = isViewport && wide;
  const shell = "gl-explorer rounded-2xl border border-[#DAE5F7] bg-[linear-gradient(180deg,#FFFFFF,#EEF5FF)] p-2.5 text-[#1E2A44] sm:p-3 [color-scheme:light]";
  const panelCls = "rounded-2xl border border-[#E3EAF6] bg-white/90 shadow-[0_2px_10px_rgba(60,90,150,0.07)] ";

  const resetBtn = (
    <button type="button" onClick={handleReset} data-testid="reset"
      aria-label="Reset the simulation to the default conditions"
      className={"inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#D5DEEF] bg-white px-3 text-[13.5px] " + (dense ? "py-1 " : "py-1.5 ") + " font-semibold text-[#14226B] shadow-sm hover:bg-[#EEF4FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5]"}>
      <RotateCcw size={15} aria-hidden="true" /> Reset
    </button>
  );
  const note = (
    <p className={"rounded-xl border border-[#F2E2B0] bg-[#FFF7DC] px-3 text-[12.5px] " + (dense ? "py-1 " : "py-1.5 ") + " font-medium leading-tight text-[#4A3B0A]"} data-testid="one-liner">
      {TEXT_ONE_LINER}
    </p>
  );
  const header = showTitle && !isViewport ? (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#0F8A3F] shadow-sm"><FlaskConical size={26} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 className="text-[22px] font-extrabold leading-tight text-[#14226B]">Gas Laws Explorer</h2>
          <p className="text-[13px] text-[#33415F]">Investigate how pressure, volume, temperature and amount of gas are related.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{note}{resetBtn}</div>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-3">{note}{resetBtn}</div>
  );

  const controlPanel = (
    <ControlPanel state={state} phase={phase} unit={unit} onUnit={setUnit} onChange={handleChange}
      onEditBaseline={handleEditBaseline} onStart={handleStart} onNewInvestigation={handleNewInvestigation} accent={accent} dense={dense} />
  );
  const chamber = (
    <ChamberPanel sim={sim} state={state} unit={unit} accent={accent} playing={playing} onTogglePlay={() => setPlaying((p) => !p)}
      display={display} onDisplay={(d) => setDisplay((x) => ({ ...x, ...d }))} reducedMotion={reducedMotion} dense={dense} />
  );
  const graph = (
    <section aria-label="Interactive graph" className={panelCls + "h-full min-h-0 " + (dense ? "p-2.5" : "p-3.5")} id="gl-graph">
      <GraphPanel state={state} accent={accent} graphId={graphId} onGraphId={setGraphId} allView={allView}
        onToggleAll={() => setAllView((v) => !v)} onResetGraph={handleResetGraph} onOpenMode={handleOpenFromGrid} trail={history} dense={dense} />
    </section>
  );
  const bottom = (
    <div className={"grid gap-2.5 " + (wide ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
      <PredictPanel state={state} revealed={revealed} onToggle={() => setRevealed((r) => !r)} dense={dense} />
      <WhatIsHappening text={explain.text} accent={accent} dense={dense} />
    </div>
  );
  const tabs = <ModeTabs mode={state.mode} onMode={handleMode} dense={dense} />;

  if (dense) {
    return (
      <div ref={rootRef} className={shell + " flex h-full min-h-0 flex-col gap-1.5 overflow-hidden"} id="gl-workspace" role="tabpanel" aria-label={`${m.title} investigation`} data-testid="workspace" data-layout="dense">
        {header}
        {tabs}
        <div className="grid min-h-0 flex-1 grid-cols-[312px_minmax(0,1fr)_minmax(340px,0.9fr)] grid-rows-[minmax(0,1fr)] gap-2.5">
          <div className="min-h-0">{controlPanel}</div>
          {chamber}
          <div className="min-h-0">{graph}</div>
        </div>
        {bottom}
      </div>
    );
  }
  return (
    <div ref={rootRef} className={shell + " flex flex-col gap-3"} id="gl-workspace" role="tabpanel" aria-label={`${m.title} investigation`} data-testid="workspace" data-layout={wide ? "wide" : "stacked"}>
      {header}
      {tabs}
      <div className={"grid gap-3 " + (wide ? "grid-cols-[312px_minmax(0,1fr)_minmax(320px,0.95fr)] items-stretch" : "grid-cols-1")}>
        {controlPanel}
        {chamber}
        <div className={wide ? "min-h-[600px]" : "h-[500px]"}>{graph}</div>
      </div>
      {bottom}
    </div>
  );
}
