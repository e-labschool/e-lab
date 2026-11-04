export default function SceneQuestion({ eyebrow, children }) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{eyebrow}</p>
      )}
      <p className="mt-1 text-lg font-medium text-[var(--color-ink)]">{children}</p>
    </div>
  );
}
