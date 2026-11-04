import { useState } from "react";
import { FlaskConical, Hammer } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashboardTabs } from "../../components/simulation/SimulationDashboard.jsx";
import { RichExplain } from "./components/Sci.jsx";
import useOrbitalLab from "./components/useOrbitalLab.jsx";
import useMoleculeExplorer from "./components/useMoleculeExplorer.jsx";
import "./HybridisationExplorer.css";

// Hybridisation Explorer (3D): IB DP Chemistry S2.2 The Covalent Model. Exactly two tabs: Orbital Lab | Molecule Explorer.
//
// Pure data / model code (no React, no three) lives in ./model and is tested by scripts/test-hybridisation-model.mjs:
// element valence configurations (ground states from the shared electron-configuration engine), validated illustrative
// promotions, hybridisation recipes and COMPUTED direction sets, sigma / pi overlap logic, snap planning, the workspace
// reducer with undo, molecule data + layout. ./scene draws it (procedural orbital surfaces, on-demand rendering) and
// ./components holds the UI. See docs/HYBRIDISATION_EXPLORER.md.
//
// STATE (same choice as the VSEPR Explorer): both tabs stay alive as hooks, so switching tabs never loses the Orbital Lab
// workspace (atoms, selections, hybridisation, undo history) or the Molecule Explorer's molecule and step.
//
// Orbital shapes are EDUCATIONAL representations: polar plots of the angular part of each orbital (real spherical harmonics),
// not quantum-mechanical probability surfaces and not an overlap-integral calculation.

const TAB_STYLE = {
  lab: { icon: Hammer, soft: "#1a2b5b", border: "#2e4a90", text: "#d4e3ff", solid: "#1f6bff" },
  molecules: { icon: FlaskConical, soft: "#1a2b5b", border: "#2e4a90", text: "#d4e3ff", solid: "#1f6bff" },
};
const TABS = [
  { id: "lab", label: "1. Orbital Lab", sub: "Build, mix & bond", title: "Choose an element, mix its orbitals and overlap them with other atoms" },
  { id: "molecules", label: "2. Molecule Explorer", sub: "Watch the sequence", title: "Step through the hybridisation and orbital overlap of a molecule" },
];

/** Visual theme: "dark" (navy) is the SAME default as VSEPR_THEME in VSEPRExplorer3D.jsx, so both simulations look consistent. */
export const HYBRIDISATION_THEME = "dark";

function Workspace() {
  const [tab, setTab] = useState("lab");
  const lab = useOrbitalLab();
  const mol = useMoleculeExplorer({ active: tab === "molecules" });
  const parts = tab === "lab" ? lab : mol;
  return (
    <div className="hy-theme" data-hy-theme={HYBRIDISATION_THEME}>
      <SimulationDashboard
        title="Hybridisation Explorer (3D)" subtitle="S2.2 The Covalent Model" role="region" ariaLabel="Hybridisation Explorer" testId="hybridisation-workspace" id="hy-root"
        onReset={parts.onReset} graphShown={parts.graphShown} graphWide={false} graphId="hy-right"
        tabs={(
          <DashboardTabs
            ariaLabel="Hybridisation Explorer sections" idPrefix="hy-tab" value={tab} onChange={setTab} testId="hybridisation-tabs"
            tabs={TABS.map((t) => ({ ...t, testId: `tab-${t.id}`, ...TAB_STYLE[t.id] }))}
          />
        )}
        controls={<div key={`l${tab}`} className="hy-left-wrap" style={{ height: "100%", minHeight: 0 }}>{parts.controls}</div>}
        chamber={<div key={`c${tab}`} style={{ height: "100%", minHeight: 0 }}>{parts.chamber}</div>}
        graph={<div key={tab} style={{ height: "100%", minHeight: 0 }}>{parts.graph}</div>}
        explain={<RichExplain text={parts.explain} testId="hybridisation-explain" />}
      />
    </div>
  );
}

// Reachable from /interactives, /simulation/hybridisation-explorer and any Learn page that embeds it through the simulation registry.
export default function HybridisationExplorer({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Hybridisation Explorer (3D)" subtitle="Electron configurations, orbital hybridisation and sigma / pi overlap" compact={compact} standalone={standalone} dashboard>
      <Workspace />
    </InteractiveFrame>
  );
}
