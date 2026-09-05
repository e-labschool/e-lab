import Container from "../ui/Container.jsx";

// One reusable section, used twice (Students / Teachers) rather than two
// hand-duplicated blocks — compact sharp-edged tinted boxes, never the
// oversized card the brief explicitly warns against.
export default function FeatureSection({ title, accentHex, accentSoftVar, items }) {
  return (
    <section className="py-8 md:py-10">
      <Container>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accentHex }}>{title}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              className="rounded-md border border-[var(--color-line)] p-4 shadow-[0_1px_2px_rgba(20,30,80,0.05)]"
              style={{ backgroundColor: `var(${accentSoftVar})` }}
            >
              <Icon size={20} style={{ color: accentHex }} strokeWidth={1.75} />
              <p className="mt-2.5 text-sm font-bold text-[var(--color-ink)]">{label}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">{description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
