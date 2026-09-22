import Particle from "./Particle.jsx";

const LABELS = {
  proton: { name: "Proton", charge: "Charge: +1", mass: "Relative mass: 1" },
  neutron: { name: "Neutron", charge: "Charge: 0", mass: "Relative mass: 1" },
  electron: { name: "Electron", charge: "Charge: \u22121", mass: "Relative mass: approximately 1/1836" },
};

/** One tactile +/- control for a single particle type -- shows an
 * actual visual particle token (not just a text label), matching the
 * same rendering as every particle already visible in the atom itself. */
export default function ParticleControl({ type, count, onAdd, onRemove, canRemove }) {
  const info = LABELS[type];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
      <Particle type={type} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--color-ink)]">{info.name}</p>
        <p className="text-[11px] text-[var(--color-ink-faint)]">{info.charge}</p>
        <p className="text-[11px] text-[var(--color-ink-faint)]">{info.mass}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${type}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line)] text-lg font-bold text-[var(--color-ink-soft)] transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {"\u2212"}
        </button>
        <span className="w-6 text-center text-base font-bold tabular-nums text-[var(--color-ink)]">{count}</span>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add ${type}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-indigo)] text-lg font-bold text-white transition-transform hover:scale-105 active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}
