import { Suspense } from "react";
import StepNav from "../components/StepNav.jsx";
import PlaybackBar from "../components/PlaybackBar.jsx";
import { useIr, useIrActions } from "./state/IrContext.jsx";
import { IR_STAGES, TRANSPORT_IR } from "./state/irState.js";
import Stage1Vibrate from "./stages/Stage1Vibrate.jsx";
import Stage2Types from "./stages/Stage2Types.jsx";
import Stage3Absorb from "./stages/Stage3Absorb.jsx";
import Stage4Explorer from "./stages/Stage4Explorer.jsx";
import Stage5Ftir from "./stages/Stage5Ftir.jsx";
import Stage6Build from "./stages/Stage6Build.jsx";
import Stage7Groups from "./stages/Stage7Groups.jsx";
import Stage8Interpret from "./stages/Stage8Interpret.jsx";
import Stage9Unknown from "./stages/Stage9Unknown.jsx";
import "./ir.css";

const VIEWS = { 1: Stage1Vibrate, 2: Stage2Types, 3: Stage3Absorb, 4: Stage4Explorer, 5: Stage5Ftir, 6: Stage6Build, 7: Stage7Groups, 8: Stage8Interpret, 9: Stage9Unknown };
const NOTE = "The vibrations are slowed by about 10¹⁴ so you can see them; the spectrometer and the spectrum are illustrative. Teaching speed, not real time.";

/** The IR tab's workbench: the same stepper, frame and transport as the NMR tab, driven by the IR store. */
export default function IrWorkbench() {
  const stage = useIr((s) => s.stage); const a = useIrActions();
  const View = VIEWS[stage] ?? Stage1Vibrate;
  return (
    <div className="ss-wb nm-root ir-root" data-testid="stage-box" data-stage={`ir-${stage}`} data-technique="ir">
      <StepNav steps={IR_STAGES} step={stage} onGoto={a.setStage} onPrev={a.prevStage} onNext={a.nextStage} ariaLabel="IR lesson stages" />
      <div className="ss-stepbody" key={stage} data-testid="step-body">
        <Suspense fallback={null}><View /></Suspense>
      </div>
    </div>
  );
}

export function IrPlayback() { return <PlaybackBar transport={TRANSPORT_IR} note={NOTE} />; }
