import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSimulationSessionState } from "../../components/interactive-shell/simulationSession.js";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashPanel, DashboardTabs, ExplainLine, MiniSwitch, PopoverSection, SettingToggle } from "../../components/simulation/SimulationDashboard.jsx";
import { DEFAULT_CONTROLS, DEFAULT_DISPLAY, GASES, applyControlChange, createSimulation, resolveState, selectExplanation, unitLabelV } from "./model.js";
import { UNIT_SYSTEMS } from "../../lib/gas/gasUnits.js";
import ReadingsPanel from "../../components/interactive-shell/readings/ReadingsPanel.jsx";
import { addReading, clearReadings, createReadings, removeReading } from "../../components/interactive-shell/readings/readingsModel.js";
import { originFor, plotDefaultsFor, readingColumns, readingValues, theoryFor } from "./readings.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./IdealGasSimulation.css";
import ControlsPanel from "./components/ControlsPanel.jsx";
import { GAS_DESCRIPTIONS } from "./gasDescriptions.js";
import ChamberPanel from "./components/ChamberPanel.jsx";
import RealIdealGraph from "./components/RealIdealGraph.jsx";
import { LiveValues, PredictPanel } from "./components/LiveAndPredict.jsx";

// Ideal vs Real Gas (IB DP Chemistry S1.5.1-S1.5.3). ONE experiment: a single gas sample in a piston (CO2 by default; He, N2, NH3 selectable).
// The header switch "Ideal Gas | Real Gas" changes only the gas MODEL; T, n and the controlled
// variable (and the selected Change Pressure | Change Volume control) are preserved.
// React owns the controls; the pure model (model.js) owns the physics (ideal PV = nRT, real van der
// Waals, constants of the chosen gas); render.js draws an ILLUSTRATIVE particle picture (not molecular dynamics). The pressure
// readout comes from the model's formulas, not from counting animated collisions.
//
// LAYOUT: rendered with the shared Simulation Dashboard Layout (components/simulation/SimulationDashboard.jsx):
// Title | Ideal/Real | Show Graph | Reset | Settings; compact controls | large chamber | optional Z-vs-P
// graph beside the chamber; live-value strip + one-line explanation. No physics lives in this file.
const EXPLAIN_DEBOUNCE_MS = 250; // message reflects the latest settled change

const GAS_TABS = [
  { id: "ideal", label: "Ideal Gas", title: GAS_DESCRIPTIONS.ideal },
  { id: "real", label: "Real Gas", title: GAS_DESCRIPTIONS.real },
];

export default function IdealGasSimulation({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame
      title="Ideal Gas Simulation"
      subtitle="Pressure, temperature, volume and amount of gas - ideal and real"
      compact={compact}
      standalone={standalone}
      dashboard
    >
      <IdealGasWorkspace />
    </InteractiveFrame>
  );
}

