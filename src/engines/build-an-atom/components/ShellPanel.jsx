import { describeElectrons } from "../lib/electronConfiguration.js";

const signed = (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;

/** Compact "shells and configuration" panel shown directly below the atom drawing.
 * Everything comes from describeElectrons(electrons, protons): the configuration is for
 * the ELECTRON count drawn in the atom. Layout is flex-wrap only (container-driven, no
 * scaling). Full vs partial shells are told apart by a text tag, a check mark and a solid
 * vs dashed border, not by colour alone. */
export default function ShellPanel({ protons, electrons }) {
  const d = describeElectrons(electrons, protons);

  return (
    <section
      className="min-w-0 shrink-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2.5 text-xs text-[var(--color-ink)]"
      data-testid="atom-shells"
      aria-label="Electron shells and electronic configuration"
      aria-live="polite"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Electron shells</h3>
        {d.isIon && (
          <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] font-bold" data-testid="atom-shells-ion">
            Ion, net charge {signed(d.netCharge)}
          </span>
        )}
      </div>

      {d.none ? (
        <p className="text-[var(--color-ink-soft)]" data-testid="atom-shells-none">No electrons</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5" data-testid="atom-shells-list">
            {d.shells.map((s) => (
              <li
                key={s.n}
                className={"flex items-center gap-1.5 rounded-md px-2 py-1 " + (s.full ? "border-2 border-solid border-[var(--color-ink-soft)]" : "border border-dashed border-[var(--color-line)]")}
                data-testid={`atom-shell-${s.n}`}
                data-state={s.full ? "full" : "partial"}
                data-count={s.count}
                data-max={s.max}
              >
                <span className="font-semibold text-[var(--color-ink-soft)]">n={s.n}:</span>
                <span className="font-bold tabular-nums">{s.count}</span>
                <span className="tabular-nums text-[var(--color-ink-faint)]">/{s.max}</span>
                <span className="text-[10px] font-semibold text-[var(--color-ink-soft)]">{s.full ? "✓ full" : "partial"}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
            <dt className="text-[var(--color-ink-faint)]">Arrangement</dt>
            <dd className="min-w-0 break-words font-bold tabular-nums" data-testid="atom-shells-arrangement">{d.arrangement}</dd>
            <dt className="text-[var(--color-ink-faint)]">Configuration</dt>
            <dd className="min-w-0 break-words font-bold" data-testid="atom-shells-config">{d.configuration}</dd>
            {d.shorthand && (
              <>
                <dt className="text-[var(--color-ink-faint)]">Shorthand</dt>
                <dd className="min-w-0 break-words font-semibold" data-testid="atom-shells-shorthand">{d.shorthand}</dd>
              </>
            )}
          </dl>
          {protons === 0 && <p className="mt-1 text-[10px] text-[var(--color-ink-faint)]">No protons yet. Shown for this many electrons.</p>}
          {d.isIon && <p className="mt-1 text-[10px] text-[var(--color-ink-faint)]" data-testid="atom-shells-ion-basis">Ground state for {d.electrons} electrons (the atom has {d.protons} protons).</p>}
          {d.ionNote && <p className="mt-0.5 text-[10px] text-[var(--color-ink-faint)]" data-testid="atom-shells-ion-note">{d.ionNote}</p>}
        </>
      )}
    </section>
  );
}
