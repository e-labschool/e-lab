import { RotateCcw, StepBack, StepForward } from "lucide-react";

export default function RevealSequencer({ revealIndex, total, onStepForward, onStepBackward, onReset }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset reveal"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <RotateCcw size={14} />
      </button>
      <button
        type="button"
        onClick={onStepBackward}
        disabled={revealIndex === 0}
        aria-label="Step back"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-30"
      >
        <StepBack size={14} />
      </button>
      <span className="w-14 text-center font-[var(--font-mono)] text-xs text-[var(--color-ink-faint)]">
        {revealIndex} / {total}
      </span>
      <button
        type="button"
        onClick={onStepForward}
        disabled={revealIndex >= total}
        aria-label="Step forward"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-30"
      >
        <StepForward size={14} />
      </button>
    </div>
  );
}