function IdealGasWorkspace() {
  const reducedMotion = useReducedMotion();
  const [sim] = useState(() => createSimulation({ seed: (Math.random() * 2 ** 32) >>> 0 }));
  // Restored after a reload / navigate-away-and-back (sessionStorage, per Learn
  // block); plain useState behaviour outside a Learn simulation block.
  const [controls, setControls] = useSimulationSessionState("controls", () => ({ ...DEFAULT_CONTROLS }), (v) => v && typeof v === "object" && Object.keys(DEFAULT_CONTROLS).every((k) => k in v));
  const [display, setDisplay] = useSimulationSessionState("display", () => ({ ...DEFAULT_DISPLAY }), (v) => v && typeof v === "object" && Object.keys(DEFAULT_DISPLAY).every((k) => k in v));
  const [playing, setPlaying] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [showGraph, setShowGraph] = useSimulationSessionState("showGraph", false, (v) => typeof v === "boolean");
  const [unitSystem, setUnitSystem] = useState("ib");
  const [view, setView] = useState("theory");
  const [readingsState, setReadingsState] = useState(() => createReadings());
  const units = useMemo(() => ({ pressure: UNIT_SYSTEMS[unitSystem].pressure, volume: UNIT_SYSTEMS[unitSystem].volume }), [unitSystem]);

  useEffect(() => { sim.setControls(controls); }, [sim, controls]);
  useEffect(() => { sim.setDisplay({ ...display, volumeLabel: unitLabelV(units) }); }, [sim, display, units]);
  useEffect(() => { sim.setPaused(!playing); }, [sim, playing]);
  useEffect(() => { sim.setInstant(reducedMotion); }, [sim, reducedMotion]);

  const readings = useMemo(() => resolveState(controls), [controls]);

  // One-line explanation: diff the last SETTLED controls against the current ones after a short
  // debounce; null result = nothing relevant, keep the message.
  const settledRef = useRef(null);
  const [explain, setExplain] = useState(() => selectExplanation(null, DEFAULT_CONTROLS));
  useEffect(() => {
    if (settledRef.current == null) { settledRef.current = controls; return undefined; }
    const t = setTimeout(() => {
      const r = selectExplanation(settledRef.current, controls);
      settledRef.current = controls;
      if (r) setExplain((cur) => (cur.id === r.id ? cur : r));
    }, EXPLAIN_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [controls]);

  // GS-10: the first time the student picks Real Gas the Z-vs-P graph opens by itself (it is the IB S1.5.2 evidence); they can still hide it.
  const autoGraphRef = useRef(false);
  const handleControls = useCallback((patch) => {
    if (patch.mode === "real" && !autoGraphRef.current) { autoGraphRef.current = true; setShowGraph(true); }
    setControls((c) => applyControlChange(c, patch));
  }, [setControls, setShowGraph]);
  const handleDisplay = useCallback((patch) => setDisplay((d) => ({ ...d, ...patch })), [setDisplay]);
  const handleReset = useCallback(() => {
    sim.reset();
    setControls({ ...DEFAULT_CONTROLS });
    settledRef.current = { ...DEFAULT_CONTROLS };
    setExplain(selectExplanation(null, DEFAULT_CONTROLS));
    setDisplay({ ...DEFAULT_DISPLAY });
    setUnitSystem("ib");
    setView("theory");
    setReadingsState(createReadings());
    setPlaying(true);
    setRevealed(false);
    autoGraphRef.current = false;
  }, [sim, setControls, setDisplay]);

  const real = readings.mode === "real";
  const GAS = GASES[readings.gasId] ?? GASES.co2;

  // STP / SATP (IB data booklet): 1.00 mol (N = 100 particles) at 100 kPa and 273.15 / 298.15 K, pressure is the controlled variable.
  const handlePreset = useCallback((T) => {
    setControls((c) => applyControlChange(applyControlChange(c, { control: "pressure" }), { N: 100, T, P: 100 / 101.325 }));
  }, [setControls]);

  const columns = useMemo(() => readingColumns(units), [units]);
  const handleRecord = useCallback(() => {
    const r = addReading(readingsState, readingValues(readings), columns);
    if (r.ok) setReadingsState(r.state);
    return r;
  }, [readings, columns, readingsState]);
  const readingsNode = (
    <ReadingsPanel
      title="Ideal vs Real Gas" stem="ideal-vs-real-gas"
      columns={columns} rows={readingsState.rows}
      onRecord={handleRecord}
      onDelete={(id) => setReadingsState((r) => removeReading(r, id))}
      onClear={() => setReadingsState((r) => clearReadings(r))}
      axes={plotDefaultsFor(readings)}
      theory={(x, y) => theoryFor(readings, x, y, columns)}
      includeOrigin={(x, y) => originFor(x, y)}
      meta={[`Gas when recorded: ${GAS.name}; model: ${real ? "van der Waals" : "ideal PV = nRT"}`, `Units: ${columns[0].unit} and ${columns[1].unit}; R = 8.31 J K-1 mol-1`, "Values are the simulation's own readings (no measurement error)."]}
      recordHint="Add the current P, V, T, n and Z"
    />
  );

  const settings = (
    <>
      <PopoverSection title="Units" testId="settings-units">
        <MiniSwitch large options={[{ id: "ib", label: "kPa, dm\u00b3", title: "IB data booklet units" }, { id: "atm", label: "atm, L", title: "Older convention" }]} value={unitSystem} onChange={setUnitSystem} ariaLabel="Pressure and volume units" testId="unit-system" />
        <p className="sd-pop-note">Temperature is always in kelvin. R = 8.31 J K&#8315;&sup1; mol&#8315;&sup1; = 8.31 kPa dm&sup3; K&#8315;&sup1; mol&#8315;&sup1;.</p>
      </PopoverSection>
      <PopoverSection title="Standard conditions" testId="settings-presets">
        <div className="gl-presets" style={{ display: "flex", gap: 6 }}>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => handlePreset(273.15)} data-testid="preset-stp" title="STP: 273.15 K and 100 kPa, 1.00 mol, so V = 22.7 dm\u00b3 (ideal gas)">STP</button>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => handlePreset(298.15)} data-testid="preset-satp" title="SATP: 298.15 K and 100 kPa, 1.00 mol, so V = 24.8 dm\u00b3 (ideal gas)">SATP</button>
        </div>
        <p className="sd-pop-note">IB data booklet: STP = 273.15 K and 100 kPa (22.7 dm&sup3; mol&#8315;&sup1;); SATP = 298.15 K and 100 kPa. Sets n = 1.00 mol and the pressure as the controlled variable.</p>
      </PopoverSection>
      <PopoverSection title="Piston scale" testId="settings-scale">
        <MiniSwitch large options={[{ id: "25", label: "0\u201325" }, { id: "100", label: "0\u2013100" }, { id: "log", label: "Log" }]}
          value={String(display.pistonScale)} onChange={(v) => handleDisplay({ pistonScale: v === "log" ? "log" : Number(v) })} ariaLabel="Piston scale range" testId="scale-switch" />
        <p className="sd-pop-note">Linear scales draw volume in proportion to the piston height. Very small volumes stop at the bottom of the scale (the picture says so). The log scale compresses large volumes.</p>
      </PopoverSection>
      <PopoverSection title="Particle picture" testId="settings-display">
        <SettingToggle id="ig-set-wall" label="Pressure from collisions" hint="Show how hard the particles hit the piston." checked={display.wallGauge} onChange={(wallGauge) => handleDisplay({ wallGauge })} testId="toggle-wall" />
        <SettingToggle id="ig-set-trails" label="Particle trails" hint="Show the recent path of each particle." checked={display.trails} onChange={(trails) => handleDisplay({ trails })} testId="toggle-trails" />
        <SettingToggle id="ig-set-flashes" label="Collision flashes" hint="Highlight particle-particle and particle-wall collisions." checked={display.collisions} onChange={(collisions) => handleDisplay({ collisions })} testId="toggle-collisions" />
        <SettingToggle
          id="ig-set-forces" label="Attraction lines" hint={real ? "Show the attraction between nearby particles." : "Available for Real Gas."}
          checked={display.forces && real} disabled={!real} onChange={(forces) => handleDisplay({ forces })} testId="toggle-forces"
        />
      </PopoverSection>
      <PopoverSection title="About this model">
        <p className="sd-pop-note" data-testid="model-note">
          Real gas: {GAS.name}, van der Waals (P + an&sup2;/V&sup2;)(V &minus; nb) = nRT with a = {GAS.a.toFixed(3)} L&sup2;&middot;atm/mol&sup2; and b = {GAS.b} L/mol. R is the same 8.31 J K&#8315;&sup1; mol&#8315;&sup1; in every calculation here.
          The vapour-pressure (condensation) limit is qualitative; for CO&#8322; the message quotes the literature value beside the model value. The particle picture is illustrative: 2D, about 50 particles, and the pressure on the slider comes from the model, not from counting collisions; the &ldquo;pressure from collisions&rdquo; gauge compares the two.
        </p>
      </PopoverSection>
    </>
  );

  const details = (
    <p className="sd-pop-note" style={{ marginBottom: 0 }}>
      <strong>Ideal gas:</strong> {GAS_DESCRIPTIONS.ideal} PV = nRT, so Z = PV/nRT = 1.<br />
      <strong>Real gas ({GAS.name}, {GAS.imf}):</strong> {GAS_DESCRIPTIONS.real} Z &lt; 1 where attractions dominate and Z &gt; 1 where molecular size dominates. Z &rarr; 1 as P &rarr; 0.
    </p>
  );

  return (
    <SimulationDashboard
      title="Ideal vs Real Gas"
      subtitle={`${GAS.name} in a piston`}
      role="region"
      ariaLabel="Ideal vs real gas simulation"
      onReset={handleReset}
      graphShown={showGraph}
      onGraphToggle={() => setShowGraph((g) => !g)}
      graphId="ig-real-ideal-graph"
      settings={settings}
      tabs={
        <DashboardTabs
          segmented role="radio" ariaLabel="Gas model" idPrefix="ig-gas" tabs={GAS_TABS} value={controls.mode}
          onChange={(mode) => handleControls({ mode })} testId="gas-switch"
        />
      }
      controls={<ControlsPanel controls={controls} state={readings} onChange={handleControls} units={units} onRecord={handleRecord} readingCount={readingsState.rows.length} />}
      chamber={<ChamberPanel sim={sim} state={readings} reducedMotion={reducedMotion} playing={playing} onTogglePlay={() => setPlaying((p) => !p)} units={units} showWall={display.wallGauge} />}
      graph={
        <DashPanel ariaLabel="Real vs Ideal Gas Behaviour" grow testId="graph-panel">
          <MiniSwitch fill options={[{ id: "theory", label: "Z vs P graph" }, { id: "readings", label: `My readings (${readingsState.rows.length})` }]} value={view} onChange={setView} ariaLabel="Graph source" testId="view-switch" />
          {view === "readings" ? <div className="min-h-0 flex-1 overflow-y-auto" data-testid="readings-view">{readingsNode}</div> : <RealIdealGraph state={readings} units={units} />}
        </DashPanel>
      }
      live={<LiveValues readings={readings} units={units} />}
      predict={<PredictPanel controls={controls} units={units} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />}
      explain={<ExplainLine text={explain.text} details={details} />}
    />
  );
}
