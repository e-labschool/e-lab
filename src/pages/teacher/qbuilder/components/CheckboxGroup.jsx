// A flat (non-hierarchical) checkbox filter group — used for Level, Paper,
// Difficulty, and Question Type. OR logic within the group is implicit:
// this component only tracks which values are checked; filterQuestions.js
// treats a non-empty selection as "any of these".
export default function CheckboxGroup({ title, options, selected, onChange, counts }) {
  function toggle(value) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{title}</p>
      <div className="space-y-0.5">
        {options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.id;
          const label = typeof opt === "string" ? opt : opt.label;
          const checked = selected.includes(value);
          const count = counts?.[value];
          return (
            <label key={value} className="flex cursor-pointer items-center gap-2 py-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(value)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-1 ${
                  checked ? "border-transparent bg-[var(--color-ink)]" : "border-[var(--color-line)] bg-transparent"
                }`}
              >
                {checked && <span className="block h-1.5 w-2 -translate-y-px rotate-[-45deg] border-b-2 border-l-2 border-white" />}
              </button>
              <span className="flex-1 text-[13px] text-[var(--color-ink-soft)]">{label}</span>
              {count != null && <span className="text-[11px] text-[var(--color-ink-faint)]">{count}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
