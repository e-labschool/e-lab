const TONES = {
  neutral: "text-[var(--color-ink-soft)] border-[var(--color-line)]",
  indigo: "text-[var(--color-indigo)] border-[var(--color-indigo)]/30 bg-[var(--color-indigo-soft)]",
  amber: "text-[var(--color-amber)] border-[var(--color-amber)]/30 bg-[var(--color-amber-soft)]",
  teal: "text-[var(--color-teal)] border-[var(--color-teal)]/30 bg-[var(--color-teal-soft)]",
  coral: "text-[var(--color-coral)] border-[var(--color-coral)]/30 bg-[var(--color-coral-soft)]",
  violet: "text-[var(--color-violet)] border-[var(--color-violet)]/30 bg-[var(--color-violet-soft)]",
};

export default function Badge({ tone = "neutral", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
