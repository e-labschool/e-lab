import { useCallback, useReducer, useState } from "react";
import { FlaskConical, Hammer, Target } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashboardTabs, ExplainLine } from "../../components/simulation/SimulationDashboard.jsx";
import ViewOptions from "./components/ViewOptions.jsx";
import StructureCard from "./components/StructureCard.jsx";
import useBuilderWorkspace, { useViewState } from "./components/useBuilderWorkspace.jsx";
import useMoleculesTab from "./components/useMoleculesTab.jsx";
import useChallengeTab from "./components/useChallengeTab.jsx";
import { createHistory, historyReducer, modelFromPreset } from "./model/builder.js";
import { PRESET_BY_ID } from "./model/presets.js";
import { formulaOf } from "./components/format.js";
import "./VSEPRExplorer.css";

// VSEPR Explorer (3D): IB DP Chemistry S2.2. Three tabs: Build | Molecules | Challenge.
//
// Pure model (no React / three) lives in ./model (tested by scripts/test-vsepr-model.mjs): geometry engine, validated
// presets, builder + history, Lewis derivation, challenge checking. ./components only draws and wires controls.
//
// STATE (documented choice): all three tabs stay mounted as hooks of this component, so switching tabs never loses
// work: the Build model + undo history persist for the whole session, the Molecules tab remembers its molecule and
// search, and the Challenge tab keeps its own molecule / answers / build. Tabs never share a model: only the explicit
// "Open in Build tab" button copies a molecule into Build (as one undo step). Each tab has its own view options.
// Registered under the SAME simulation id as the previous 3D explorer ("vsepr-explorer-3d") so existing lessons still embed it.
const TAB_STYLE = {
  build: { icon: Hammer, soft: "#1a2b5b", border: "#2e4a90", text: "#d4e3ff", solid: "#1f6bff" },
  molecules: { icon: FlaskConical, soft: "#1a2b5b", border: "#2e4a90", text: "#d4e3ff", solid: "#1f6bff" },
  challenge: { icon: Target, soft: "#1a2b5b", border: "#2e4a90", text: "#d4e3ff", solid: "#1f6bff" },
};
const TABS = [
  { id: "build", label: "1. Build", sub: "Add atoms, bonds and lone pairs", title: "Build your own molecule and drag its electron domains" },
  { id: "molecules", label: "2. Molecules", sub: "Explore real molecules", title: "A library of real molecules grouped by electron domains" },
  { id: "challenge", label: "3. Challenge", sub: "Predict and check", title: "Predict, build, observe and explain one molecule at a time" },
];

function optionItems(view, patch) {
  const ed = view.mode === "ed";
  return [
    { id: "domains", label: "Show electron domains", checked: view.showDomains, onChange: (v) => patch({ showDomains: v }), disabled: !ed, title: ed ? "Translucent orbital-like regions for every bonding and lone-pair domain" : "Used in the electron-domain view", testId: "opt-domains" },
    { id: "lp", label: "Show lone pairs", checked: ed ? true : view.showLP, onChange: (v) => patch({ showLP: v }), disabled: ed, title: ed ? "Lone pairs are always shown in the electron-domain view (they are domains)" : "Lone pairs are not atoms; show them as faint lobes in the molecular-geometry view", testId: "opt-lp" },
    { id: "rep", label: "Show repulsion arrows", checked: view.showRepulsion, onChange: (v) => patch({ showRepulsion: v }), title: "Arrows between neighbouring domains: lone pair–lone pair > lone pair–bond pair > bond pair–bond pair", testId: "opt-repulsion" },
    { id: "ang", label: "Show bond angles", checked: view.showAngles, onChange: (v) => patch({ showAngles: v }), title: "Curved angle markers on the model: live while dragging, idealised / approximate values at rest", testId: "opt-angles" },
  ];
}

/** Visual theme: "dark" (navy, matches the supplied reference image) or "light" (soft pastel). Colours are CSS variables in VSEPRExplorer.css. */
export const VSEPR_THEME = "dark";

function Workspace() {
  const [tab, setTab] = useState("build");
  const [hist, dispatch] = useReducer(historyReducer, undefined, createHistory);
  const buildView = useViewState();

  const build = useBuilderWorkspace({ hist, dispatch, viewState: buildView, resetKey: hist.present.epoch, onReset: () => buildView.reset(), ariaLabel: "3D workspace for building a molecule" });
  const openInBuild = useCallback((id) => { dispatch({ type: "load", ...modelFromPreset(PRESET_BY_ID[id]) }); setTab("build"); }, []);
  const molecules = useMoleculesTab({ onOpenInBuild: openInBuild, optionItems });
  const challenge = useChallengeTab({ optionItems });

  const cls = build.cls;
  const buildGraph = (
    <div className="vx-side">
      <section className="vx-card" aria-label="View options"><h3 className="vx-h">View options</h3><ViewOptions items={optionItems(buildView.view, buildView.patch)} /></section>
      <StructureCard model={build.model} cls={cls} view={buildView.view} resetKey={build.model.epoch} />
    </div>
  );
  const buildExplain = hist.note
    ? hist.note
    : !cls.hasCentral ? "Start by dragging (or clicking) an atom: the first atom becomes the central atom."
      : cls.n === 0 ? `${build.model.central} is the central atom. Pick a bond type, then add atoms, or add a lone pair.`
        : `${cls.preset ? cls.preset.display : formulaOf(build.model)}: ${cls.b} bonding + ${cls.l} lone pair${cls.l === 1 ? "" : "s"} = ${cls.n} domains (${cls.axe}). ${cls.ed ? `${cls.ed} electron domains` : ""}${cls.mg ? `, ${cls.mg.toLowerCase()} shape.` : "."}`;

  const parts = tab === "build" ? { ...build, graph: buildGraph, explain: buildExplain, reset: () => { dispatch({ type: "reset" }); buildView.reset(); build.resetLocal(); } }
    : tab === "molecules" ? molecules : challenge;

  return (
    <div className="vx-theme" data-vx-theme={VSEPR_THEME}>
    <SimulationDashboard
      title="VSEPR Explorer (3D)" subtitle="S2.2 The Covalent Model" role="region" ariaLabel="VSEPR Explorer" testId="vsepr-workspace"
      onReset={parts.reset} graphShown graphWide={false} graphId="vx-right"
      tabs={(
        <DashboardTabs
          ariaLabel="VSEPR Explorer sections" idPrefix="vx-tab" value={tab} onChange={setTab} testId="vsepr-tabs"
          tabs={TABS.map((t) => ({ ...t, testId: `tab-${t.id}`, ...TAB_STYLE[t.id] }))}
        />
      )}
      controls={<div className="vx-left" data-tab={tab} data-testid="vsepr-left">{parts.controls}</div>}
      chamber={<div className="vx-center" data-tab={tab}>{parts.chamber}</div>}
      graph={<div key={tab} className="vx-right" data-tab={tab} data-testid="vsepr-right">{parts.graph}</div>}
      explain={<ExplainLine text={parts.explain} testId="vsepr-explain" />}
    />
    </div>
  );
}

// The mode-agnostic orchestrator, reachable from /interactives, /simulation/vsepr-explorer-3d and any Learn page that
// embeds it through the simulation registry (same id as before).
export default function VSEPRExplorer3D({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="VSEPR Explorer (3D)" subtitle="Electron-domain and molecular geometry, bond angles and lone pairs" compact={compact} standalone={standalone} dashboard>
      <Workspace />
    </InteractiveFrame>
  );
}
