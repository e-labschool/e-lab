import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Sparkles, Spline, Waypoints } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { ChamberToolbar, DashPanel, DashboardTabs, ToolButton } from "../../components/simulation/SimulationDashboard.jsx";
import { DEFAULT_CONTROLS, DEFAULT_DISPLAY, applyControlChange, createSimulation, resolveState, selectExplanation } from "./model.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./IdealGasSimulation.css";
import ControlsPanel from "./components/ControlsPanel.jsx";
import { GAS_DESCRIPTIONS } from "./gasDescriptions.js";
import GasCanvas from "./components/GasCanvas.jsx";
import RealIdealGraph from "./components/RealIdealGraph.jsx";
import ComparisonPanel from "./components/ComparisonPanel.jsx";
import { LiveValues, PredictPanel } from "./components/LiveAndPredict.jsx";
import WhatIsHappening from "./components/WhatIsHappening.jsx";

// Ideal Gas Simulation (IB DP Chemistry S1.5.1-S1.5.3). React owns the
// controls; the pure model (model.js) owns the physics and the scaling
// convention; render.js draws it. The pressure readout comes from the model's
// formulas (PV = nRT / van der Waals), not from counting animated collisions.
//
// LAYOUT: rendered with the shared Simulation Dashboard Layout
// (components/simulation/SimulationDashboard.jsx): Controls | Chamber | Z-vs-P
// graph, with Live values | Predict & Reveal | What Is Happening? underneath.
// This file only arranges the existing parts; no physics lives here.
const EXPLAIN_DEBOUNCE_MS = 250; // message reflects the latest settled change

const GAS_TABS = [
  { id: "ideal", label: "Ideal gas", title: GAS_DESCRIPTIONS.ideal },
  { id: "real", label: "Real gas", title: GAS_DESCRIPTIONS.real },
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

  useEffect(() => { sim.setControls(controls); }, [sim, controls]);
  useEffect(() => { sim.setDisplay(display); }, [sim, display]);
  useEffect(() => { sim.setPaused(!playing); }, [sim, playing]);
  useEffect(() => { sim.setInstant(reducedMotion); }, [sim, reducedMotion]);

  const readings = useMemo(() => resolveState(controls), [controls]);

  // "What Is Happening?": diff the last SETTLED controls against the current
  // ones after a short debounce; null result = nothing relevant, keep message.
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
  const canvasLabel = `Gas cylinder with ${controls.N} particles, ${controls.T} kelvin, ${readings.V.toFixed(1)} litres, ${real ? "real" : "ideal"} gas`;

  const chamber = (
    <>
      <DashPanel ariaLabel="Gas chamber" grow noBody className="!p-1.5">
        <div className="sd-chamber" data-testid="chamber">
          <GasCanvas sim={sim} reducedMotion={reducedMotion} label={canvasLabel} />
        </div>
        <ChamberToolbar>
          <ToolButton
            primary testId="play-pause" onClick={() => setPlaying((p) => !p)}
            icon={playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            label={playing ? "Pause" : "Play"} title={playing ? "Pause simulation" : "Play simulation"}
          />
          <ToolButton
            testId="toggle-trails" pressed={display.trails} onClick={() => handleDisplay({ trails: !display.trails })}
            icon={<Spline size={14} aria-hidden="true" />} label="Trails" title="Show particle trails: the paths of moving particles"
          />
          <ToolButton
            testId="toggle-collisions" pressed={display.collisions} onClick={() => handleDisplay({ collisions: !display.collisions })}
            icon={<Sparkles size={14} aria-hidden="true" />} label="Flashes" title="Show collision flashes: highlights particle-particle and particle-wall collisions"
          />
          <ToolButton
            testId="toggle-forces" pressed={display.forces && real} disabled={!real}
            onClick={() => handleDisplay({ forces: !display.forces })}
            icon={<Waypoints size={14} aria-hidden="true" />} label="Forces"
            title={real ? "Show intermolecular forces: attractions between nearby particles" : "Intermolecular forces: available in Real gas mode"}
          />
        </ChamberToolbar>
      </DashPanel>
      <ComparisonPanel comparison={readings.comparison} real={real} />
    </>
  );

  return (
    <SimulationDashboard
      title="Ideal Gas Simulation"
      subtitle="Ideal and real gases: P, V, T and n"
      role="region"
      ariaLabel="Ideal gas simulation"
      onReset={handleReset}
      tabs={
        <DashboardTabs
          segmented role="radio" ariaLabel="Gas type" idPrefix="ig-gas" tabs={GAS_TABS} value={controls.mode}
          onChange={(mode) => handleControls({ mode })}
        />
      }
      controls={<ControlsPanel controls={controls} state={readings} onChange={handleControls} />}
      chamber={chamber}
      graph={
        <DashPanel ariaLabel="Real vs Ideal Gas Behaviour" grow noBody testId="graph-panel" id="ig-real-ideal-graph">
          <RealIdealGraph state={readings} />
        </DashPanel>
      }
      live={<LiveValues readings={readings} />}
      predict={<PredictPanel controls={controls} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />}
      explain={<WhatIsHappening text={explain.text} />}
    />
  );
}
