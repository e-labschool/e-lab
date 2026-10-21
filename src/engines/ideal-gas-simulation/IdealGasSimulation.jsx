import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { ChevronDown, ChevronUp, LineChart } from "lucide-react";
import { DEFAULT_CONTROLS, DEFAULT_DISPLAY, applyControlChange, createSimulation, resolveState, selectExplanation } from "./model.js";
import { useReducedMotion } from "./useReducedMotion.js";
import "./IdealGasSimulation.css";
import ControlsPanel from "./components/ControlsPanel.jsx";
import GasCanvas from "./components/GasCanvas.jsx";
import RealIdealGraph from "./components/RealIdealGraph.jsx";
import ReadingsPanel from "./components/ReadingsPanel.jsx";
import WhatIsHappening from "./components/WhatIsHappening.jsx";

// Ideal Gas Simulation (IB DP Chemistry S1.5.1-S1.5.3). React owns the
// controls; the pure model (model.js) owns the physics and the scaling
// convention; render.js draws it. The pressure readout comes from the model's
// formulas (PV = nRT / van der Waals), not from counting animated collisions.
const EXPLAIN_DEBOUNCE_MS = 250; // message reflects the latest settled change
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
  const graphPanelRef = useRef(null);
  // Graph UI state lives HERE (not in the graph) so collapsing it never touches
  // the simulation. Main Reset collapses the graph (original default state).
  const [graphOpen, setGraphOpen] = useState(false);
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
    setGraphOpen(false);
  }, [sim]);

  const canvasLabel = `Gas cylinder with ${controls.N} particles, ${controls.T} kelvin, ${readings.V.toFixed(1)} litres, ${controls.mode === "real" ? "real" : "ideal"} gas`;

  useEffect(() => {
    if (!graphOpen) return;
    const id = requestAnimationFrame(() => {
      graphPanelRef.current?.scrollIntoView?.({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [graphOpen, reducedMotion]);

  const dense = isViewport && wide;
  const canvasPanel = (
    <div className={"flex min-h-0 min-w-0 flex-col " + (dense ? "h-full gap-2" : "gap-3")}>
      <section
        aria-label="Gas chamber"
        className={
          "relative min-h-0 min-w-0 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_25%,#FFFFFF_0%,#F1F7FF_65%,#E8F0FB_100%)] " +
          (dense ? "flex-1" : wide ? "h-[500px]" : "h-[380px] sm:h-[440px]")
        }
      >
        <GasCanvas sim={sim} reducedMotion={reducedMotion} label={canvasLabel} />
      </section>
      <WhatIsHappening text={explain.text} dense={dense} />
    </div>
  );

  const controlsPanel = <ControlsPanel controls={controls} state={readings} onChange={handleControls} dense={dense} />;
  const readingsPanel = (
    <ReadingsPanel
      readings={readings}
      display={display}
      onDisplayChange={handleDisplay}
      playing={playing}
      onTogglePlay={() => setPlaying((p) => !p)}
      onReset={handleReset}
      dense={dense}
    />
  );

  const shell = "rounded-2xl border border-[#DAE5F7] bg-[linear-gradient(180deg,#FFFFFF,#EEF5FF)] p-2.5 text-[#1E2A44] sm:p-3 [color-scheme:light]";
  const panelCls = "rounded-2xl border border-[#E3EAF6] bg-white/90 shadow-[0_2px_10px_rgba(60,90,150,0.07)]";

  const toggleBar = (
    <div className="flex shrink-0 justify-center">
      <button
        type="button"
        onClick={() => setGraphOpen((o) => !o)}
        aria-expanded={graphOpen}
        aria-controls="ig-real-ideal-graph"
        data-testid="graph-toggle"
        className="inline-flex items-center gap-2 rounded-xl border border-[#D5DEEF] bg-white px-4 py-1.5 text-[13.5px] font-semibold text-[#14226B] shadow-sm hover:bg-[#EEF4FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5]"
      >
        <LineChart size={15} aria-hidden="true" />
        {graphOpen ? "Hide Graph" : "Show Graph"}
        {graphOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>
    </div>
  );
  const graphPanel = (
    <section
      id="ig-real-ideal-graph"
      ref={graphPanelRef}
      aria-label="Real vs Ideal Gas Behaviour"
      hidden={!graphOpen}
      className={graphOpen ? panelCls + " shrink-0 p-2.5 " + (dense ? "h-[clamp(300px,36vh,360px)]" : "") : undefined}
    >
      {graphOpen && (
        <RealIdealGraph state={readings} fillHeight={dense} />
      )}
    </section>
  );

  if (dense) {
    // Viewport modes: dashboard fills the frame. With the graph hidden nothing
    // scrolls. With it open the dashboard keeps a readable minimum height and
    // the frame's shell scrolls INSIDE itself when the viewport is too short.
    return (
      <div ref={rootRef} className={shell + " relative flex h-full min-h-0 flex-col gap-2 " + (graphOpen ? "overflow-y-auto" : "overflow-hidden")}>
        <div className={"grid min-h-0 flex-1 grid-cols-[288px_minmax(0,1fr)_270px] grid-rows-[minmax(0,1fr)] gap-2.5 " + (graphOpen ? "min-h-[570px]" : "")}>
          <div className="min-h-0">{controlsPanel}</div>
          {canvasPanel}
          <div className="min-h-0">{readingsPanel}</div>
        </div>
        {toggleBar}
        {graphPanel}
      </div>
    );
  }
  return (
    <div ref={rootRef} className={shell + " flex flex-col gap-3"}>
      <div className={"grid gap-3 " + (wide ? "grid-cols-[236px_minmax(0,1fr)_248px] items-start" : "grid-cols-1")}>
        {controlsPanel}
        {canvasPanel}
        {readingsPanel}
      </div>
      {toggleBar}
      {graphPanel}
    </div>
  );
}
