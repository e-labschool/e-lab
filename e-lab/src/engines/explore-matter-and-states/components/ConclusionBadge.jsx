import { Check, X, AlertTriangle } from "lucide-react";

const STYLES = {
  yes: { icon: Check, tone: "text-[var(--color-teal)] border-[var(--color-teal)]/30 bg-[var(--color-teal-soft)]" },
  no: { icon: X, tone: "text-[var(--color-amber)] border-[var(--color-amber)]/30 bg-[var(--color-amber-soft)]" },
  neutral: { icon: null, tone: "text-[var(--color-ink)] border-[var(--color-line)] bg-[var(--color-paper-raised)]" },
  warn: { icon: AlertTriangle, tone: "text-[var(--color-amber)] border-[var(--color-amber)]/30 bg-[var(--color-amber-soft)]" },
};

export default function ConclusionBadge({ tone = "yes", children }) {
  const { icon: Icon, tone: cls } = STYLES[tone] ?? STYLES.neutral;
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium ${cls}`}>
      {Icon && <Icon size={15} />}
      {children}
    </span>
  );
}
