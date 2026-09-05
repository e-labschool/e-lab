import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext.jsx";

// `onDark` mirrors Wordmark's prop: this control needs to stay visible
// when placed on a permanently-dark surface (the app sidebar) regardless
// of which light/dark THEME is currently active — the two are
// independent. Without it, ink-soft/color-line (dark in light theme)
// would be nearly invisible against the sidebar's fixed dark background.
export default function ThemeToggle({ onDark = false }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
        onDark ? "border-white/15 text-[#8C97B8] hover:text-white" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      }`}
    >
      {theme === "light" ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
    </button>
  );
}
