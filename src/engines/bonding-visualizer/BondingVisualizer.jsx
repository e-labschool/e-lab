import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Atom, Link2, Layers } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { DashboardTabs } from "../../components/simulation/SimulationDashboard.jsx";
import { MODE_LABELS, configFromSearch, normalizeConfig } from "./model/config.js";
import IonicMode from "./components/IonicMode.jsx";
import CovalentMode from "./components/CovalentMode.jsx";
import "./BondingVisualizer.css";

// The 3D workspace (three.js) is loaded only when Metallic Bonding is opened.
const MetallicMode = lazy(() => import("./components/MetallicMode.jsx"));

// Bonding Visualizer (IB DP Chemistry S2.1 ionic, S2.2 covalent, S2.3 metallic bonding).
// ONE component, three models: Ionic | Covalent | Metallic. Each mode owns ALL of its state and is re-mounted
// (key) whenever the mode or Reset changes, so modes can never mix. Chemistry lives in ./model (pure, tested),
// geometry in ./scene (pure, tested); this file and ./components only draw and wire controls.
//
// Lesson integration: <BondingVisualizer config={{ initialMode, allowedModes }} /> -- see model/config.js.
// The standalone route also accepts ?mode=covalent&modes=ionic,covalent.
const TAB_STYLE = {
  ionic: { icon: Atom, soft: "#e8efff", border: "#c5d6fb", text: "#2c4bb0", solid: "#4a6cf7" },
  covalent: { icon: Link2, soft: "#e6f6ee", border: "#bfe5d0", text: "#1d6b45", solid: "#2f9e6b" },
  metallic: { icon: Layers, soft: "#fdf0e1", border: "#f4d3ab", text: "#9a5a12", solid: "#e08a2b" },
};
const TAB_TITLE = {
  ionic: "Electron transfer, then electrostatic attraction between ions",
  covalent: "Sharing of electron pairs between non-metal atoms",
  metallic: "Positive metal ions and delocalized electrons",
};

export default function BondingVisualizer({ compact = false, standalone = false, config }) {
  return (
    <InteractiveFrame title="Bonding Visualizer" subtitle="Ionic, covalent and metallic bonding" compact={compact} standalone={standalone} dashboard>
      <Workspace config={config} standalone={standalone} />
    </InteractiveFrame>
  );
}

function Workspace({ config, standalone }) {
  const cfg = useMemo(
    () => normalizeConfig(config ?? (standalone && typeof window !== "undefined" ? configFromSearch(window.location.search) : null)),
    [config, standalone],
  );
  const cfgKey = `${cfg.initialMode}|${cfg.allowedModes.join(",")}`;
  const [mode, setMode] = useState(cfg.initialMode);
  const [nonce, setNonce] = useState(0);
  const seen = useRef(cfgKey);
  useEffect(() => {
    if (seen.current === cfgKey) return;
    seen.current = cfgKey; // a lesson editor changed the configuration: follow it
    setMode(cfg.initialMode);
    setNonce((n) => n + 1);
  }, [cfgKey, cfg.initialMode]);

  const active = cfg.allowedModes.includes(mode) ? mode : cfg.initialMode;
  const reset = () => setNonce((n) => n + 1);
  const switchMode = (next) => { if (next === active) return; setMode(next); setNonce((n) => n + 1); };

  const tabs = (
    <DashboardTabs
      ariaLabel="Bonding model" idPrefix="bv-mode" value={active} onChange={switchMode} testId="mode-tabs"
      tabs={cfg.allowedModes.map((id) => ({ id, label: MODE_LABELS[id], title: TAB_TITLE[id], testId: `tab-${id}`, ...TAB_STYLE[id] }))}
    />
  );
  const key = `${active}-${nonce}`;
  if (active === "covalent") return <CovalentMode key={key} tabs={tabs} onReset={reset} />;
  if (active === "metallic") {
    return (
      <Suspense fallback={<div className="bv-loading" role="status">Loading 3D workspace</div>}>
        <MetallicMode key={key} tabs={tabs} onReset={reset} />
      </Suspense>
    );
  }
  return <IonicMode key={key} tabs={tabs} onReset={reset} />;
}
