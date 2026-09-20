import { Play, Pause, RotateCcw, RefreshCw } from "lucide-react";

// Play/Pause/Replay/Reset -- one shared control bar every method-
// specific simulation uses via its timeline hook, never reimplemented.
export default function SimulationControls({ status, onPlay, onPause, onReplay, onReset }) {
  const isPlaying = status === "playing";
  return (
    <div className="flex items-center justify-center gap-2">
      {isPlaying ? (
        <button type="button" onClick={onPause} aria-label="Pause" className="flex items-center gap-1.5 rounded-md bg-[var(--color-amber)] px-3 py-1.5 text-xs font-semibold text-white">
          <Pause size={13} /> Pause
        </button>
      ) : (
        <button type="button" onClick={onPlay} aria-label="Play" className="flex items-center gap-1.5 rounded-md bg-[var(--color-indigo)] px-3 py-1.5 text-xs font-semibold text-white">
          <Play size={13} /> {status === "paused" ? "Resume" : "Play"}
        </button>
      )}
      <button type="button" onClick={onReplay} aria-label="Replay" className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
        <RotateCcw size={13} /> Replay
      </button>
      <button type="button" onClick={onReset} aria-label="Reset" className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
        <RefreshCw size={13} /> Reset
      </button>
    </div>
  );
}
