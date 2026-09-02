import { useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle, ListFilter, GitCompare, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ModelLimitationsPanel from "./components/ModelLimitationsPanel.jsx";
import { getRandomMatterExample } from "./data/examples.js";

import IntroScene from "./scenes/IntroScene.jsx";
import MassTestScene from "./scenes/MassTestScene.jsx";
import VolumeTestScene from "./scenes/VolumeTestScene.jsx";
import NonMatterScene from "./scenes/NonMatterScene.jsx";
import DefinitionScene from "./scenes/DefinitionScene.jsx";
import TransitionScene from "./scenes/TransitionScene.jsx";
import StateMacroScene from "./scenes/StateMacroScene.jsx";
import StateParticleScene from "./scenes/StateParticleScene.jsx";
import CompareScene from "./scenes/CompareScene.jsx";
import CompressibilityScene from "./scenes/CompressibilityScene.jsx";
import TemperatureScene from "./scenes/TemperatureScene.jsx";
import DiffusionScene from "./scenes/DiffusionScene.jsx";
import MacroMicroScene from "./scenes/MacroMicroScene.jsx";
import MisconceptionsScene from "./scenes/MisconceptionsScene.jsx";
import SummaryScene from "./scenes/SummaryScene.jsx";

// This orchestrator owns exactly the state a teacher-led walkthrough needs:
// which scene is active, which bench sample is selected, and the shared
// controls (pause / reveal-all / reset). Every scene below is otherwise
// self-contained and receives only the props it actually needs.
const SCENES = [
  { id: "intro", title: "What is matter?", Component: IntroScene },
  { id: "mass-test", title: "Test: mass", Component: MassTestScene },
  { id: "volume-test", title: "Test: volume", Component: VolumeTestScene },
  { id: "non-matter", title: "Non-matter contrast", Component: NonMatterScene },
  { id: "definition", title: "Definition of matter", Component: DefinitionScene },
  { id: "transition", title: "Physical classification", Component: TransitionScene },
  { id: "solid-macro", title: "Solid \u2014 macro", Component: (p) => <StateMacroScene state="solid" {...p} /> },
  { id: "solid-particle", title: "Solid \u2014 particles", Component: (p) => <StateParticleScene state="solid" {...p} /> },
  { id: "liquid-macro", title: "Liquid \u2014 macro", Component: (p) => <StateMacroScene state="liquid" {...p} /> },
  { id: "liquid-particle", title: "Liquid \u2014 particles", Component: (p) => <StateParticleScene state="liquid" {...p} /> },
  { id: "gas-macro", title: "Gas \u2014 macro", Component: (p) => <StateMacroScene state="gas" {...p} /> },
  { id: "gas-particle", title: "Gas \u2014 particles", Component: (p) => <StateParticleScene state="gas" {...p} /> },
  { id: "compare", title: "Compare states", Component: CompareScene },
  { id: "compressibility", title: "Compressibility", Component: CompressibilityScene },
  { id: "temperature", title: "Temperature & motion", Component: TemperatureScene },
  { id: "diffusion", title: "Diffusion", Component: DiffusionScene },
  { id: "macro-micro", title: "Macro \u2194 particle", Component: MacroMicroScene },
  { id: "misconceptions", title: "Misconceptions", Component: MisconceptionsScene },
  { id: "summary", title: "Summary", Component: SummaryScene },
];

const COMPARE_INDEX = SCENES.findIndex((s) => s.id === "compare");

function ToolbarButton({ onClick, children, disabled, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function ExploreMatterAndStates({ compact = false }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedExample, setSelectedExample] = useState(null);
  const [paused, setPaused] = useState(false);
  const [revealToken, setRevealToken] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const scene = SCENES[sceneIndex];

  function goTo(index) {
    const next = Math.min(Math.max(index, 0), SCENES.length - 1);
    setSceneIndex(next);
    setRevealToken(0);
  }

  function handleChooseExample(example, isMatter) {
    setSelectedExample(example);
    if (isMatter === false) return; // non-matter picks stay on the intro scene for context.
  }

  function handleRandomExample() {
    const example = getRandomMatterExample(selectedExample?.id);
    setSelectedExample(example);
    goTo(0);
  }

  function handleReset() {
    setSceneIndex(0);
    setSelectedExample(null);
    setPaused(false);
    setRevealToken(0);
    setResetKey((k) => k + 1);
  }

  const body = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarButton onClick={() => goTo(sceneIndex - 1)} disabled={sceneIndex === 0}>
            <ChevronLeft size={13} /> Previous
          </ToolbarButton>
          <ToolbarButton onClick={() => goTo(sceneIndex + 1)} disabled={sceneIndex === SCENES.length - 1}>
            Reveal next <ChevronRight size={13} />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
          <ToolbarButton onClick={() => goTo(0)}>
            <ListFilter size={13} /> Choose example
          </ToolbarButton>
          <ToolbarButton onClick={handleRandomExample}>
            <Shuffle size={13} /> Random example
          </ToolbarButton>
          <ToolbarButton onClick={() => goTo(COMPARE_INDEX)} active={sceneIndex === COMPARE_INDEX}>
            <GitCompare size={13} /> Compare
          </ToolbarButton>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarButton onClick={() => setPaused((v) => !v)} active={paused}>
            {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? "Play" : "Pause"}
          </ToolbarButton>
          <ToolbarButton onClick={() => setRevealToken((t) => t + 1)}>
            <Sparkles size={13} /> Reveal all
          </ToolbarButton>
          <ToolbarButton onClick={handleReset}>
            <RotateCcw size={13} /> Reset
          </ToolbarButton>
          <ModelLimitationsPanel />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--color-ink-faint)]">
        <span>{sceneIndex + 1} / {SCENES.length}</span>
        <span className="text-[var(--color-line)]">&middot;</span>
        <span className="text-[var(--color-ink)]">{scene.title}</span>
        {selectedExample && (
          <>
            <span className="text-[var(--color-line)]">&middot;</span>
            <span>Sample: {selectedExample.label}</span>
          </>
        )}
      </div>

      <div key={`${resetKey}-${sceneIndex}`}>
        <scene.Component
          example={selectedExample}
          selectedExample={selectedExample}
          onSelectExample={handleChooseExample}
          forceToken={revealToken}
          paused={paused}
        />
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame title="Explore Matter & States" subtitle="Teacher-led visual exploration">
      {body}
    </InteractiveFrame>
  );
}
