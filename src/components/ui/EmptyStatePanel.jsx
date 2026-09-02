export default function EmptyStatePanel({ icon: Icon, title, description, items }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-line)] px-8 py-14 text-center">
      {Icon && <Icon size={22} className="mx-auto text-[var(--color-ink-faint)]" strokeWidth={1.75} />}
      <p className="mt-4 text-sm font-medium text-[var(--color-ink)]">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-ink-soft)]">{description}</p>}
      {items && items.length > 0 && (
        <ul className="mx-auto mt-5 flex max-w-xs flex-col gap-1 text-xs text-[var(--color-ink-faint)]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
