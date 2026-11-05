import { Suspense } from "react";
import StepNav from "../components/StepNav.jsx";
import PlaybackBar from "../components/PlaybackBar.jsx";
import { useMs, useMsActions } from "./state/MsContext.jsx";
import { MS_STAGES, TRANSPORT_MS } from "./state/msState.js";
import Stage1Intro from "./stages/Stage1Intro.jsx";
import Stage2Sample from "./stages/Stage2Sample.jsx";
import Stage3Ionise from "./stages/Stage3Ionise.jsx";
import Stage4Fragment from "./stages/Stage4Fragment.jsx";
import Stage5Accelerate from "./stages/Stage5Accelerate.jsx";
import Stage6Sector from "./stages/Stage6Sector.jsx";
import Stage7Tof from "./stages/Stage7Tof.jsx";
import Stage8Detect from "./stages/Stage8Detect.jsx";
import Stage9Spectrum from "./stages/Stage9Spectrum.jsx";
import Stage10Isotopes from "./stages/Stage10Isotopes.jsx";
import Stage11Patterns from "./stages/Stage11Patterns.jsx";
import Stage12Unknown from "./stages/Stage12Unknown.jsx";
import Stage13Compare from "./stages/Stage13Compare.jsx";
import "./ms.css";

const VIEWS = { 1: Stage1Intro, 2: Stage2Sample, 3: Stage3Ionise, 4: Stage4Fragment, 5: Stage5Accelerate, 6: Stage6Sector, 7: Stage7Tof, 8: Stage8Detect, 9: Stage9Spectrum, 10: Stage10Isotopes, 11: Stage11Patterns, 12: Stage12Unknown, 13: Stage13Compare };
const NOTE = "Illustrative instrument model: simplified and not to scale. Ion paths and times follow the formulas; spectra are representative, not experimental.";

/** The MS tab's workbench: the same stepper, frame and transport as the IR and NMR tabs, driven by the MS store. */
export default function MsWorkbench() {
  const stage = useMs((s) => s.stage); const a = useMsActions();
  const View = VIEWS[stage] ?? Stage1Intro;
  return (
    <div className="ss-wb nm-root ms-root" data-testid="stage-box" data-stage={`ms-${stage}`} data-technique="ms">
      <StepNav steps={MS_STAGES} step={stage} onGoto={a.setStage} onPrev={a.prevStage} onNext={a.nextStage} ariaLabel="Mass spectrometry lesson stages" />
      <div className="ss-stepbody" key={stage} data-testid="step-body">
        <Suspense fallback={null}><View /></Suspense>
      </div>
    </div>
  );
}

export function MsPlayback() { return <PlaybackBar transport={TRANSPORT_MS} note={NOTE} />; }
