import { MODES, MODE_LABELS, normalizeConfig } from "../model/config.js";

const labelCls = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";
const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-indigo)]";

/**
 * Lesson-editor options for a Bonding Visualizer block: which bonding model opens first and which models the
 * student may switch between (e.g. S2.1 = Ionic only). Stored as content.simulationConfig = { initialMode, allowedModes }.
 */
export default function BondingBlockOptions({ config, onChange }) {
  const cfg = normalizeConfig(config);
  const update = (patch) => onChange(normalizeConfig({ ...cfg, ...patch }));
  const toggle = (mode) => {
    const has = cfg.allowedModes.includes(mode);
    if (has && cfg.allowedModes.length === 1) return; // at least one model must stay available
    update({ allowedModes: has ? cfg.allowedModes.filter((m) => m !== mode) : [...cfg.allowedModes, mode] });
  };
  return (
    <div className="mt-3 space-y-3 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3" data-testid="bonding-block-options">
      <p className="text-xs font-semibold text-[var(--color-ink)]">Bonding Visualizer options</p>
      <div>
        <label className={labelCls} htmlFor="bv-initial-mode">Opens in</label>
        <select id="bv-initial-mode" className={inputCls} value={cfg.initialMode} onChange={(e) => update({ initialMode: e.target.value })}>
          {cfg.allowedModes.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className={labelCls}>Models students can switch between</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {MODES.map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm text-[var(--color-ink)]">
              <input type="checkbox" checked={cfg.allowedModes.includes(m)} onChange={() => toggle(m)} disabled={cfg.allowedModes.includes(m) && cfg.allowedModes.length === 1} />
              {MODE_LABELS[m]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Tick one model to lock the simulation to it (e.g. S2.1 Ionic only).</p>
      </fieldset>
    </div>
  );
}
