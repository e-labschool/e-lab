import { Play, Pause, Link2, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ZoomIn, ZoomOut } from "lucide-react";
import { PALETTE, STATE_ACCENT } from "../data/palette.js";

function Chip({ active, onClick, icon, label, ariaLabel, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      aria-label={ariaLabel || label}
      title={ariaLabel || label}
      className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors"
      style={{
        borderColor: active ? STATE_ACCENT.solid : "var(--sim-btn-border)",
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
export default function ControlBar({ running, onToggleRunning, showAttractions, onToggleAttractions, onReset, onRotate, onZoom }) {
  return (
    <div className="sim-surface-dark flex flex-wrap items-center justify-center gap-2">
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
      <span className="flex items-center gap-1" role="group" aria-label="Rotate and zoom the chamber">
        <Chip onClick={() => onRotate?.(-0.3, 0)} icon={<ChevronLeft size={13} />} label="" ariaLabel="Rotate the chamber left" testId="rot-left" />
        <Chip onClick={() => onRotate?.(0.3, 0)} icon={<ChevronRight size={13} />} label="" ariaLabel="Rotate the chamber right" testId="rot-right" />
        <Chip onClick={() => onRotate?.(0, -0.2)} icon={<ChevronUp size={13} />} label="" ariaLabel="Tilt the chamber up" testId="rot-up" />
        <Chip onClick={() => onRotate?.(0, 0.2)} icon={<ChevronDown size={13} />} label="" ariaLabel="Tilt the chamber down" testId="rot-down" />
        <Chip onClick={() => onZoom?.(0.88)} icon={<ZoomIn size={13} />} label="" ariaLabel="Zoom in" testId="zoom-in" />
        <Chip onClick={() => onZoom?.(1.14)} icon={<ZoomOut size={13} />} label="" ariaLabel="Zoom out" testId="zoom-out" />
      </span>
    </div>
  );
}
