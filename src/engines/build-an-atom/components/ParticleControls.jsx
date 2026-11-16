import ParticleControl from "./ParticleControl.jsx";
import { isLocked, referenceIsotope } from "../lib/atomControls.js";

/** The three independent particle controls, the "Auto-balance particles" checkbox (unchecked by default),
 * a compact reference-isotope line and a live notice that EXPLAINS every refused press or automatic
 * adjustment (never a silent grey button). */
export default function ParticleControls({ atom, autoBalance, onToggleAutoBalance, onChange, notice }) {
  const { protons, neutrons, electrons } = atom;
  const ref = referenceIsotope(protons);
  const hint = protons === 0
    ? "Add a proton to choose an element."
    : autoBalance ? "Neutrons follow the most abundant isotope." : "Most abundant isotope of this element. Neutrons are yours to set.";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1.5" data-testid="atom-particle-controls">
        <ParticleControl type="proton" count={protons} onAdd={() => onChange("proton", 1)} onRemove={() => onChange("proton", -1)} canRemove={protons > 0} locked={isLocked("proton", atom, autoBalance)} />
        <ParticleControl type="neutron" count={neutrons} onAdd={() => onChange("neutron", 1)} onRemove={() => onChange("neutron", -1)} canRemove={neutrons > 0} locked={isLocked("neutron", atom, autoBalance)} />
        <ParticleControl type="electron" count={electrons} onAdd={() => onChange("electron", 1)} onRemove={() => onChange("electron", -1)} canRemove={electrons > 0} locked={isLocked("electron", atom, autoBalance)} />
      </div>

      <div role="status" aria-live="polite" data-testid="atom-notice" className="min-h-0">
        {notice && (
          <p className={"rounded-md border px-2 py-1 text-[11px] leading-snug " + (notice.kind === "refused" ? "border-[var(--color-coral)] text-[var(--color-ink)]" : "border-[var(--color-amber)] text-[var(--color-ink)]")} data-kind={notice.kind}>
            <span className="font-bold">{notice.kind === "refused" ? "Not possible: " : "Adjusted: "}</span>{notice.text}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
          <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--color-indigo)]" checked={autoBalance} onChange={(e) => onToggleAutoBalance(e.target.checked)} data-testid="atom-auto-balance" />
          <span>Auto-balance particles</span>
        </label>
        <p className="text-[11px] text-[var(--color-ink-soft)]" data-testid="atom-reference-isotope" title={hint}>
          Reference isotope: {ref ? <span className="font-semibold text-[var(--color-ink)]" data-testid="atom-reference-notation">{ref.notation}</span> : <span className="font-semibold">none</span>}
        </p>
      </div>
    </div>
  );
}
