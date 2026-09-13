import { COPYRIGHT_TEXT, COPYRIGHT_TEXT_COMPACT } from "../../data/copyright.js";

// One reusable notice, used everywhere a copyright line is needed —
// wording/year only ever changes in src/data/copyright.js. `variant`
// controls placement/sizing only, never the text itself:
//   "footer"      — full-width app/site footer (Student/Teacher/Admin shells, auth pages)
//   "lesson"      — bottom of Learn lesson content, after the material
//   "simulation"  — tiny corner notice inside a simulation frame
export default function CopyrightNotice({ variant = "footer", className = "" }) {
  if (variant === "simulation") {
    return (
      <p className={`select-none text-[10px] text-[var(--color-ink-faint)] opacity-70 ${className}`}>
        {COPYRIGHT_TEXT_COMPACT}
      </p>
    );
  }

  if (variant === "lesson") {
    return (
      <p className={`mt-10 border-t border-[var(--color-line)] pt-4 text-center text-xs text-[var(--color-ink-faint)] ${className}`}>
        {COPYRIGHT_TEXT}
      </p>
    );
  }

  // "footer" — compact single line, safe inside a flex column shell
  return (
    <footer className={`border-t border-[var(--color-line)] px-4 py-3 text-center text-xs text-[var(--color-ink-faint)] ${className}`}>
      {COPYRIGHT_TEXT}
    </footer>
  );
}
