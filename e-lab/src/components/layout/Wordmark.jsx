import { Link } from "react-router-dom";

// Official e-Lab brand mark. Renders the supplied logo assets exactly as
// provided (public/branding/) — no redrawing, no recolouring. Below the
// `sm` breakpoint the full horizontal logo gives way to the beaker icon
// alone, since the wordmark becomes illegible at very narrow widths.
//
// The full logo's "Lab" text is a fixed dark charcoal, which has poor
// contrast against a dark background. Rather than alter the asset's
// colours, a small light backing plate appears behind it — either when
// the app's dark THEME is active (`dark:` variant, tied to the toggle),
// or unconditionally via `onDark` when this Wordmark sits inside a
// permanently-dark surface (e.g. the app's dark sidebar) regardless of
// the light/dark theme toggle — those are two independent concerns.
export default function Wordmark({ className = "", withTagline = false, onDark = false }) {
  return (
    <Link to="/" className={`group inline-flex flex-col leading-none ${className}`}>
      <span className={`inline-flex items-center rounded-md ${onDark ? "bg-white px-2 py-1" : "dark:bg-white dark:px-2 dark:py-1"}`}>
        <img
          src="/branding/e-lab-logo.png"
          alt="e-Lab"
          className="hidden h-8 w-auto object-contain sm:block"
        />
        <img
          src="/branding/e-lab-icon.png"
          alt="e-Lab"
          className="h-8 w-8 object-contain sm:hidden"
        />
      </span>
      {withTagline && (
        <span className={`mt-1.5 text-xs ${onDark ? "text-white/50" : "text-[var(--color-ink-faint)]"}`}>
          Explore. Experiment. Understand.
        </span>
      )}
    </Link>
  );
}
