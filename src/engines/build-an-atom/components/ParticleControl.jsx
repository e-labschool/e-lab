import Particle from "./Particle.jsx";

const LABELS = {
  proton: { name: "Proton", info: "Charge +1 \u2022 Relative mass 1" },
  neutron: { name: "Neutron", info: "Charge 0 \u2022 Relative mass 1" },
  electron: { name: "Electron", info: "Charge \u22121 \u2022 Relative mass \u2248 1/1836" },
};

/** One compact, tactile horizontal control -- particle token, name +
 * inline info on one line, and the +/- stepper, all in a single row
 * rather than several stacked lines. */
export default function ParticleControl({ type, count, onAdd, onRemove, canRemove }) {
  const info = LABELS[type];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5">
      <Particle type={type} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold leading-tight text-[var(--color-ink)]">{info.name}</p>
        <p className="truncate text-[10px] leading-tight text-[var(--color-ink-faint)]">{info.info}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${type}`}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-line)] text-sm font-bold text-[var(--color-ink-soft)] transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {"\u2212"}
        </button>
        <span className="w-5 text-center text-sm font-bold tabular-nums text-[var(--color-ink)]">{count}</span>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add ${type}`}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-indigo)] text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}
