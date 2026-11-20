import { CONFIG_MODES, CONFIG_MODE_LABELS, normalizeConfig } from "../model/config.js";

const labelCls = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";
const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-indigo)]";

/**
 * Lesson-editor option for an Equilibrium Lab block: which mode the simulation opens in.  Students can still switch mode inside the
 * block, so the teacher never needs separate blocks.  Stored as content.simulationConfig = { initialMode }.
 */
export default function EquilibriumBlockOptions({ config, onChange }) {
  const cfg = normalizeConfig(config);
  return (
    <div className="mt-3 space-y-3 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3" data-testid="equilibrium-block-options">
      <p className="text-xs font-semibold text-[var(--color-ink)]">Equilibrium Lab options</p>
      <div>
        <label className={labelCls} htmlFor="eq-initial-mode">Opens in</label>
        <select id="eq-initial-mode" className={inputCls} value={cfg.initialMode} onChange={(e) => onChange(normalizeConfig({ initialMode: e.target.value }))}>
          {CONFIG_MODES.map((m) => <option key={m} value={m}>{CONFIG_MODE_LABELS[m]}</option>)}
        </select>
        <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Students can switch between Everyday Analogy, Chemical Model and Compare Both inside the simulation.</p>
      </div>
    </div>
  );
}
