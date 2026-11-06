import { Pause, Play, RotateCcw, SkipBack, SkipForward, Film, Eye, EyeOff, Tag, Trash2 } from "lucide-react";
import StepNav from "../components/StepNav.jsx";
import { TeacherDisclosure } from "../components/ui.jsx";
import { MiniSwitch } from "../../../components/simulation/SimulationDashboard.jsx";
import { SPEEDS } from "../state/studioState.js";
import { useStudio, useStudioActions } from "../state/StudioContext.jsx";
import { useMs, useMsActions } from "./state/MsContext.jsx";
import { MS_STAGES } from "./state/msState.js";
import Workspace from "./components/Workspace.jsx";
import Overview from "./components/Overview.jsx";
import * as S1 from "./stages/Stage1Sample.jsx";
import * as S2 from "./stages/Stage2Ionise.jsx";
import * as S3 from "./stages/Stage3Fragment.jsx";
import * as S4 from "./stages/Stage4Separate.jsx";
import * as S5 from "./stages/Stage5Detect.jsx";
import * as S6 from "./stages/Stage6Interpret.jsx";
import UnknownActivity from "./activities/UnknownActivity.jsx";
import PatternActivity from "./activities/PatternActivity.jsx";
import IsotopeActivity from "./activities/IsotopeActivity.jsx";
import "./ms.css";

const STAGE_VIEWS = { 1: S1, 2: S2, 3: S3, 4: S4, 5: S5, 6: S6 };
const ACTIVITY_VIEWS = { unknown: UnknownActivity, patterns: PatternActivity, isotopes: IsotopeActivity };
const NOTE = "Illustrative instrument model: simplified and not to scale. Ion paths and times follow the formulas; spectra and ion counts are representative / illustrative, not experimental.";
export const BEAT_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

