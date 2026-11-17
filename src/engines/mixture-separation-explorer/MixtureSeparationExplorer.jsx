import { useCallback, useState } from "react";
import { BookOpen, FlaskConical, Target, HelpCircle } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashboardTabs, ExplainLine, HeaderPopover, LiveStrip, PopoverSection } from "../../components/simulation/SimulationDashboard.jsx";
import useExploreTab from "./components/ExploreTab.jsx";
import useChallengeTab from "./components/ChallengeTab.jsx";
import useQuizTab from "./components/QuizTab.jsx";
import { useReducedMotion } from "./components/useReducedMotion.js";
import { Rich } from "./components/Rich.jsx";
import "./MixtureSeparation.css";

// Mixture Separation Explorer (rebuilt). Three modes: Explore (any mixture x any method, set-up + run + particle view + results),
// Challenge (plan a sequence of methods to recover every component) and Quiz (predict first, then watch it run).
// The chemistry lives in ./model (pure JS, tested by scripts/test-mixture-separation.mjs); ./components only draws and wires controls.
// All three modes stay mounted as hooks of ONE component, so switching mode never loses work. Registered under the same
// simulation id as the previous version ("mixture-separation-explorer") so existing lessons still embed it.
// Syllabus links (traceable in src/data/curricula/dp-chemistry/syllabus-points-2025.js): S1.1.1 (mixtures are separated by physical
// methods) and S2.2.10 (chromatography: mobile and stationary phases).

const TABS = [
  { id: "explore", label: "Explore", sub: "Any mixture, any method", icon: FlaskConical, title: "Pick a mixture and a method, set up the apparatus and watch it run" },
  { id: "challenge", label: "Challenge", sub: "Plan the steps", icon: Target, title: "Recover every component with a sequence of methods" },
  { id: "quiz", label: "Quiz", sub: "Predict first", icon: HelpCircle, title: "Predict the outcome, then watch it run" },
];

const OBJECTIVES = [
  "Classify a mixture and name the property of its components that decides how to separate it: particle size, solubility, boiling point, magnetism, sublimation or Rf.",
  "Assemble the apparatus for filtration, evaporation, crystallisation, simple and fractional distillation, paper chromatography, magnetic separation, decanting, a separating funnel and sublimation, in the right order and with the right safety steps.",
  "Explain at particle level why each method works, and why a wrong choice fails (for example filtering a salt solution, or evaporating ethanol).",
  "Read a distillation temperature-time curve and relate the plateaus to boiling points (ethanol 78 °C, water 100 °C).",
  "Calculate Rf = distance moved by the spot ÷ distance moved by the solvent front and use it to identify substances.",
  "Plan a multi-step separation of three components and justify the order.",
];

function Objectives() {
  return (
    <HeaderPopover label="Objectives" icon={<BookOpen size={14} aria-hidden="true" />} testId="ms-objectives" panelTestId="ms-objectives-panel" width={380}>
      <PopoverSection title="Learning objectives">
        <ol className="ms-objectives">{OBJECTIVES.map((o, i) => <li key={i}><Rich text={o} /></li>)}</ol>
      </PopoverSection>
      <PopoverSection title="Syllabus links">
        <p className="ms-caption">IB DP Chemistry (2025): S1.1.1 mixtures can be separated by physical methods; S2.2.10 chromatography with mobile and stationary phases. The other methods (distillation, crystallisation, sublimation, magnetic separation, the separating funnel) are standard school practicals that appear in IGCSE and DP courses; check your own syllabus for exactly which are examined.</p>
        <p className="ms-caption">Solubility, boiling-point, vapour-liquid and Rf data are teaching-model values chosen to behave like the real substances.</p>
      </PopoverSection>
    </HeaderPopover>
  );
}

function Workspace() {
  const reduced = useReducedMotion();
  const [tab, setTab] = useState("explore");
  const [request, setRequest] = useState(null);
  const watch = useCallback((see) => { setRequest({ ...see, nonce: Date.now() }); setTab("explore"); }, []);
  const explore = useExploreTab({ reduced, request });
  const challenge = useChallengeTab();
  const quiz = useQuizTab({ onWatch: watch });
  const parts = tab === "explore" ? explore : tab === "challenge" ? challenge : quiz;
  const resetAll = () => { explore.reset(); challenge.reset(); quiz.reset(); setRequest(null); };

  return (
    <div className="ms-theme" data-reduced={reduced ? "true" : "false"}>
      <SimulationDashboard
        title="Mixture Separation Explorer" subtitle="Choose a mixture and a method, then watch the apparatus separate it" subtitleLong="S1.1 Mixtures: choose a mixture and a method, then watch the apparatus separate it"
        role="region" ariaLabel="Mixture Separation Explorer" testId="ms-workspace" onReset={resetAll} graphShown graphWide={false} graphId="ms-right-col"
        headerExtra={<Objectives />}
        tabs={<DashboardTabs ariaLabel="Mixture Separation Explorer modes" idPrefix="ms-tab" value={tab} onChange={setTab} testId="ms-tabs" segmented tabs={TABS.map((t) => ({ ...t, testId: `tab-${t.id}` }))} controls="ms-panel-body" />}
        controls={<div className="ms-col ms-col--left" id="ms-panel-body" role="tabpanel" aria-labelledby={`ms-tab-${tab}`} data-tab={tab}>{parts.controls}</div>}
        chamber={<div className="ms-col ms-col--centre" data-tab={tab}>{parts.chamber}</div>}
        graph={<div key={tab} className="ms-col ms-col--right" data-tab={tab}>{parts.graph}</div>}
        live={<LiveStrip items={parts.live.items} ariaLabel="Live values" />}
        predict={parts.predict}
        explain={<ExplainLine text={parts.explain} testId="ms-explain" />}
      />
    </div>
  );
}

// Reachable from /interactives, /simulation/mixture-separation-explorer and any Learn page that embeds it through the registry.
export default function MixtureSeparationExplorer({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Mixture Separation Explorer" subtitle="Choose a mixture and a separation method and watch the apparatus demonstrate the separation" compact={compact} standalone={standalone} dashboard>
      <Workspace />
    </InteractiveFrame>
  );
}
