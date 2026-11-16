import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Small popover menu: button + role="menu" panel. Closes on Escape, outside click, or choosing an item. */
export default function Menu({ label, icon, buttonClass = "", children, align = "left", testId, onOpenChange, ariaLabel, panelClass = "w-60 max-w-[calc(100vw-12px)]" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const panelRef = useRef(null);
  // keep the panel inside the viewport (phones): shift it sideways when it would overflow
  useLayoutEffect(() => {
    const el = panelRef.current; if (!el || !open) return;
    el.style.transform = "";
    const r = el.getBoundingClientRect(); const vw = document.documentElement.clientWidth;
    let dx = 0; if (r.right > vw - 6) dx = vw - 6 - r.right; if (r.left + dx < 6) dx = 6 - r.left;
    if (dx) el.style.transform = `translateX(${dx}px)`;
  }, [open]);
  const set = (v) => { setOpen(v); onOpenChange?.(v); };
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) set(false); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); set(false); ref.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", down, true); document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("keydown", key, true); };
  });
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel} data-testid={testId} onClick={(e) => { e.stopPropagation(); set(!open); }} className={buttonClass}>{icon}{label}</button>
      {open && (
        <div role="menu" ref={panelRef} className={`absolute z-40 mt-1 max-h-[70vh] overflow-auto rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-1.5 shadow-lg ${panelClass} ${align === "right" ? "right-0" : "left-0"}`} onClick={(e) => { if (e.target.closest("[data-menu-close]")) set(false); }}>
          {children}
        </div>
      )}
    </div>
  );
}
export const menuItem = "flex min-h-9 w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)] disabled:opacity-40";
export const MenuLabel = ({ children }) => <p className="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{children}</p>;
