import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/components/interactive-shell/simulation-controls.css";
import { MolecularProcessStage, SpectrumStage, InterpretationStage, SplittingLab } from "../../src/engines/spectroscopy-studio/nmr/molecular/index.js";

// Provides the `studio` prop from local state, exactly as documented for the molecular components. NOT the real shell.
const STAGES = { process: MolecularProcessStage, spectrum: SpectrumStage, interpret: InterpretationStage, splitting: SplittingLab };
const params = new URLSearchParams(location.search);

function Harness() {
  const [stage, setStage] = useState(params.get("stage") || "process");
  const [moleculeId, setMoleculeId] = useState(params.get("mol") || "ethanol");
  const [selectedEnvId, setSelectedEnvId] = useState(null);
  const [selectedMultipletId, setSelectedMultipletId] = useState(null);
  const [operatingFrequencyMHz, setOperatingFrequencyMHz] = useState(Number(params.get("f")) || 400);
  const [mode, setMode] = useState(params.get("mode") || "student");
  const [splitView, setSplitView] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(params.get("rm") === "1");
  const [step, setStep] = useState({ n: 0, dir: 1 });
  const [resetToken, setResetToken] = useState(0);
  const holder = useRef(null);
  const [size, setSize] = useState({ width: 1000, height: 600 });
  useEffect(() => {
    const el = holder.current; const m = () => { const r = el.getBoundingClientRect(); setSize({ width: Math.round(r.width), height: Math.round(r.height) }); };
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, []);
  const b0Tesla = operatingFrequencyMHz / 42.577478;
  const studio = useMemo(() => ({ moleculeId, setMoleculeId, selectedEnvId, setSelectedEnvId, selectedMultipletId, setSelectedMultipletId, operatingFrequencyMHz, setOperatingFrequencyMHz, b0Tesla, mode, splitView, speed, playing, setPlaying, stepRequest: step, resetToken, reducedMotion, containerSize: size }),
    [moleculeId, selectedEnvId, selectedMultipletId, operatingFrequencyMHz, b0Tesla, mode, splitView, speed, playing, step, resetToken, reducedMotion, size]);
  const Stage = STAGES[stage];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 8, padding: "6px 10px", alignItems: "center", flexWrap: "wrap", fontSize: 12, borderBottom: "1px solid #2a4080" }} data-testid="harness-bar">
        {Object.keys(STAGES).map((k) => <button key={k} className="sim-btn" aria-pressed={stage === k} onClick={() => setStage(k)} data-testid={`h-stage-${k}`}>{k}</button>)}
        <label>mode <select value={mode} onChange={(e) => setMode(e.target.value)} data-testid="h-mode"><option>student</option><option>teacher</option></select></label>
        <label>speed <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} data-testid="h-speed">{[0.25, 0.5, 1, 2].map((s) => <option key={s}>{s}</option>)}</select></label>
        <button className="sim-btn" onClick={() => setPlaying((p) => !p)} aria-pressed={playing} data-testid="h-play">{playing ? "pause" : "play"}</button>
        <button className="sim-btn" onClick={() => setStep((s) => ({ n: s.n + 1, dir: -1 }))} data-testid="h-step-back">step back</button>
        <button className="sim-btn" onClick={() => setStep((s) => ({ n: s.n + 1, dir: 1 }))} data-testid="h-step-fwd">step fwd</button>
        <button className="sim-btn" onClick={() => { setResetToken((t) => t + 1); setSelectedEnvId(null); setSelectedMultipletId(null); }} data-testid="h-reset">reset</button>
        <label><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} data-testid="h-rm" /> reduced motion</label>
        <label><input type="checkbox" checked={splitView} onChange={(e) => setSplitView(e.target.checked)} /> split</label>
        <span data-testid="h-state" style={{ opacity: 0.7, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10 }}>{JSON.stringify({ moleculeId, selectedEnvId, selectedMultipletId, f: operatingFrequencyMHz, playing })}</span>
      </div>
      <div ref={holder} style={{ flex: 1, minHeight: 0, minWidth: 0 }} data-testid="harness-container"><Stage studio={studio} /></div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<StrictMode><Harness /></StrictMode>);
