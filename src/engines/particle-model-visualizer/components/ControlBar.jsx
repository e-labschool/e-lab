import { Play, Pause, Link2, RotateCcw } from "lucide-react";
import { PALETTE, STATE_ACCENT } from "../data/palette.js";

function Chip({ active, onClick, icon, label, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel || label}
      title={ariaLabel || label}
      className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors"
      style={{
        borderColor: active ? STATE_ACCENT.solid : PALETTE.border,
        background: active ? "#6C86EE22" : "transparent",
        color: active ? "#8FA0EE" : PALETTE.textSecondary,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Pause/Play, Show Attractions and Reset View — the whole playback strip
 * for the chamber, centred beneath it. */
export default function ControlBar({ running, onToggleRunning, showAttractions, onToggleAttractions, onReset }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Chip
        onClick={onToggleRunning}
        icon={running ? <Pause size={13} /> : <Play size={13} />}
        label={running ? "Pause" : "Play"}
      />
      <Chip
        active={showAttractions}
        onClick={onToggleAttractions}
        icon={<Link2 size={12} />}
        label="Attractions"
      />
      <Chip onClick={onReset} icon={<RotateCcw size={12} />} label="Reset View" />
    </div>
  );
}
