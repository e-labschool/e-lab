import { Link } from "react-router-dom";

// Clean typographic wordmark. Deliberately not an image logo yet — swap this
// component's internals for an SVG mark later without touching anything
// that renders <Wordmark />.
export default function Wordmark({ className = "", withTagline = false }) {
  return (
    <Link to="/" className={`group inline-flex flex-col leading-none ${className}`}>
      <span className="font-[var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-ink)]">
        e<span className="text-[var(--color-indigo)]">-</span>Lab
      </span>
      {withTagline && (
        <span className="mt-1 text-xs text-[var(--color-ink-faint)]">
          Explore. Interact. Understand.
        </span>
      )}
    </Link>
  );
}
