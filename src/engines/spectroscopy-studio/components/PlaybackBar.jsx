import { Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";
import { MiniSwitch } from "../../../components/simulation/SimulationDashboard.jsx";
import { SPEEDS } from "../state/studioState.js";
import { useStudio, useStudioActions } from "../state/StudioContext.jsx";

/** Play | Pause | Step Back | Step Forward | Reset | Speed. One bar for the whole lab: every animated activity listens to it. */
export default function PlaybackBar({ note = true, disabledReason }) {
  const playing = useStudio((s) => s.playing);
  const speed = useStudio((s) => s.speed);
  const mode = useStudio((s) => s.mode);
  const a = useStudioActions();
  const off = Boolean(disabledReason);
  return (
    <div className="ss-transport" role="group" aria-label="Playback controls" data-testid="playback-bar" title={disabledReason}>
      <button type="button" className="sd-btn sd-btn--sm sd-btn--primary" onClick={() => a.setPlaying(true)} disabled={playing || off} data-testid="btn-play" aria-label="Play">
        <Play size={14} aria-hidden="true" /> <span>Play</span>
      </button>
      <button type="button" className="sd-btn sd-btn--sm" onClick={() => a.setPlaying(false)} disabled={!playing || off} data-testid="btn-pause" aria-label="Pause">
        <Pause size={14} aria-hidden="true" /> <span>Pause</span>
      </button>
      <button type="button" className="sd-btn sd-btn--sm" onClick={a.stepBack} disabled={off} data-testid="btn-step-back" aria-label="Step back to the previous event" title="Step back to the previous event (recomputed from the start, so it is exact)">
        <StepBack size={14} aria-hidden="true" /> <span>Step Back</span>
      </button>
      <button type="button" className="sd-btn sd-btn--sm" onClick={a.stepForward} disabled={off} data-testid="btn-step-forward" aria-label="Step forward to the next event" title="Step forward to the next event">
        <StepForward size={14} aria-hidden="true" /> <span>Step Forward</span>
      </button>
      <button type="button" className="sd-btn sd-btn--sm" onClick={a.resetPlayback} disabled={off} data-testid="btn-reset-playback" aria-label="Reset the animation to the start" title="Reset the animation to the start">
        <RotateCcw size={14} aria-hidden="true" /> <span>Reset</span>
      </button>
      <span className="ss-speed-label" id="ss-speed-label">Speed</span>
      <MiniSwitch
        ariaLabel="Animation speed" testId="speed-switch" value={speed} onChange={a.setSpeed}
        options={SPEEDS.map((v) => ({ id: v, label: `${v}×`, title: `${v} times the base animation speed` }))}
      />
      {note && (
        <span className="ss-time-note" data-testid="time-note" title="Pulses last microseconds, a free induction decay lasts about a second and a spectrometer is switched on over minutes: each animation compresses time by a different, stated amount, so the speed setting is a teaching speed and not real time.">
          Pedagogical time, not real time{mode === "teacher" ? " · pauses at key events" : ""}
        </span>
      )}
    </div>
  );
}
