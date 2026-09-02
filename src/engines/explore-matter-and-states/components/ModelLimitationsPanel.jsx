import { useState } from "react";
import { Info, X } from "lucide-react";

const LIMITATIONS = [
  "Particles are not literally coloured spheres.",
  "Relative particle sizes may be exaggerated for clarity.",
  "Particle separation may be exaggerated for clarity.",
  "A 2D display represents a 3D system.",
  "Motion is slowed down for observation.",
];

// Kept hidden unless requested, available throughout the whole interactive
// rather than tied to one scene \u2014 a teacher may want it during any
// discussion of what the model does and doesn't show.
export default function ModelLimitationsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <Info size={13} /> Model limitations
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-ink)]">This is a model</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              <X size={13} className="text-[var(--color-ink-faint)]" />
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 text-xs text-[var(--color-ink-soft)]">
            {LIMITATIONS.map((l) => (
              <li key={l}>&bull; {l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
