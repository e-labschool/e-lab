import { Link } from "react-router-dom";

// Official e-Lab brand mark. Renders the supplied logo assets exactly as
// provided (public/branding/) — no redrawing, no recolouring. Below the
// `sm` breakpoint the full horizontal logo gives way to the beaker icon
// alone, since the wordmark becomes illegible at very narrow widths.
//
// The full logo's "Lab" text is a fixed dark charcoal, which has poor
// contrast against the near-black dark-theme background. Rather than alter
// the asset's colours, a small light backing plate appears behind it in
// dark mode only — the pixels themselves are untouched.
export default function Wordmark({ className = "", withTagline = false }) {
  return (
    <Link to="/" className={`group inline-flex flex-col leading-none ${className}`}>
      <span className="inline-flex items-center rounded-md dark:bg-white dark:px-2 dark:py-1">
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
        <span className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
          Explore. Interact. Understand.
        </span>
      )}
    </Link>
  );
}
