import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Settings2 } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationActions from "../../components/interactive-shell/SimulationActions.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import "../../components/simulation/SimulationDashboard.css"; // frame (.sd-frame*) rules shared by every dashboard-framed simulation
import useReducedMotion from "../shared-3d/useReducedMotion.js";
import { isSoftwareGL, detectWebGL } from "../shared-3d/webgl.js";
import { chooseDetail, lowerDetail, DETAIL_LEVELS } from "./engine/particles.js";
import { isStageBuilt } from "./engine/store.js";
import { STAGES } from "./stages.js";
import { useMoleStore } from "./ui/useMoleStore.js";
import { useElementSize, useIsDark, layoutClass } from "./ui/hooks.js";
import { Segmented, MODE_OPTIONS } from "./ui/parts.jsx";
import Stage1 from "./ui/Stage1.jsx";
import Stage2 from "./ui/Stage2.jsx";
import Stage3 from "./ui/Stage3.jsx";
import Stage4 from "./ui/stages/Stage4.jsx";
import Stage5 from "./ui/stages/Stage5.jsx";
import Stage6 from "./ui/stages/Stage6.jsx";
import PendingStage from "./ui/PendingStage.jsx";
import "./MoleLab.css";

// MOLE LAB -- the mole as ONE fixed counting packet, shared by six stages.  Phase 1 builds Stage 1 and Stage 2; stages 3-6 are
// labelled placeholders until the next build.  Architecture and the engine API: docs/MOLE_LAB.md.
//
// State: ONE reducer-style store (engine/store.js) held by useMoleStore().  The stage components, the 3D scene and the
// calculation panels only READ it (through engine/selectors.js) and change it by dispatching actions.

function deviceDetail(reduced, small) {
  let soft = false; try { soft = detectWebGL() && isSoftwareGL(); } catch { soft = false; }
  const nav = typeof navigator !== "undefined" ? navigator : {};
  return chooseDetail({ softwareGL: soft, deviceMemory: nav.deviceMemory ?? 8, cores: nav.hardwareConcurrency ?? 4, reducedMotion: reduced, small });
}

function Shell() {
  const store = useMoleStore();
  const { state, dispatch, getState } = store;
  const { isViewport, frameRef, simulationId } = useSimulationPresentation();
  const rootRef = useRef(null);
  const size = useElementSize(rootRef); const layout = layoutClass(size.width);
  const reduced = useReducedMotion(); const dark = useIsDark();
  const [detailPref, setDetailPref] = useState("auto"); const [autoDetail, setAutoDetail] = useState(() => deviceDetail(reduced, size.width < 640));
  const detail = detailPref === "auto" ? autoDetail : detailPref;
  const onSlow = useCallback(() => setAutoDetail((d) => lowerDetail(d)), []);
  const [resetNonce, setResetNonce] = useState(0);
  const debug = useRef({});
  const stageDef = STAGES.find((s) => s.id === state.stage);
  useEffect(() => {
    const el = rootRef.current; if (!el) return undefined;
    el.__moleLab = { getState, dispatch, get ix() { return debug.current.ix; }, get detail() { return detail; } };
    return () => { delete el.__moleLab; };
  });

  const shell = useMemo(() => ({ layout, reduced, dark, detail, onSlow, mode: state.mode, resetNonce, debug }), [layout, reduced, dark, detail, onSlow, state.mode, resetNonce]);

  return (
    <div ref={rootRef} className="ml-root elab-sim" data-testid="mole-lab" data-layout={layout} data-viewport={isViewport ? "1" : "0"} data-theme={dark ? "dark" : "light"} data-stage={state.stage} data-mode={state.mode} data-detail={detail} data-reduced={reduced ? "1" : "0"} role="region" aria-label="Mole Lab">
      <header className="ml-header">
        <div className="ml-title-block"><h2 className="ml-title">Mole Lab</h2><p className="ml-subtitle">The mole in action</p></div>
        <nav className="ml-tabs" role="tablist" aria-label="Mole Lab stages" data-testid="ml-tabs">
          {STAGES.map((s) => (
            <button key={s.id} type="button" role="tab" id={`ml-tab-${s.id}`} aria-selected={state.stage === s.id} aria-controls="ml-panel" tabIndex={state.stage === s.id ? 0 : -1} className={"ml-tab" + (state.stage === s.id ? " is-on" : "") + (isStageBuilt(s.id) ? "" : " is-pending")}
              onClick={() => dispatch({ type: "stage/set", stage: s.id })} data-testid={`ml-tab-${s.id}`} title={isStageBuilt(s.id) ? s.purpose : `${s.title}: coming in the next build`}
              onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = Math.min(6, Math.max(1, s.id + (e.key === "ArrowRight" ? 1 : -1))); dispatch({ type: "stage/set", stage: n }); document.getElementById(`ml-tab-${n}`)?.focus(); } }}>
              <span className="ml-tab-n">{s.id}</span><span className="ml-tab-t">{s.short}</span>{!isStageBuilt(s.id) && <span className="ml-tab-soon">soon</span>}
            </button>
          ))}
        </nav>
        <div className="ml-actions">
          <Segmented compact label="Mode" value={state.mode} onChange={(v) => dispatch({ type: "mode/set", mode: v })} options={MODE_OPTIONS} testId="ml-mode" />
          <details className="ml-settings"><summary className="sim-btn" aria-label="Settings" title="Settings"><Settings2 size={14} aria-hidden="true" /><span className="ml-hide-narrow"> Settings</span></summary>
            <div className="ml-settings-pop">
              <label className="ml-field"><span className="ml-label">Graphics detail</span>
                <select className="ml-select" value={detailPref} onChange={(e) => setDetailPref(e.target.value)} data-testid="ml-detail">
                  <option value="auto">Automatic ({autoDetail})</option>{DETAIL_LEVELS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}</select></label>
              <p className="ml-hint">Lower detail draws fewer representative particles; the amounts never change.</p>
            </div></details>
          <button type="button" className="sim-btn" onClick={() => { setResetNonce((n) => n + 1); dispatch({ type: "reset", stage: state.stage }); }} data-testid="ml-reset" title="Reset this stage to its starting state"><RotateCcw size={14} aria-hidden="true" /><span className="ml-hide-narrow"> Reset</span></button>
          <SimulationActions targetRef={frameRef} simulationId={simulationId} iconOnly />
        </div>
      </header>
      <main id="ml-panel" role="tabpanel" aria-labelledby={`ml-tab-${state.stage}`} className="ml-panel">
        {state.stage === 1 && <Stage1 key="s1" store={store} shell={shell} />}
        {state.stage === 2 && <Stage2 key="s2" store={store} shell={shell} />}
        {state.stage === 3 && <Stage3 key="s3" store={store} shell={shell} />}
        {state.stage === 4 && <Stage4 key="s4" store={store} shell={shell} />}
        {state.stage === 5 && <Stage5 key="s5" store={store} shell={shell} />}
        {state.stage === 6 && <Stage6 key="s6" store={store} shell={shell} />}
        {!isStageBuilt(state.stage) && <PendingStage layout={layout} stage={stageDef} />}
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
