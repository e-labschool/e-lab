import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashPanel, DashboardTabs, ExplainLine, PopoverSection, SettingToggle } from "../../components/simulation/SimulationDashboard.jsx";
import { DEFAULT_CONTROLS, DEFAULT_DISPLAY, GAS, applyControlChange, createSimulation, resolveState, selectExplanation } from "./model.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./IdealGasSimulation.css";
import ControlsPanel from "./components/ControlsPanel.jsx";
import { GAS_DESCRIPTIONS } from "./gasDescriptions.js";
import ChamberPanel from "./components/ChamberPanel.jsx";
import RealIdealGraph from "./components/RealIdealGraph.jsx";
import { LiveValues, PredictPanel } from "./components/LiveAndPredict.jsx";

// Ideal vs Real Gas (IB DP Chemistry S1.5.1-S1.5.3). ONE experiment: a single CO2 sample in a piston.
// The header switch "Ideal Gas | Real Gas" changes only the gas MODEL; T, n and the controlled
// variable (and the selected Change Pressure | Change Volume control) are preserved.
// React owns the controls; the pure model (model.js) owns the physics (ideal PV = nRT, real van der
// Waals CO2); render.js draws an ILLUSTRATIVE particle picture (not molecular dynamics). The pressure
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
  const [controls, setControls] = useState({ ...DEFAULT_CONTROLS });
  const [display, setDisplay] = useState({ ...DEFAULT_DISPLAY });
  const [playing, setPlaying] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => { sim.setControls(controls); }, [sim, controls]);
  useEffect(() => { sim.setDisplay(display); }, [sim, display]);
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

  const handleControls = useCallback((patch) => setControls((c) => applyControlChange(c, patch)), []);
  const handleDisplay = useCallback((patch) => setDisplay((d) => ({ ...d, ...patch })), []);
  const handleReset = useCallback(() => {
    sim.reset();
    setControls({ ...DEFAULT_CONTROLS });
    settledRef.current = { ...DEFAULT_CONTROLS };
    setExplain(selectExplanation(null, DEFAULT_CONTROLS));
    setDisplay({ ...DEFAULT_DISPLAY });
    setPlaying(true);
    setRevealed(false);
  }, [sim]);

  const real = readings.mode === "real";

  const settings = (
    <>
      <PopoverSection title="Particle picture" testId="settings-display">
        <SettingToggle id="ig-set-trails" label="Particle trails" hint="Show the recent path of each particle." checked={display.trails} onChange={(trails) => handleDisplay({ trails })} testId="toggle-trails" />
        <SettingToggle id="ig-set-flashes" label="Collision flashes" hint="Highlight particle-particle and particle-wall collisions." checked={display.collisions} onChange={(collisions) => handleDisplay({ collisions })} testId="toggle-collisions" />
        <SettingToggle
          id="ig-set-forces" label="Attraction lines" hint={real ? "Show the attraction between nearby particles." : "Available for Real Gas."}
          checked={display.forces && real} disabled={!real} onChange={(forces) => handleDisplay({ forces })} testId="toggle-forces"
        />
      </PopoverSection>
      <PopoverSection title="About this model">
        <p className="sd-pop-note" data-testid="model-note">
          Real gas: {GAS.name}, van der Waals (P + an&sup2;/V&sup2;)(V &minus; nb) = nRT with a = {GAS.a.toFixed(3)} L&sup2;&middot;atm/mol&sup2; and b = {GAS.b} L/mol.
          The particle picture is illustrative: it is not molecular dynamics and does not set the pressure.
        </p>
      </PopoverSection>
    </>
  );

  const details = (
    <p className="sd-pop-note" style={{ marginBottom: 0 }}>
      <strong>Ideal gas:</strong> {GAS_DESCRIPTIONS.ideal} PV = nRT, so Z = PV/nRT = 1.<br />
      <strong>Real gas ({GAS.name}):</strong> {GAS_DESCRIPTIONS.real} Z &lt; 1 where attractions dominate and Z &gt; 1 where molecular size dominates. Z &rarr; 1 as P &rarr; 0.
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
      controls={<ControlsPanel controls={controls} state={readings} onChange={handleControls} />}
      chamber={<ChamberPanel sim={sim} state={readings} reducedMotion={reducedMotion} playing={playing} onTogglePlay={() => setPlaying((p) => !p)} />}
      graph={
        <DashPanel ariaLabel="Real vs Ideal Gas Behaviour" grow testId="graph-panel">
          <RealIdealGraph state={readings} />
        </DashPanel>
      }
      live={<LiveValues readings={readings} />}
      predict={<PredictPanel controls={controls} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />}
      explain={<ExplainLine text={explain.text} details={details} />}
    />
  );
}