/** The MS tab: the same stepper as the IR and NMR tabs, now with SIX stages over ONE persistent workspace (the instrument never gets replaced, only the camera, the emphasis and the clock change). */
export default function MsWorkbench() {
  const stage = useMs((s) => s.stage); const activity = useMs((s) => s.activity); const analyser = useMs((s) => s.analyser); const a = useMsActions();
  const Stage = STAGE_VIEWS[stage] ?? S1; const info = MS_STAGES[stage - 1];
  const Activity = stage === 6 && activity ? ACTIVITY_VIEWS[activity] : null;
  return (
    <div className="ss-wb nm-root ms-root" data-testid="stage-box" data-stage={`ms-${stage}`} data-technique="ms">
      <StepNav steps={MS_STAGES} step={stage} onGoto={a.setStage} onPrev={a.prevStage} onNext={a.nextStage} ariaLabel="Mass spectrometry lesson stages" />
      <div className="ss-stepbody" data-testid="step-body">
        {Activity ? (
          <div className="ms-actwrap"><Overview stage={6} analyser={analyser} activityOpen /><div className="ms-actbody"><Activity /></div></div>
        ) : (
          <div className="ss-frame ms-frame" data-testid={`step-view-${stage}`} data-step={stage}>
            <div className="ss-vizcol">
              <div className="ss-viz ss-viz--journey" data-testid="journey-viz"><Workspace /></div>
              <div className="ss-strip" data-testid="step-strip" key={`strip-${stage}`}><Stage.Strip /></div>
            </div>
            <aside className="ss-panel" aria-label={`Stage ${stage}: ${info.title}`} data-testid="step-panel" key={`panel-${stage}`}>
              <p className="ss-kicker">Stage {stage} of {MS_STAGES.length}</p>
              <h3 className="ss-ptitle" data-testid="step-title">{info.title}</h3>
              <div className="ss-pbody"><Stage.Panel /></div>
              <TeacherDisclosure>{Stage.TEACHER}</TeacherDisclosure>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/** Transport of the MS tab. Only controls that make sense for the stage are shown. Play / Pause and speed are the shared studio ones. */
export function MsPlayback() {
  const ms = useMsActions(); const studio = useStudioActions();
  const stage = useMs((s) => s.stage); const showCharges = useMs((s) => s.showCharges); const showLabels = useMs((s) => s.showLabels);
  const paused = useStudio((s) => s.paused); const speed = useStudio((s) => s.speed);
  const forward = () => {
    const s = ms.getState(); const { t, duration } = ms.live;
    if (s.stage === 1 && !s.started) { ms.startSample(); studio.setPaused(true); return; }
    if (s.stage === 2 && !s.fired) { ms.fire(); studio.setPaused(true); return; }
    const nxt = BEAT_FRACTIONS.map((f) => f * duration).find((b) => b > t + 0.05);
    if (nxt !== undefined && duration > 0) { ms.seek(nxt); studio.setPaused(true); } else if (s.stage < 6) { ms.nextStage(); studio.setPaused(true); }
  };
  const back = () => {
    const s = ms.getState(); const { t, duration } = ms.live;
    const prev = [...BEAT_FRACTIONS].reverse().map((f) => f * duration).find((b) => b < t - 0.05);
    if (prev !== undefined && duration > 0) { ms.seek(prev); studio.setPaused(true); } else if (s.stage > 1) { ms.prevStage(); studio.setPaused(true); }
  };
  return (
    <div className="ss-transport" role="group" aria-label="Animation controls" data-testid="playback-bar" data-paused={paused ? "1" : "0"} data-stage={stage}>
      <button type="button" className="sim-btn ss-tbtn" onClick={studio.togglePaused} aria-pressed={paused} aria-label={paused ? "Play the animation" : "Pause the animation"} data-testid="btn-play-pause" title={paused ? "Play" : "Pause"}>
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />} <span>{paused ? "Play" : "Pause"}</span>
      </button>
      <button type="button" className="sim-btn ss-tbtn" onClick={back} aria-label="Step back" data-testid="btn-step-back" title="Step back to the previous moment (pauses)" disabled={stage === 1 && !ms.getState().started}><SkipBack size={15} aria-hidden="true" /> <span>Step back</span></button>
      <button type="button" className="sim-btn ss-tbtn" onClick={forward} aria-label="Step forward" data-testid="btn-step-forward" title="Step forward to the next moment (pauses)" disabled={stage === 6}><SkipForward size={15} aria-hidden="true" /> <span>Step forward</span></button>
      {stage <= 5 && (
        <button type="button" className="sim-btn ss-tbtn" onClick={studio.resetPlayback} aria-label="Replay this stage's animation from the start" data-testid="btn-reset-playback" title="Replay this stage from its start (keeps the experiment)"><RotateCcw size={15} aria-hidden="true" /> <span>Replay stage</span></button>
      )}
      <button type="button" className="sim-btn ss-tbtn" onClick={() => { ms.reset(); studio.resetPlayback(); }} aria-label="Reset the whole experiment" data-testid="btn-reset-experiment" title="Reset the whole experiment to stage 1"><Trash2 size={15} aria-hidden="true" /> <span>Reset</span></button>
      {stage === 3 && <button type="button" className="sim-btn ss-tbtn" onClick={() => { ms.replayFragmentation(); studio.setPaused(false); }} data-testid="btn-replay-frag" title="Replay the fragmentation of the whole population and of the selected pathway"><Film size={15} aria-hidden="true" /> <span>Replay fragmentation</span></button>}
      <span className="ss-speed-label" id="ss-speed-label">Speed</span>
      <MiniSwitch ariaLabel="Animation speed" testId="speed-switch" value={speed} onChange={studio.setSpeed} options={SPEEDS.map((v) => ({ id: v, label: v === 0.25 ? "0.25× slow" : `${v}×`, title: v === 0.25 ? "Slow motion: a quarter of the base animation speed" : `${v} times the base animation speed` }))} />
      {stage >= 2 && (
        <>
          <button type="button" className="sim-btn ss-tbtn" onClick={ms.toggleCharges} aria-pressed={showCharges} data-testid="btn-charges" title="Show or hide the charge badges (+, +•, 0)">{showCharges ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />} <span>{showCharges ? "Hide charges" : "Show charges"}</span></button>
          <button type="button" className="sim-btn ss-tbtn" onClick={ms.toggleLabels} aria-pressed={showLabels} data-testid="btn-labels" title="Show or hide the ion labels"><Tag size={15} aria-hidden="true" /> <span>{showLabels ? "Hide ion labels" : "Show ion labels"}</span></button>
        </>
      )}
      <span className="ss-time-note" data-testid="time-note" title={NOTE}>Teaching speed, not real time</span>
    </div>
  );
}
