import Particle from "./Particle.jsx";

const LABELS = {
  proton: { name: "Protons", info: "Charge +1 • Relative mass 1" },
  neutron: { name: "Neutrons", info: "Charge 0 • Relative mass 1" },
  electron: { name: "Electrons", info: "Charge −1 • Relative mass ≈ 1/1836" },
};

/** One compact, tactile horizontal control -- particle token, name +
 * inline info, and the independent +/- stepper. `locked` (Auto-balance
 * is on and this count is determined by the protons) disables both
 * buttons and says why; otherwise each button changes ONLY this count. */
export default function ParticleControl({ type, count, onAdd, onRemove, canAdd = true, canRemove, locked = false }) {
  const info = LABELS[type];
  const lockTitle = locked ? "Set automatically while Auto-balance is on" : undefined;
  const btn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5" data-testid={`atom-row-${type}`} data-locked={locked ? "1" : "0"}>
      <Particle type={type} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold leading-tight text-[var(--color-ink)]">{info.name}</p>
        <p className="truncate text-[10px] leading-tight text-[var(--color-ink-faint)]" title={info.info}>{locked ? "Set by Auto-balance" : info.info}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onRemove}
          disabled={locked || !canRemove}
          aria-label={`Remove ${type}`}
          title={lockTitle}
          data-testid={`atom-remove-${type}`}
          className={btn + " border border-[var(--color-line)] text-[var(--color-ink-soft)]"}
        >
          {"−"}
        </button>
        <span className="w-7 text-center text-base font-bold tabular-nums text-[var(--color-ink)]" data-testid={`atom-count-${type}`} aria-live="polite">{count}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={locked || !canAdd}
          aria-label={`Add ${type}`}
          title={lockTitle}
          data-testid={`atom-add-${type}`}
          className={btn + " bg-[var(--color-indigo)] text-white"}
        >
          +
        </button>
      </div>
    </div>
  );
}
