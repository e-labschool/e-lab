import { Pause, Play, RotateCcw } from "lucide-react";
import { MiniSwitch } from "../../../components/simulation/SimulationDashboard.jsx";
import { SPEEDS } from "../state/studioState.js";
import { TRANSPORT } from "../state/stepMachine.js";
import { useStudio, useStudioActions } from "../state/StudioContext.jsx";

/** Play / Pause | Reset | Speed. Only the controls that make sense for the active step are shown (state/stepMachine.js TRANSPORT). */
export default function PlaybackBar() {
  const paused = useStudio((s) => s.paused);
  const speed = useStudio((s) => s.speed);
  const step = useStudio((s) => s.step);
  const a = useStudioActions();
  const t = TRANSPORT[step] ?? TRANSPORT[1];
  return (
    <div className="ss-transport" role="group" aria-label="Animation controls" data-testid="playback-bar" data-paused={paused ? "1" : "0"}>
      {t.play && (
        <button type="button" className="sim-btn ss-tbtn" onClick={a.togglePaused} aria-pressed={paused} aria-label={paused ? "Play the animation" : "Pause the animation"} data-testid="btn-play-pause" title={paused ? "Play" : "Pause"}>
          {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />} <span>{paused ? "Play" : "Pause"}</span>
        </button>
      )}
      {t.reset && (
        <button type="button" className="sim-btn ss-tbtn" onClick={a.resetPlayback} aria-label="Replay this step's animation from the start" data-testid="btn-reset-playback" title="Replay this step's animation from the start (keeps your molecule and field)">
          <RotateCcw size={15} aria-hidden="true" /> <span>Replay</span>
        </button>
      )}
      {t.speed && (
        <>
          <span className="ss-speed-label" id="ss-speed-label">Speed</span>
          <MiniSwitch
            ariaLabel="Animation speed" testId="speed-switch" value={speed} onChange={a.setSpeed}
            options={SPEEDS.map((v) => ({ id: v, label: `${v}×`, title: `${v} times the base animation speed` }))}
          />
        </>
      )}
      <span className="ss-time-note" data-testid="time-note" title="Pulses last microseconds, a free induction decay lasts about a second: each animation compresses time by a different, stated amount, so the speed setting is a teaching speed and not real time.">
        Teaching speed, not real time
      </span>
    </div>
  );
}
