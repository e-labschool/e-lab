import { Construction } from "lucide-react";

// Reused for every admin section beyond the Dashboard for this first
// foundation pass — a real, honest "coming soon" state (not a fake button
// that does nothing), per the brief's explicit instruction not to build
// placeholder functionality behind these yet.
export default function AdminComingSoon({ title, description }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{title}</h1>
      {description && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{description}</p>}

      <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--color-line)] py-20 text-center">
        <Construction size={22} className="text-[var(--color-ink-faint)]" />
        <p className="text-sm font-medium text-[var(--color-ink)]">Coming soon</p>
        <p className="max-w-xs text-xs text-[var(--color-ink-faint)]">This section will be built next, as its own dedicated stage.</p>
      </div>
    </div>
  );
}
