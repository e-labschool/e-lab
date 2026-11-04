import { useCallback, useMemo, useState } from "react";
import { Columns2 } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashboardTabs, MiniSwitch } from "../../components/simulation/SimulationDashboard.jsx";
import { StudioProvider, useReducedMotion, useStudio, useStudioActions } from "./state/StudioContext.jsx";
import { STAGES, TECHNIQUES } from "./state/studioState.js";
import { larmorMHz } from "./nmr/physics/constants.js";
import StageStepper from "./components/StageStepper.jsx";
import PlaybackBar from "./components/PlaybackBar.jsx";
import DevelopmentPlaceholder from "./components/DevelopmentPlaceholder.jsx";
import Slot from "./components/Slot.jsx";
import { useSize } from "./components/useSize.js";
import PrincipleStage from "./nmr/stages/PrincipleStage.jsx";
import InstrumentStage from "./nmr/stages/InstrumentStage.jsx";
import * as molecular from "./molecularBridge.js";
import "./SpectroscopyStudio.css";

// Spectroscopy Simulation Lab -- the studio shell. Architecture and models: docs/NMR_SPECTROSCOPY_STUDIO.md.
//   * ONE SimulationDashboard (shared layout contract). Stages are plain components that portal their controls / secondary view /
//     explanation into the dashboard columns (Slot), so switching stage never remounts the header, the technique tabs or the transport.
//   * ONE store (state/studioState.js) holds the experiment; stages unmount, the experiment does not.
//   * Stages 1-2 (physics) are built here; stages 3-5 and the Splitting Patterns tab are the molecular components from ./nmr/molecular,
//     driven by the same `studio` object (molecule, selected environment, operating frequency = gamma B0 / 2 pi, mode, playback...).

/** Visual theme: "dark" (deep navy) is the SAME default as VSEPR_THEME / HYBRIDISATION_THEME so the simulations look consistent. */
export const SPECTROSCOPY_THEME = "dark";

const DEV_BLURB = {
  ms: "Mass spectrometry will show how ions are separated by mass-to-charge ratio and how fragmentation patterns are read.",
  ir: "Infrared spectroscopy will show how bond vibrations absorb infrared radiation and how absorption bands are assigned.",
  structure: "Structure Investigation will combine evidence from several techniques to determine an unknown structure. The ¹H NMR-only interpretation workspace already exists as stage 5 of ¹H NMR.",
};
const TECH_TABS = TECHNIQUES.map((t) => ({ id: t.id, label: t.label, title: t.developed ? t.label : `${t.label} (in development)`, testId: `tech-${t.id}` }));
const PHYSICS = new Set(["principle", "instrument"]);

function StageBody({ stage, slots, studio }) {
  const M = molecular;
  if (stage === "principle") return <PrincipleStage slots={slots} />;
  if (stage === "instrument") return <InstrumentStage slots={slots} />;
  if (stage === "molecular") return <M.MolecularProcessStage studio={studio} />;
  if (stage === "spectrum") return <M.SpectrumStage studio={studio} />;
  return <M.InterpretationStage studio={studio} />;
}

