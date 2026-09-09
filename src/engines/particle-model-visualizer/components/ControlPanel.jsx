import { Play, Pause, Link2 } from "lucide-react";
import { STATE_INFO, STATE_ORDER } from "../data/stateInfo.js";

export default function ControlPanel({ state, onChangeState, running, onToggleRunning, showAttractions, onToggleAttractions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-2">
      <div className="flex gap-1 rounded-md bg-[var(--color-paper)] p-1">
        {STATE_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChangeState(s)}
            aria-pressed={s === state}
            className={`rounded px-3 py-1 text-xs font-medium tracking-wide transition-colors ${
              s === state
                ? "bg-[var(--color-indigo)] text-white shadow-sm"
                : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {STATE_INFO[s].label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleRunning}
          aria-label={running ? "Pause" : "Play"}
          title={running ? "Pause" : "Play"}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          type="button"
          onClick={onToggleAttractions}
          aria-pressed={showAttractions}
          title="Show attractions"
          className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
            showAttractions
              ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
              : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
          }`}
        >
          <Link2 size={12} />
          Attractions
        </button>
      </div>
    </div>
  );
}
