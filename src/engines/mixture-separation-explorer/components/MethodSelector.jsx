// Shows only methods that are BOTH scientifically appropriate for the
// selected mixture (per the data model) AND actually implemented (has
// a real entry in simulationRegistry) -- a method listed in a future
// mixture's data but not yet built simply doesn't render here, rather
// than appearing as a clickable option that goes nowhere.
export default function MethodSelector({ mixture, methodsMeta, registry, selectedMethodId, onSelect }) {
  const available = mixture.methods.filter((m) => registry[m.methodId]);
  if (available.length === 0) return null;

  return (
    <div role="radiogroup" aria-label="Choose a separation method" className="flex flex-wrap justify-center gap-1.5">
      {available.map(({ methodId, purpose }) => {
        const meta = methodsMeta[methodId];
        const selected = selectedMethodId === methodId;
        return (
          <button
            key={methodId}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(methodId)}
            className={`rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${
              selected ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
            }`}
          >
            <span className="block font-semibold">{meta?.label ?? methodId}</span>
            <span className="block text-[10px] opacity-80">{purpose}</span>
          </button>
        );
      })}
    </div>
  );
}
