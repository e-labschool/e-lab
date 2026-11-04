import { SUBSHELL_CAPACITY } from "../logic/buildConfiguration.js";

export default function ConstructStep({ config, answer, onChange, onSubmit }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Step 2 &middot; Construct</p>
        <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
          Set how many electrons go in each subshell of {config.element.name}. Remember the Aufbau
          principle, and check the total against Z = {config.element.atomicNumber}.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {config.subshellsDisplayOrder.map((subshell) => {
          const key = `${subshell.n}-${subshell.l}`;
          const capacity = SUBSHELL_CAPACITY[subshell.l];
          const value = answer[key] ?? 0;
          return (
            <div key={key} className="flex items-center gap-4">
              <span className="w-10 shrink-0 font-[var(--font-mono)] text-sm text-[var(--color-ink)]">
                {subshell.n}{["s", "p", "d", "f"][subshell.l]}
              </span>
              <input
                type="range"
                min={0}
                max={capacity}
                value={value}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="flex-1 accent-[var(--color-indigo)]"
              />
              <span className="w-14 shrink-0 text-right font-[var(--font-mono)] text-sm text-[var(--color-ink-soft)]">
                {value} / {capacity}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-ink-faint)]">
          Total: {Object.values(answer).reduce((a, b) => a + b, 0)} / {config.element.atomicNumber} electrons
        </span>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]"
        >
          Check answer
        </button>
      </div>
    </div>
  );
}
