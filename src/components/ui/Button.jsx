import { Link } from "react-router-dom";

const VARIANTS = {
  primary:
    "bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-indigo)] border border-transparent",
  secondary:
    "bg-transparent text-[var(--color-ink)] border border-[var(--color-line)] hover:border-[var(--color-ink)]",
  ghost:
    "bg-transparent text-[var(--color-ink-soft)] border border-transparent hover:text-[var(--color-ink)]",
  danger:
    // Fixed (not theme-adaptive) — --color-coral is a soft accent meant as
    // TEXT on light-tinted backgrounds, not a solid button fill; using it
    // directly here gave only 2.46:1 white-on-coral contrast in dark mode.
    // #A5362A keeps white-text contrast >=5.9:1 in both light and dark.
    "bg-[#A5362A] text-white hover:bg-[#8C2E24] border border-transparent",
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
