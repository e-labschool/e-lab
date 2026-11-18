import { useRef, useState } from "react";
import { FlaskConical, Gamepad2, Network, Orbit, RotateCcw, Trophy } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationActions from "../../components/interactive-shell/SimulationActions.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { useSimulationSessionState } from "../../components/interactive-shell/simulationSession.js";
import "../../components/simulation/SimulationDashboard.css"; // frame (.sd-frame*) rules shared by every dashboard-framed simulation
import useReducedMotion from "../shared-3d/useReducedMotion.js";
import { useElementSize, useIsDark, layoutClass } from "../mole-lab/ui/hooks.js";
import TugTab from "./ui/TugTab.jsx";
import BondTab from "./ui/BondTab.jsx";
import MoleculeTab from "./ui/MoleculeTab.jsx";
import ChallengeTab from "./ui/ChallengeTab.jsx";
import "./PolarityPlayground.css";

// POLARITY PLAYGROUND (IB DP Chemistry S2.2.5 bond polarity, S2.2.6 molecular polarity). Four tabs in one row. The chemistry lives in
// ./model (pure, tested) and in the shared electron-cloud module (src/engines/shared-3d/electronCloud); scenes and tabs only present it.
// Architecture, scientific decisions and limitations: docs/POLARITY_PLAYGROUND.md.
const TABS = [
  { id: "tug", label: "Game", long: "Electron Tug-of-War", icon: Gamepad2 },
  { id: "bond", label: "Inside a Covalent Bond", icon: Network },
  { id: "molecule", label: "Molecular Polarity", icon: Orbit },
  { id: "challenge", label: "Polarity Challenge", icon: Trophy },
];
const VIEWS = { tug: TugTab, bond: BondTab, molecule: MoleculeTab, challenge: ChallengeTab };

function Shell() {
  const { frameRef, simulationId, isViewport } = useSimulationPresentation();
  const rootRef = useRef(null); const size = useElementSize(rootRef); const layout = layoutClass(size.width);
  const reduced = useReducedMotion(); const dark = useIsDark();
  const [tab, setTab] = useSimulationSessionState("tab", "tug", (v) => !!VIEWS[v]);
  const [nonce, setNonce] = useState(0);
  const View = VIEWS[tab];
  const go = (i, d) => { const n = TABS[(i + d + TABS.length) % TABS.length].id; setTab(n); requestAnimationFrame(() => document.getElementById(`pp-tab-${n}`)?.focus()); };
  return (
    <div ref={rootRef} className="pp-root elab-sim" data-testid="polarity-playground" data-layout={layout} data-theme={dark ? "dark" : "light"} data-viewport={isViewport ? "1" : "0"} data-tab={tab}>
      <header className="pp-header">
        <div className="pp-brand"><span className="pp-logo" aria-hidden="true"><FlaskConical size={18} /></span><div><h2 className="pp-title">Polarity Playground</h2><p className="pp-sub">S2.2.5 – S2.2.6 · bond and molecular polarity</p></div></div>
        <nav className="pp-tabs" role="tablist" aria-label="Polarity Playground tabs" data-testid="pp-tabs">
          {TABS.map((t, i) => { const Icon = t.icon; return (
            <button key={t.id} type="button" role="tab" id={`pp-tab-${t.id}`} aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} className={"pp-tab" + (tab === t.id ? " is-on" : "")} data-testid={`tab-btn-${t.id}`} title={t.long ?? t.label}
              onClick={() => setTab(t.id)} onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); go(i, 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(i, -1); } else if (e.key === "Home") { e.preventDefault(); go(i, -i); } else if (e.key === "End") { e.preventDefault(); go(i, TABS.length - 1 - i); } }}>
              <Icon size={16} aria-hidden="true" /><span>{t.label}</span>
            </button>); })}
        </nav>
        <div className="pp-actions">
          <button type="button" className="pp-iconbtn" onClick={() => setNonce((n) => n + 1)} data-testid="pp-reset" title="Reset this tab" aria-label="Reset this tab"><RotateCcw size={15} aria-hidden="true" /></button>
          <SimulationActions targetRef={frameRef} simulationId={simulationId} iconOnly />
        </div>
      </header>
      <main className="pp-body"><View key={`${tab}-${nonce}`} reduced={reduced} /></main>
    </div>
  );
}

// Registered under the id "polarity-playground"; the title MUST equal the catalogue label (InteractiveFrame resolves "Open in New Tab" from it).
export default function PolarityPlayground({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Polarity Playground" subtitle="Electronegativity, bond polarity and molecular polarity in four tabs" compact={compact} standalone={standalone} dashboard>
      <Shell />
    </InteractiveFrame>
  );
}
