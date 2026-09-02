import { useRef } from "react";
import ModeToggle from "../layout/ModeToggle.jsx";
import FullscreenButton from "./FullscreenButton.jsx";

// The shared wrapper every engine renders inside. Handles chrome common to
// ALL interactives (title, mode toggle, fullscreen) so new engines inherit
// consistent presentation for free. Interactive-specific teacher/student
// controls are NOT here — they live inside each engine's own teacher/ and
// student/ folders and render as `children`.
export default function InteractiveFrame({ title, subtitle, children, compact = false }) {
  const frameRef = useRef(null);

  return (
    <div
      ref={frameRef}
      className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:justify-center [&:fullscreen]:p-10"
    >
      {!compact && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-medium text-[var(--color-ink)]">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--color-ink-faint)]">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2.5">
            <ModeToggle compact />
            <FullscreenButton targetRef={frameRef} />
          </div>
        </div>
      )}
      <div className={compact ? "p-0" : "p-5 md:p-7"}>{children}</div>
    </div>
  );
}
