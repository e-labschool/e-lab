import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Settings2 } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationActions from "../../components/interactive-shell/SimulationActions.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import "../../components/simulation/SimulationDashboard.css"; // frame (.sd-frame*) rules shared by every dashboard-framed simulation
import useReducedMotion from "../shared-3d/useReducedMotion.js";
import { isSoftwareGL, detectWebGL } from "../shared-3d/webgl.js";
import { chooseDetail, lowerDetail, DETAIL_LEVELS } from "./engine/particles.js";
import { STAGES } from "./stages.js";
import { useElementSize, useIsDark, layoutClass } from "./ui/hooks.js";
import { Reference } from "./ui/parts.jsx";
import Stage1 from "./ui/stages/Stage1.jsx";
import Stage2 from "./ui/stages/Stage2.jsx";
import Stage3 from "./ui/stages/Stage3.jsx";
import Stage4 from "./ui/stages/Stage4.jsx";
import Stage5 from "./ui/stages/Stage5.jsx";
import Stage6 from "./ui/stages/Stage6.jsx";
import "./MoleLab.css";

// MOLE LAB (redesigned): one realistic bench, ONE standard one-mole packet, six stages.  Chemistry comes from engine/ (pure, tested);
// the scene and the controls only present it.  Architecture: docs/MOLE_LAB.md.  Visual references: docs/mole-lab-reference/.

function deviceDetail(reduced, small) {
  let soft = false; try { soft = detectWebGL() && isSoftwareGL(); } catch { soft = false; }
  const nav = typeof navigator !== "undefined" ? navigator : {};
  return chooseDetail({ softwareGL: soft, deviceMemory: nav.deviceMemory ?? 8, cores: nav.hardwareConcurrency ?? 4, reducedMotion: reduced, small });
}
const STAGE_VIEWS = { 1: Stage1, 2: Stage2, 3: Stage3, 4: Stage4, 5: Stage5, 6: Stage6 };

function Shell() {
  const { isViewport, frameRef, simulationId } = useSimulationPresentation();
  const rootRef = useRef(null);
  const size = useElementSize(rootRef); const layout = layoutClass(size.width);
  const reduced = useReducedMotion(); const dark = useIsDark();
  const [stage, setStage] = useState(1);
  const [detailPref, setDetailPref] = useState("auto"); const [autoDetail, setAutoDetail] = useState(() => deviceDetail(reduced, size.width < 640));
  const detail = detailPref === "auto" ? autoDetail : detailPref;
  const onSlow = useCallback(() => setAutoDetail((d) => lowerDetail(d)), []);
  const [resetNonce, setResetNonce] = useState(0);
  const [showRef, setShowRef] = useState(false);
  const debug = useRef({});
  useEffect(() => {
    const el = rootRef.current; if (!el) return undefined;
    el.__moleLab = { get stage() { return stage; }, setStage, get detail() { return detail; }, debug: debug.current };
    return () => { delete el.__moleLab; };
  });
  const shell = useMemo(() => ({ layout, reduced, dark, detail, onSlow, debug }), [layout, reduced, dark, detail, onSlow]);
  const View = STAGE_VIEWS[stage];
  return (
    <div ref={rootRef} className="ml-root elab-sim" data-testid="mole-lab" data-layout={layout} data-viewport={isViewport ? "1" : "0"} data-theme={dark ? "dark" : "light"} data-stage={stage} data-detail={detail} data-reduced={reduced ? "1" : "0"} role="region" aria-label="Mole Lab">
      <header className="ml-header">
        <div className="ml-title-block"><h2 className="ml-title">Mole Lab</h2><p className="ml-subtitle">The Mole in Action</p></div>
        <nav className="ml-tabs" role="tablist" aria-label="Mole Lab stages" data-testid="ml-tabs">
          {STAGES.map((s) => (
            <button key={s.id} type="button" role="tab" id={`ml-tab-${s.id}`} aria-selected={stage === s.id} aria-controls="ml-panel" tabIndex={stage === s.id ? 0 : -1} className={"ml-tab" + (stage === s.id ? " is-on" : "")}
              onClick={() => setStage(s.id)} data-testid={`ml-tab-${s.id}`} title={s.purpose}
              onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = Math.min(6, Math.max(1, s.id + (e.key === "ArrowRight" ? 1 : -1))); setStage(n); document.getElementById(`ml-tab-${n}`)?.focus(); } }}>
              <span className="ml-tab-n">{s.id}</span><span className="ml-tab-t">{s.short}</span>
            </button>
          ))}
        </nav>
        <div className="ml-actions">
          <button type="button" className="sim-btn" aria-expanded={showRef} onClick={() => setShowRef((v) => !v)} data-testid="ml-info" title="What is a mole?"><span aria-hidden="true">i</span><span className="ml-sr"> What is a mole?</span></button>
          <details className="ml-settings"><summary className="sim-btn" aria-label="Settings" title="Settings"><Settings2 size={14} aria-hidden="true" /></summary>
            <div className="ml-settings-pop">
              <label className="ml-field"><span className="ml-label">Graphics detail</span>
                <select className="ml-select" value={detailPref} onChange={(e) => setDetailPref(e.target.value)} data-testid="ml-detail">
                  <option value="auto">Automatic ({autoDetail})</option>{DETAIL_LEVELS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}</select></label>
              <p className="ml-hint">Lower detail draws fewer representative particles; the amounts never change.</p>
            </div></details>
          <button type="button" className="sim-btn" onClick={() => setResetNonce((n) => n + 1)} data-testid="ml-reset" title="Reset this stage"><RotateCcw size={14} aria-hidden="true" /><span className="ml-sr"> Reset</span></button>
          <SimulationActions targetRef={frameRef} simulationId={simulationId} iconOnly />
        </div>
      </header>
      {showRef && stage !== 1 && <div className="ml-ref-pop"><Reference inline /></div>}
      <main id="ml-panel" role="tabpanel" aria-labelledby={`ml-tab-${stage}`} className="ml-panel">
        <View key={`${stage}-${resetNonce}`} shell={shell} />
      </main>
    </div>
  );
}

// Registered under the id "mole-lab"; the title MUST equal the catalogue label (InteractiveFrame resolves "Open in New Tab" from it).
export default function MoleLab({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Mole Lab" subtitle="The mole in action: counting, mass, concentration, gas volume and reactions" compact={compact} standalone={standalone} dashboard>
      <Shell />
    </InteractiveFrame>
  );
}
