import { Link } from "react-router-dom";

// Primary buttons are the app's main "dark contrasting button" per the
// e-Lab visual system — a deep indigo fill with explicit white text
// (deliberately NOT `text-[var(--color-paper)]`, since paper is now a
// pale blue-lavender tint, not white — button text needs to stay white
// regardless of what the page background tint happens to be).
const VARIANTS = {
  primary:
    "bg-[#2647C4] text-white hover:bg-[#3654D6] border border-transparent shadow-[0_1px_2px_rgba(20,30,80,0.15),0_4px_10px_-2px_rgba(20,30,80,0.25)] hover:shadow-[0_2px_4px_rgba(20,30,80,0.18),0_8px_16px_-4px_rgba(20,30,80,0.3)] hover:-translate-y-px",
  secondary:
    "bg-[var(--color-paper-raised)] text-[var(--color-ink)] border border-[var(--color-line)] shadow-[0_1px_2px_rgba(20,30,80,0.06)] hover:border-[var(--color-ink)]/40 hover:shadow-[0_2px_6px_rgba(20,30,80,0.1)] hover:-translate-y-px",
  ghost:
    "bg-transparent text-[var(--color-ink-soft)] border border-transparent hover:bg-[var(--color-ink)]/5 hover:text-[var(--color-ink)]",
  danger:
    // Fixed (not theme-adaptive) — --color-coral is a soft accent meant as
    // TEXT on light-tinted backgrounds, not a solid button fill; using it
    // directly here gave only 2.46:1 white-on-coral contrast in dark mode.
    // #A5362A keeps white-text contrast >=5.9:1 in both light and dark.
    "bg-[#A5362A] text-white hover:bg-[#8C2E24] border border-transparent shadow-[0_1px_2px_rgba(20,30,80,0.15),0_4px_10px_-2px_rgba(20,30,80,0.2)] hover:-translate-y-px",
};

const SIZES = {
  md: "px-5 py-2.5 text-[0.9375rem]",
  lg: "px-6 py-3 text-base",
  sm: "px-3.5 py-1.5 text-sm",
};

export default function Button({
  as,
  to,
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)] disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  const Component = as || "button";
  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
