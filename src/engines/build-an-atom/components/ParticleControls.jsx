import ParticleControl from "./ParticleControl.jsx";
import { LIMITS, isLocked, referenceIsotope, isotopeIdentity } from "../lib/atomControls.js";

/** The three independent particle controls + the "Auto-balance particles"
 * checkbox (unchecked by default) + the reference-isotope statement. */
export default function ParticleControls({ atom, autoBalance, onToggleAutoBalance, onChange }) {
  const { protons, neutrons, electrons } = atom;
  const ref = referenceIsotope(protons);
  const mine = isotopeIdentity(protons, neutrons);

  let refLine;
  if (protons === 0) refLine = "Add a proton to choose an element.";
  else if (!ref) refLine = "No reference isotope data for this element — the neutron count is never changed automatically.";
  else if (autoBalance) refLine = `Neutrons follow the most abundant isotope of ${ref.name.split("-")[0]}.`;
  else refLine = `Most abundant isotope of ${ref.name.split("-")[0]}. Neutrons are yours to set.`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2" data-testid="atom-particle-controls">
        <ParticleControl type="proton" count={protons} onAdd={() => onChange("proton", 1)} onRemove={() => onChange("proton", -1)} canAdd={protons < LIMITS.protons} canRemove={protons > 0} locked={isLocked("proton", atom, autoBalance)} />
        <ParticleControl type="neutron" count={neutrons} onAdd={() => onChange("neutron", 1)} onRemove={() => onChange("neutron", -1)} canAdd={neutrons < LIMITS.neutrons} canRemove={neutrons > 0} locked={isLocked("neutron", atom, autoBalance)} />
        <ParticleControl type="electron" count={electrons} onAdd={() => onChange("electron", 1)} onRemove={() => onChange("electron", -1)} canAdd={electrons < LIMITS.electrons} canRemove={electrons > 0} locked={isLocked("electron", atom, autoBalance)} />
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-ink)]">
        <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--color-indigo)]" checked={autoBalance} onChange={(e) => onToggleAutoBalance(e.target.checked)} data-testid="atom-auto-balance" />
        <span>Auto-balance particles</span>
      </label>

      <div className="rounded-lg border border-dashed border-[var(--color-line)] px-2.5 py-1.5 text-[11px] leading-snug text-[var(--color-ink-soft)]" data-testid="atom-reference-isotope" aria-live="polite">
        {ref ? (
          <p className="font-semibold text-[var(--color-ink)]">
            Reference isotope: <span className="text-sm" data-testid="atom-reference-notation">{ref.notation}</span>
            <span className="font-normal text-[var(--color-ink-faint)]"> ({ref.name})</span>
          </p>
        ) : (
          <p className="font-semibold text-[var(--color-ink)]">Reference isotope: none</p>
        )}
        <p>{refLine}</p>
        {mine && !autoBalance && <p className="text-[var(--color-ink-faint)]">Your isotope: {mine.notation} ({mine.name}){mine.isReference ? " — the reference isotope" : ""}</p>}
      </div>
    </div>
  );
}
