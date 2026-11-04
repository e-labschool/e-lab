import Container from "../ui/Container.jsx";

const VERBS = ["Manipulate", "Observe", "Predict", "Experiment", "Visualize", "Understand"];

export default function LearnByInteracting() {
  return (
    <section className="border-b border-[var(--color-line)] py-20">
      <Container>
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
              Learn by interacting
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--color-ink-soft)]">
              e-Lab is not primarily a notes website. Reading about a concept and
              manipulating it are different experiences — the second one is where
              understanding actually happens. Every interactive here is built for you to
              touch, change and watch respond.
            </p>
          </div>

          <div className="flex flex-wrap content-start gap-2.5">
            {VERBS.map((verb) => (
              <span
                key={verb}
                className="rounded-md border border-[var(--color-line)] px-3.5 py-2 text-sm text-[var(--color-ink-soft)]"
              >
                {verb}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
