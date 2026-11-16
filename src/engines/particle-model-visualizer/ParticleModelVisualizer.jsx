import { useCallback, useMemo, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ParticleChamber from "./components/ParticleChamber.jsx";
import ChamberWalls from "./components/ChamberWalls.jsx";
import ParticleSystem from "./components/ParticleSystem.jsx";
import StateSelector from "./components/StateSelector.jsx";
import ControlBar from "./components/ControlBar.jsx";
import PropertiesPanel from "./components/PropertiesPanel.jsx";
import { PALETTE } from "./data/palette.js";
import { useReducedMotion } from "./useReducedMotion.js";
import { MODEL_TB, MODEL_TM, SIGMA_REF, T_MAX, T_MIN, T_REF, autoState } from "../../lib/particles/particleCore.js";
import "./particle-model.css";

const FALLBACK_DESCRIPTION =
  "A 3D chamber shows 96 identical particles. In a solid they sit in a close-packed lattice and vibrate; in a liquid they are touching but slide past each other; in a gas they are far apart and collide with each other and the walls. The temperature slider sets their average kinetic energy.";

const STATE_TEXT = {
  solid: "arranged in an ordered, close-packed lattice and vibrating about fixed positions",
  liquid: "close together but disordered, sliding past one another at the bottom of the chamber",
  gas: "far apart, moving rapidly in straight lines and colliding with each other and with the walls",
};

// The mode-agnostic orchestrator, reachable from /interactives directly and embeddable inside a lesson via the "e-Lab Simulation"
// content block. ONE particle set (src/lib/particles/particleCore.js, shared with Explore Matter & States): the same 96 particles are
// in every state; the state selector changes the forces, the temperature slider changes the average kinetic energy (IB S1.1.3), and
// "Let temperature decide" makes the state follow T (illustrative melting / boiling points 273 K and 373 K).
export default function ParticleModelVisualizer({ compact = false, standalone = false }) {
  const [state, setState] = useState("solid");
  const [running, setRunning] = useState(true);
  const [showAttractions, setShowAttractions] = useState(false);
  const [temperature, setTemperature] = useState(T_REF);
  const [follow, setFollow] = useState(false);
  const [stats, setStats] = useState(null);
  const reducedMotion = useReducedMotion();
  const chamberRef = useRef(null);

  const shownState = follow ? autoState(temperature) : state;
  const relKE = stats ? stats.meanKE / (1.5 * SIGMA_REF * SIGMA_REF) : temperature / T_REF;
  const label = `3D chamber with 96 identical particles in the ${shownState} state at ${Math.round(temperature)} kelvin (${Math.round(temperature - 273.15)} degrees Celsius): ${STATE_TEXT[shownState]}.`;

  const onStats = useCallback((s) => setStats(s), []);
  const handleState = (s) => { setFollow(false); setState(s); };
  const handleReset = () => { chamberRef.current?.reset(); setTemperature(T_REF); setFollow(false); setState("solid"); setRunning(true); setShowAttractions(false); };
  const keBar = useMemo(() => Math.max(0.03, Math.min(1, relKE / (T_MAX / T_REF))), [relKE]);

  const body = (
    <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: PALETTE.border, background: PALETTE.bg }}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: PALETTE.eyebrow }}>Particle Model</p>
        <StateSelector state={shownState} onChange={handleState} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex flex-col gap-2.5 lg:w-[67%]">
          <ParticleChamber ref={chamberRef} height={compact ? 340 : 420} fallbackDescription={FALLBACK_DESCRIPTION} label={label}>
            <ChamberWalls />
            <ParticleSystem state={shownState} running={running} showAttractions={showAttractions} temperature={temperature} reducedMotion={reducedMotion} onStats={onStats} />
          </ParticleChamber>
          <p className="sr-only" role="status" aria-live="polite" data-testid="chamber-status">{label}</p>

          <div className="pm-temp sim-surface-dark" data-testid="temperature-control">
            <div className="pm-temp-top">
              <label htmlFor="pm-temperature" className="pm-temp-label">Temperature</label>
              <output htmlFor="pm-temperature" className="pm-temp-value" data-testid="temperature-value">{Math.round(temperature)} K ({Math.round(temperature - 273.15)} &deg;C)</output>
            </div>
            <input
              id="pm-temperature" type="range" min={T_MIN} max={T_MAX} step={1} value={temperature} className="pm-range"
              onChange={(e) => setTemperature(Number(e.target.value))} data-testid="temperature-slider"
              aria-valuetext={`${Math.round(temperature)} kelvin, ${Math.round(temperature - 273.15)} degrees Celsius`}
              style={{ "--pm-fill": `${((temperature - T_MIN) / (T_MAX - T_MIN)) * 100}%` }}
            />
            <div className="pm-ke" aria-hidden="true"><span className="pm-ke-fill" style={{ width: `${keBar * 100}%` }} /></div>
            <p className="pm-ke-text" data-testid="ke-readout">
              Average kinetic energy: <b>{relKE.toFixed(2)}&times;</b> the value at 300 K. It is proportional to the temperature in kelvin, in every state.
            </p>
            <label className="pm-follow">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} data-testid="follow-temperature" />
              Let temperature decide the state (illustrative: solid below {MODEL_TM} K, gas above {MODEL_TB} K)
            </label>
          </div>

          <ControlBar
            running={running}
            onToggleRunning={() => setRunning((r) => !r)}
            showAttractions={showAttractions}
            onToggleAttractions={() => setShowAttractions((v) => !v)}
            onReset={handleReset}
            onRotate={(a, p) => chamberRef.current?.rotate(a, p)}
            onZoom={(f) => chamberRef.current?.zoom(f)}
          />
        </div>

        <div className="lg:w-[33%]">
          <PropertiesPanel state={shownState} />
        </div>
      </div>
    </div>
  );

  return (
    <InteractiveFrame
      title="Particle Model of Solids, Liquids & Gases"
      subtitle="Switch state and change the temperature to see how arrangement, movement and kinetic energy change."
      compact={compact}
      standalone={standalone}
      simulationId="particle-model-visualizer"
    >
      {body}
    </InteractiveFrame>
  );
}
