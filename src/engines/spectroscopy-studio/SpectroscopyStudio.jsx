import { Suspense } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashboardTabs, MiniSwitch } from "../../components/simulation/SimulationDashboard.jsx";
import { StudioProvider, useStudio, useStudioActions } from "./state/StudioContext.jsx";
import { TECHNIQUES } from "./state/studioState.js";
import { STEPS } from "./state/stepMachine.js";
import StepNav from "./components/StepNav.jsx";
import PlaybackBar from "./components/PlaybackBar.jsx";
import DevelopmentPlaceholder from "./components/DevelopmentPlaceholder.jsx";
import Step1Nucleus from "./nmr/steps/Step1Nucleus.jsx";
import Step2Field from "./nmr/steps/Step2Field.jsx";
import Step3Radio from "./nmr/steps/Step3Radio.jsx";
import Step4Instrument from "./nmr/steps/Step4Instrument.jsx";
import Step5Spectrum from "./nmr/steps/Step5Spectrum.jsx";
import Step6Molecules from "./nmr/steps/Step6Molecules.jsx";
import IrWorkbench, { IrPlayback } from "./ir/IrWorkbench.jsx";
import { IrProvider, useIrActions, useIr } from "./ir/state/IrContext.jsx";
import { IR_STAGES } from "./ir/state/irState.js";
import "./SpectroscopyStudio.css";

// Spectroscopy Simulation Lab -- ONE persistent NMR workspace. Architecture and models: docs/NMR_SPECTROSCOPY_STUDIO.md.
//   * ONE SimulationDashboard (shared layout contract) provides the header, the technique tabs, Reset, full screen and the bottom transport.
//     Its controls and graph columns are not used: the whole workspace lives in the chamber so that each step owns its large visual.
//   * ONE store (state/studioState.js) holds the experiment. Steps unmount, the experiment does not: the molecule, B0 (and so the operating
//     frequency), Teacher/Student mode and the playback settings carry from step to step.
//   * Six steps share one layout (components/StepFrame.jsx): a large visual, the step's principal control, a short explanation and an optional
//     "Teacher: deeper explanation".

/** Visual theme: "dark" (deep navy) is the SAME default as VSEPR_THEME / HYBRIDISATION_THEME so the simulations look consistent. */
export const SPECTROSCOPY_THEME = "dark";

const DEV_BLURB = {
  ms: "Mass spectrometry will show how ions are separated by mass-to-charge ratio and how fragmentation patterns are read.",
  structure: "Structure Investigation will combine evidence from several techniques to determine an unknown structure. The molecule workspace for ¹H NMR (step 6 of ¹H NMR) is the part that already exists.",
};
const TECH_TABS = TECHNIQUES.map((t) => ({ id: t.id, label: t.label, title: t.developed ? t.label : `${t.label} (in development)`, testId: `tech-${t.id}` }));
const STEP_VIEWS = { 1: Step1Nucleus, 2: Step2Field, 3: Step3Radio, 4: Step4Instrument, 5: Step5Spectrum, 6: Step6Molecules };

function Workbench() {
  const a = useStudioActions();
  const technique = useStudio((s) => s.technique);
  const step = useStudio((s) => s.step);
  const tech = TECHNIQUES.find((t) => t.id === technique) ?? TECHNIQUES[2];
  if (technique === "ir") return <IrWorkbench />;
  if (!tech.developed) {
    return (
      <div className="ss-wb" data-testid="stage-box" data-stage={tech.id}>
        <DevelopmentPlaceholder
          technique={tech} blurb={DEV_BLURB[tech.id]}
          action={tech.id === "structure" ? <button type="button" className="sim-btn sim-btn--primary" onClick={() => { a.setTechnique("nmr"); a.setStep(6); }} data-testid="goto-molecules">Open ¹H NMR, step 6 (molecules)</button> : null}
        />
      </div>
    );
  }
  const View = STEP_VIEWS[step] ?? Step1Nucleus;
  return (
    <div className="ss-wb nm-root" data-testid="stage-box" data-stage={`step-${step}`}>
      <StepNav />
      <div className="ss-stepbody" key={step} data-testid="step-body">
        <Suspense fallback={null}><View /></Suspense>
      </div>
    </div>
  );
}

function Workspace() {
  const a = useStudioActions();
  const technique = useStudio((s) => s.technique);
  const step = useStudio((s) => s.step);
  const mode = useStudio((s) => s.mode);
  const tech = TECHNIQUES.find((t) => t.id === technique) ?? TECHNIQUES[2];
  const irActions = useIrActions(); const irStage = useIr((x) => x.stage);
  const subtitle = technique === "ir" ? `IR Spectroscopy · stage ${irStage} of ${IR_STAGES.length}` : tech.developed ? `¹H NMR · step ${step} of ${STEPS.length}` : tech.label;
  const onReset = technique === "ir" ? () => { irActions.reset(); a.resetPlayback(); } : a.resetExperiment;
  return (
    <div className="ss-theme" data-ss-theme={SPECTROSCOPY_THEME}>
      <SimulationDashboard
        title="Spectroscopy Simulation Lab" subtitle={subtitle} role="region" ariaLabel="Spectroscopy Simulation Lab" testId="spectroscopy-workspace" id="ss-root"
        onReset={onReset} graphShown={false}
        tabs={<DashboardTabs ariaLabel="Spectroscopy techniques" idPrefix="ss-tech" value={technique} onChange={a.setTechnique} segmented tabs={TECH_TABS} testId="technique-tabs" />}
        headerExtra={(
          <MiniSwitch
            ariaLabel="Lesson mode" testId="mode-switch" value={mode} onChange={a.setMode}
            options={[{ id: "teacher", label: "Teacher", title: "Teacher mode: the deeper explanation opens by default" }, { id: "student", label: "Student", title: "Student mode: explore, predict before revealing, immediate feedback" }]}
          />
        )}
        chamber={<Workbench />}
        live={technique === "ir" ? <IrPlayback /> : tech.developed ? <PlaybackBar /> : null}
      />
      <p className="ss-sr" role="status" data-testid="mode-status">{mode === "teacher" ? "Teacher mode" : "Student mode"}</p>
    </div>
  );
}

export default function SpectroscopyStudio({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Spectroscopy Simulation Lab" subtitle="Proton NMR and infrared spectroscopy, step by step" compact={compact} standalone={standalone} dashboard>
      <StudioProvider>
        <IrProvider>
          <Workspace />
        </IrProvider>
      </StudioProvider>
    </InteractiveFrame>
  );
}
