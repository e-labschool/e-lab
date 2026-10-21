import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { DEFAULT_CONTROLS, DEFAULT_DISPLAY, computeReadings, createSimulation } from "./model.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./IdealGasSimulation.css";
import ControlsPanel from "./components/ControlsPanel.jsx";
import GasCanvas from "./components/GasCanvas.jsx";
import ReadingsPanel from "./components/ReadingsPanel.jsx";

// Ideal Gas Simulation (IB DP Chemistry S1.5.1-S1.5.3). React owns the
// controls; the pure model (model.js) owns the physics and the scaling
// convention; render.js draws it. The pressure readout comes from the model's
// formulas (PV = nRT / van der Waals), not from counting animated collisions.
const WIDE_MIN_WIDTH = 820; // container width at which the 3-column layout is used

export default function IdealGasSimulation({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame
      title="Ideal Gas Simulation"
      subtitle="Pressure, temperature, volume and amount of gas - ideal and real"
      compact={compact}
      standalone={standalone}
    >
      <IdealGasWorkspace />
    </InteractiveFrame>
  );
}

function IdealGasWorkspace() {
  const { isViewport } = useSimulationPresentation();
  const reducedMotion = useReducedMotion();
  const [sim] = useState(() => createSimulation({ seed: (Math.random() * 2 ** 32) >>> 0 }));
  const [controls, setControls] = useState({ ...DEFAULT_CONTROLS });
  const [display, setDisplay] = useState({ ...DEFAULT_DISPLAY });
  const [playing, setPlaying] = useState(true);
  const rootRef = useRef(null);
  const [wide, setWide] = useState(false);

  // Layout follows the container's own width (works in a narrow Learn column
  // as well as full screen), measured before first paint.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => setWide(el.getBoundingClientRect().width >= WIDE_MIN_WIDTH);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  useEffect(() => { sim.setControls(controls); }, [sim, controls]);
  useEffect(() => { sim.setDisplay(display); }, [sim, display]);
  useEffect(() => { sim.setPaused(!playing); }, [sim, playing]);
  useEffect(() => { sim.setInstant(reducedMotion); }, [sim, reducedMotion]);

  const readings = useMemo(() => computeReadings(controls), [controls]);

  const handleControls = useCallback((patch) => setControls((c) => ({ ...c, ...patch })), []);
  const handleDisplay = useCallback((patch) => setDisplay((d) => ({ ...d, ...patch })), []);
  const handleReset = useCallback(() => {
    sim.reset();
    setControls({ ...DEFAULT_CONTROLS });
    setDisplay({ ...DEFAULT_DISPLAY });
    setPlaying(true);
  }, [sim]);

  const canvasLabel = `Gas cylinder with ${controls.N} particles, ${controls.T} kelvin, ${controls.V} litres, ${controls.mode === "real" ? "real" : "ideal"} gas`;

  const canvasPanel = (
    <section
      aria-label="Gas chamber"
      className={
        "relative min-h-0 min-w-0 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_25%,#FFFFFF_0%,#F1F7FF_65%,#E8F0FB_100%)] " +
        (isViewport && wide ? "h-full" : wide ? "h-[540px]" : "h-[400px] sm:h-[460px]")
      }
    >
      <GasCanvas sim={sim} reducedMotion={reducedMotion} label={canvasLabel} />
    </section>
  );

  const controlsPanel = <ControlsPanel controls={controls} onChange={handleControls} />;
  const readingsPanel = (
    <ReadingsPanel
      readings={readings}
      display={display}
      onDisplayChange={handleDisplay}
      playing={playing}
      onTogglePlay={() => setPlaying((p) => !p)}
      onReset={handleReset}
    />
  );

  const shell = "rounded-2xl border border-[#DAE5F7] bg-[linear-gradient(180deg,#FFFFFF,#EEF5FF)] p-2.5 text-[#1E2A44] sm:p-3 [color-scheme:light]";

  if (isViewport && wide) {
    return (
      <div ref={rootRef} className={shell + " relative grid h-full min-h-0 grid-cols-[272px_minmax(0,1fr)_270px] grid-rows-[minmax(0,1fr)] gap-2.5"}>
        <div className="min-h-0 overflow-y-auto">{controlsPanel}</div>
        {canvasPanel}
        <div className="min-h-0 overflow-y-auto">{readingsPanel}</div>
      </div>
    );
  }
  return (
    <div
      ref={rootRef}
      className={shell + " grid gap-3 " + (wide ? "grid-cols-[236px_minmax(0,1fr)_248px] items-start" : "grid-cols-1")}
    >
      {controlsPanel}
      {canvasPanel}
      {readingsPanel}
    </div>
  );
}