function Workspace() {
  const a = useStudioActions();
  const technique = useStudio((s) => s.technique);
  const stage = useStudio((s) => s.stage);
  const mode = useStudio((s) => s.mode);
  const splitView = useStudio((s) => s.splitView);
  const b0 = useStudio((s) => s.b0Tesla);
  const speed = useStudio((s) => s.speed);
  const playing = useStudio((s) => s.playing);
  const stepRequest = useStudio((s) => s.stepRequest);
  const resetToken = useStudio((s) => s.resetToken);
  const moleculeId = useStudio((s) => s.moleculeId);
  const selectedEnvId = useStudio((s) => s.selectedEnvId);
  const selectedMultipletId = useStudio((s) => s.selectedMultipletId);
  const reducedMotion = useReducedMotion();
  const [stageRef, containerSize] = useSize();
  const [controlsEl, setControlsEl] = useState(null);
  const [graphEl, setGraphEl] = useState(null);
  const [explainEl, setExplainEl] = useState(null);
  const op = larmorMHz(b0);

  // THE contract object handed to every molecular component (see docs/NMR_SPECTROSCOPY_STUDIO.md).
  const studio = useMemo(() => ({
    moleculeId, setMoleculeId: a.setMolecule, selectedEnvId, setSelectedEnvId: a.setSelectedEnv, selectedMultipletId, setSelectedMultipletId: a.setSelectedMultiplet,
    operatingFrequencyMHz: op, setOperatingFrequencyMHz: a.setOperatingFrequencyMHz, b0Tesla: b0,
    mode, splitView, speed, playing, setPlaying: a.setPlaying, stepRequest, resetToken, reducedMotion, containerSize,
  }), [moleculeId, selectedEnvId, selectedMultipletId, op, b0, mode, splitView, speed, playing, stepRequest, resetToken, reducedMotion, containerSize, a]);

  const tech = TECHNIQUES.find((t) => t.id === technique) ?? TECHNIQUES[2];
  const nmr = technique === "nmr";
  const physics = nmr && PHYSICS.has(stage);
  const kind = !tech.developed ? "dev" : physics ? "physics" : "molecular";
  const graphShown = physics && splitView;
  const goStage = useCallback((id) => a.setStage(id), [a]);
  const subtitle = nmr ? `Proton NMR · ${STAGES.find((s) => s.id === stage)?.n}. ${STAGES.find((s) => s.id === stage)?.label}` : tech.label;

  const slots = useMemo(() => ({ controls: controlsEl, graph: graphEl, explain: explainEl }), [controlsEl, graphEl, explainEl]);

  let body;
  if (!tech.developed) {
    body = (
      <DevelopmentPlaceholder
        technique={tech} blurb={DEV_BLURB[tech.id]}
        action={tech.id === "structure" ? <button type="button" className="sd-btn sd-btn--primary" onClick={() => { a.setTechnique("nmr"); a.setStage("interpretation"); }} data-testid="goto-interpretation">Open ¹H NMR interpretation (stage 5)</button> : null}
      />
    );
  } else if (technique === "splitting") {
    body = <molecular.SplittingLab studio={studio} />;
  } else {
    body = <StageBody stage={stage} slots={slots} studio={studio} />;
  }

  return (
    <div className="ss-theme" data-ss-theme={SPECTROSCOPY_THEME}>
      <SimulationDashboard
        title="Spectroscopy Simulation Lab" subtitle={subtitle} role="region" ariaLabel="Spectroscopy Simulation Lab" testId="spectroscopy-workspace" id="ss-root"
        onReset={a.resetExperiment} graphShown={graphShown} graphId="ss-graph"
        tabs={<DashboardTabs ariaLabel="Spectroscopy techniques" idPrefix="ss-tech" value={technique} onChange={a.setTechnique} segmented tabs={TECH_TABS} testId="technique-tabs" />}
        headerExtra={(
          <>
            <MiniSwitch
              ariaLabel="Lesson mode" testId="mode-switch" value={mode} onChange={a.setMode}
              options={[{ id: "teacher", label: "Teacher", title: "Teacher mode: annotations, pauses at key events, step-by-step control" }, { id: "student", label: "Student", title: "Student mode: explore, predict before revealing, immediate feedback" }]}
            />
            <button
              type="button" className="sd-btn sd-btn--toggle" aria-pressed={splitView} onClick={() => a.setSplitView(!splitView)} data-testid="split-toggle"
              title="Split View: show a synchronised second representation beside the main view" disabled={!tech.developed}
            >
              <Columns2 size={14} aria-hidden="true" /> Split View
            </button>
          </>
        )}
        controls={<div ref={setControlsEl} className="ss-slot ss-slot--controls" data-testid="slot-controls" />}
        chamber={(
          <div className="ss-chamber" data-kind={kind}>
            {nmr && <StageStepper stage={stage} onChange={goStage} />}
            <div className="ss-stagebox" ref={stageRef} data-testid="stage-box" data-stage={nmr ? stage : technique}>{body}</div>
          </div>
        )}
        graph={<div ref={setGraphEl} className="ss-slot ss-slot--graph" data-testid="slot-graph" />}
        live={tech.developed ? <PlaybackBar /> : null}
        explain={<div ref={setExplainEl} className="ss-explain" data-testid="slot-explain" />}
      />
      <Slot target={explainEl}>{kind !== "physics" ? <GenericExplain tech={tech} stage={stage} /> : null}</Slot>
      <ModeBadge mode={mode} />
    </div>
  );
}

function GenericExplain({ tech, stage }) {
  const text = !tech.developed ? `${tech.label} is not built yet; the ¹H NMR and Splitting Patterns sections are complete.`
    : tech.id === "splitting" ? "Splitting Patterns: how neighbouring protons split a signal into a multiplet. Use the controls in the main view."
      : stage === "molecular" ? "Molecular Process: choose a molecule, find its equivalent hydrogen environments and see how the surroundings shift each resonance."
        : stage === "spectrum" ? "The Spectrum: build the spectrum from the environments and read position, area and splitting."
          : "Interpretation: predict, then check, and work towards an unknown structure.";
  return <p className="sd-explain-text" aria-live="polite" data-testid="what-is-happening">{text}</p>;
}

// A visually-hidden live label so assistive technology hears the current mode after the switch.
function ModeBadge({ mode }) {
  return <p className="ss-sr" role="status" data-testid="mode-status">{mode === "teacher" ? "Teacher mode" : "Student mode"}</p>;
}

export default function SpectroscopyStudio({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Spectroscopy Simulation Lab" subtitle="Proton NMR from the nucleus to the spectrum" compact={compact} standalone={standalone} dashboard>
      <StudioProvider>
        <Workspace />
      </StudioProvider>
    </InteractiveFrame>
  );
}

