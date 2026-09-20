import { Droplets } from "lucide-react";

// Left panel: choose a mixture. Reads MIXTURES generically -- adding a
// future mixture to the data model makes it appear here automatically,
// no layout changes required.
const CATEGORY_LABELS = { heterogeneous: "Heterogeneous mixtures", homogeneous: "Homogeneous mixtures" };

export default function MixtureSelector({ mixtures, selectedId, onSelect }) {
  const byCategory = mixtures.reduce((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  return (
    <nav aria-label="Choose a mixture" className="flex flex-col gap-3">
      {Object.entries(byCategory).map(([category, list]) => (
        <div key={category}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{CATEGORY_LABELS[category] ?? category}</p>
          <div className="flex flex-col gap-1">
            {list.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                aria-pressed={selectedId === m.id}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                  selectedId === m.id
                    ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                    : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                }`}
              >
                <Droplets size={14} className="shrink-0" />
                <span>
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-[10px] opacity-80">{m.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
