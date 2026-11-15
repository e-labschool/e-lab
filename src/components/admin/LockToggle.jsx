import { Lock, LockOpen } from "lucide-react";

export const LOCK_LABEL = Object.freeze({ lock: "Lock for Premium", unlock: "Unlock (free)" });

/**
 * Padlock toggle used by the admin screens instead of a Free / Premium dropdown.
 *   locked = tier 'premium' in the data, unlocked = 'free'.  (The policy and tier values underneath are unchanged.)
 *
 * Accessibility: a real <button> with aria-pressed (pressed = locked).  The accessible NAME stays constant
 * ("Premium lock for <item>") so a screen reader never announces a contradictory "Unlock, pressed"; the ACTION text
 * ("Lock for Premium" / "Unlock (free)") is the tooltip (title) and the accessible description.
 */
export default function LockToggle({ locked, onChange, name, disabled = false, id }) {
  const action = locked ? LOCK_LABEL.unlock : LOCK_LABEL.lock;
  const descId = id ? `${id}-action` : undefined;
  return (
    <>
      <button
        type="button" id={id} aria-pressed={locked} disabled={disabled} title={action} aria-describedby={descId}
        aria-label={`Premium lock for ${name}`} data-lock-toggle data-locked={locked ? "true" : "false"}
        onClick={(e) => { e.stopPropagation(); onChange(!locked); }}
        onKeyDown={(e) => e.stopPropagation()}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)] disabled:cursor-not-allowed disabled:opacity-50 ${locked ? "border-[var(--color-amber)]/60 bg-[var(--color-amber-soft)] text-[var(--color-amber)]" : "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/40 hover:text-[var(--color-ink)]"}`}
      >
        {locked ? <Lock size={16} aria-hidden="true" /> : <LockOpen size={16} aria-hidden="true" />}
      </button>
      {descId && <span id={descId} className="sr-only">{action}</span>}
    </>
  );
}
