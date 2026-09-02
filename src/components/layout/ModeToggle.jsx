import { GraduationCap, Presentation } from "lucide-react";
import { useMode } from "../../context/ModeContext.jsx";

export default function ModeToggle({ compact = false }) {
  const { mode, setMode } = useMode();

  return (
    <div
      role="radiogroup"
      aria-label="Viewing mode"
      className="inline-flex items-center rounded-full border border-[var(--color-line)] p-0.5 text-sm"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "student"}
        onClick={() => setMode("student")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
          mode === "student"
            ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
            : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        }`}
      >
        <GraduationCap size={15} strokeWidth={2} />
        {!compact && "Student"}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "teacher"}
        onClick={() => setMode("teacher")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
          mode === "teacher"
            ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
            : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        }`}
      >
        <Presentation size={15} strokeWidth={2} />
        {!compact && "Teacher"}
      </button>
    </div>
  );
}
