import Container from "../../components/ui/Container.jsx";

// Placeholder only, per spec — no form/question-bank/paper-settings/export
// UI yet. Full Question Builder specification to follow separately.
export default function QBuilder() {
  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Q Builder</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Question Builder
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Build worksheets, tests and school question papers.
        </p>
      </div>
    </Container>
  );
}
