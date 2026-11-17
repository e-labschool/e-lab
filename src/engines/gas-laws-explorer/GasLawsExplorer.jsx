import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashboardTabs, ExplainLine } from "../../components/simulation/SimulationDashboard.jsx";
import {
  IB_UNITS, MODES, MODE_IDS, VARS, buildGraph, defaultExplanation, defaultGraphId, defaultState, depOf, formatValue, freeKeys, makeState, presetState, selectExplanation, setVariable, switchMode,
} from "./model.js";
import { UNIT_SYSTEMS, PRESSURE_UNITS, VOLUME_UNITS } from "../../lib/gas/gasUnits.js";
import ReadingsPanel from "../../components/interactive-shell/readings/ReadingsPanel.jsx";
import { addReading, clearReadings, createReadings, removeReading } from "../../components/interactive-shell/readings/readingsModel.js";
import { readingColumns, readingValues, theoryFor, plotDefaultsFor, originFor } from "./readings.js";
import { createSimulation } from "./physics.js";
import { ACCENTS } from "./theme.js";
import { LAW_INFO, lawHeading } from "./lawInfo.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./GasLawsExplorer.css";
import ControlPanel, { GasLawsSettings } from "./components/ControlPanel.jsx";
import { ChamberPanel, LiveValues } from "./components/ChamberPanel.jsx";
import GraphPanel from "./components/GraphPanel.jsx";
import { ExplanationDetails, PredictPanel } from "./components/BottomPanels.jsx";
import AvogadroCompare from "./components/AvogadroCompare.jsx";
import { useSimulationSessionState } from "../../components/interactive-shell/simulationSession.js";

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
  // GS-18: restored after a reload / navigating away and back (sessionStorage per Learn block; plain useState elsewhere).
  const [state, setState] = useSimulationSessionState("state", () => defaultState("pv"), (v) => v && MODE_IDS.includes(v.mode) && ["P", "V", "T", "n"].every((k) => Number.isFinite(v[k])));
  const [phase, setPhase] = useState("ready");
  const [unit, setUnit] = useSimulationSessionState("unit", "mol", (v) => v === "mol" || v === "molecules");
  const [unitSystem, setUnitSystem] = useSimulationSessionState("unitSystem", "ib", (v) => v === "ib" || v === "atm");
  const [view, setView] = useState("theory");
  const [readings, setReadings] = useSimulationSessionState("readings", () => Object.fromEntries(MODE_IDS.map((id) => [id, createReadings()])), (v) => v && MODE_IDS.every((id) => Array.isArray(v[id]?.rows)));
  const units = useMemo(() => ({ pressure: UNIT_SYSTEMS[unitSystem].pressure, volume: UNIT_SYSTEMS[unitSystem].volume }), [unitSystem]);
  const [display, setDisplay] = useState({ trails: true, collisions: false });
  const [playing, setPlaying] = useState(true);
  const [showGraph, setShowGraph] = useSimulationSessionState("showGraph", false, (v) => typeof v === "boolean");
  const [graphId, setGraphId] = useState(() => defaultGraphId(state.mode));
  const [allView, setAllView] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState([]);
  const [explain, setExplain] = useState(() => defaultExplanation(state.mode));
  const carryRef = useRef(null); // GS-17: set when a tab switch carried the previous values over
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
      const base = defaultExplanation(state.mode);
      setExplain(carryRef.current ? { ...base, id: base.id + "-carried", text: `${base.text} ${carryRef.current}` } : base);
      carryRef.current = null;
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
    if (!freeKeys(state).includes(key)) return;
    const r = setVariable(state, key, value);
    if (!r.changed) return;
    if (phase === "ready") { baselineRef.current = state; setPhase("running"); }
    setState(r.state);
    pushHistory(r.state);
  }, [state, phase, pushHistory]);

  // Settings > Initial conditions: any non-calculated variable; becomes the new baseline.
  const handleSetInitial = useCallback((key, value) => {
    if (key === depOf(state)) return;
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
    // GS-17: values carry over between tabs (nothing jumps); say so when they are not the standard start, and offer the way back.
    const std = defaultState(mode);
    const same = ["P", "V", "T", "n"].every((k) => Math.abs(std[k] - next[k]) < 1e-6 * Math.max(1, Math.abs(std[k])));
    carryRef.current = same ? null : "The values were carried over from the previous tab. Settings > Initial conditions > Standard start goes back to 1.00 mol, 300 K, 25 dm\u00b3.";
    baselineRef.current = next;
    setState(next);
    resetInvestigationUi(mode);
  }, [state, resetInvestigationUi]);

  const handleOpenFromGrid = useCallback((mode) => {
    setAllView(false);
    if (mode !== state.mode) handleMode(mode);
  }, [state.mode, handleMode]);

  const handlePreset = useCallback((which) => {
    const next = presetState(state.mode, which, state.calc);
    baselineRef.current = next;
    setState(next);
    setPhase("ready");
    setHistory([]);
    setRevealed(false);
  }, [state.mode, state.calc]);

  const handleCalc = useCallback((k) => {
    if (state.mode !== "comb" || k === state.calc) return;
    const next = makeState("comb", state, k);
    baselineRef.current = next;
    setState(next);
    setPhase("ready");
  }, [state]);

  const columns = useMemo(() => readingColumns(units), [units]);
  const handleRecord = useCallback(() => {
    const r = addReading(readings[state.mode], readingValues(state), columns);
    if (r.ok) setReadings((all) => ({ ...all, [state.mode]: r.state }));
    return r;
  }, [state, columns, readings]);

  const handleReset = useCallback(() => {
    const next = defaultState(state.mode);
    baselineRef.current = next;
    setState(next);
    sim.reset(next);
    resetInvestigationUi(state.mode);
    setAllView(false);
    setDisplay({ trails: true, collisions: false });
    setPlaying(true);
    setReadings((all) => ({ ...all, [state.mode]: createReadings() }));
    setView("theory");
    settledRef.current = next;
    setExplain(defaultExplanation(state.mode));
  }, [state.mode, sim, resetInvestigationUi]);

  const handleStandardStart = useCallback(() => {
    const next = defaultState(state.mode);
    baselineRef.current = next;
    setState(next);
    setPhase("ready");
    setHistory([]);
    setRevealed(false);
    carryRef.current = null;
    settledRef.current = next;
    setExplain(defaultExplanation(state.mode));
  }, [state.mode, setState]);

  const handleBackToStart = useCallback(() => {
    setState(baselineRef.current);
    setPhase("ready");
    setHistory([]);
    setRevealed(false);
  }, []);
  const handleResetGraph = useCallback(() => { setGraphId(defaultGraphId(state.mode)); setAllView(false); setHistory([]); }, [state.mode]);

  const modeReadings = readings[state.mode];
  const graphDef = buildGraph(state, graphId, { units, marker: false });
  const readingsNode = (
    <ReadingsPanel
      key={state.mode}
      title={`Gas Laws: ${MODES[state.mode].title}`} stem={`gas-laws-${state.mode}`}
      columns={columns} rows={modeReadings.rows}
      onRecord={handleRecord}
      onDelete={(id) => setReadings((all) => ({ ...all, [state.mode]: removeReading(all[state.mode], id) }))}
      onClear={() => setReadings((all) => ({ ...all, [state.mode]: clearReadings(all[state.mode]) }))}
      axes={plotDefaultsFor(graphDef)}
      theory={(x, y) => theoryFor(state, x, y, units)}
      includeOrigin={(x, y) => originFor(x, y)}
      meta={[`Relationship: ${MODES[state.mode].title} (${MODES[state.mode].law})`, `Units: ${PRESSURE_UNITS[units.pressure].label} and ${VOLUME_UNITS[units.volume].label}; R = 8.31 J K-1 mol-1`, "Values are the simulation's own PV = nRT readings (no measurement error)."]}
      recordHint="Add the current P, V, T and n"
    />
  );

  const tabs = MODE_IDS.map((id) => {
    const md = MODES[id];
    return {
      id, label: md.short.replaceAll(" ", ""), sub: LAW_INFO[id].law, icon: undefined, testId: `tab-${id}`,
      title: `${lawHeading(id)} (${md.short.replaceAll(" ", "")})`,
    };
  });

  return (
    <SimulationDashboard
      id="gl-workspace"
      role="tabpanel"
      ariaLabel={`${m.title} investigation`}
      title="Gas Laws Explorer"
      subtitle={<><span className="gl-h-full">{lawHeading(state.mode)}</span><span className="gl-h-short">{LAW_INFO[state.mode].law}</span></>}
      subtitleLong={lawHeading(state.mode)}
      onReset={handleReset}
      graphShown={showGraph}
      onGraphToggle={() => setShowGraph((g) => !g)}
      graphId="gl-graph"
      graphWide={showGraph && allView}
      settings={
        <GasLawsSettings state={state} phase={phase} unit={unit} onUnit={setUnit} units={units} unitSystem={unitSystem} onUnitSystem={setUnitSystem} onPreset={handlePreset} display={display}
          onDisplay={(d) => setDisplay((x) => ({ ...x, ...d }))} onSetInitial={handleSetInitial} onBackToStart={handleBackToStart} onStandardStart={handleStandardStart} accent={accent} />
      }
      tabs={<DashboardTabs segmented tabs={tabs} value={state.mode} onChange={handleMode} ariaLabel="Gas law relationship" idPrefix="gl-tab" controls="gl-workspace" testId="mode-tabs" />}
      controls={<ControlPanel state={state} unit={unit} units={units} onChange={handleChange} accent={accent} onRecord={handleRecord} readingCount={modeReadings.rows.length} onCalc={handleCalc} />}
      chamber={
        <ChamberPanel sim={sim} state={state} accent={accent} playing={playing} onTogglePlay={() => setPlaying((p) => !p)} reducedMotion={reducedMotion} units={units} />
      }
      graph={
        <GraphPanel state={state} accent={accent} graphId={graphId} onGraphId={setGraphId} allView={allView}
          onToggleAll={() => setAllView((v) => !v)} onResetGraph={handleResetGraph} onOpenMode={handleOpenFromGrid} trail={history}
          units={units} view={view} onView={setView} readingsCount={modeReadings.rows.length} readingsNode={readingsNode}
          compareNode={state.mode === "vn" ? <AvogadroCompare state={state} units={units} /> : null} />
      }
      live={<LiveValues state={state} unit={unit} note={explain.text} units={units} />}
      predict={<PredictPanel state={state} revealed={revealed} onToggle={() => setRevealed((r) => !r)} units={units} />}
      explain={<ExplainLine text={LAW_INFO[state.mode].sentence} testId="law-statement" details={<ExplanationDetails mode={state.mode} note={explain.text} />} />}
    />
  );
}
