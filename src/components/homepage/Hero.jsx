import Container from "../ui/Container.jsx";

// The homepage hero's entire job is identity: a large, untouched logo asset
// plus the tagline. Role selection lives in RoleCards immediately below —
// this component deliberately contains no navigation, no CTAs, no cards.
export default function Hero() {
  return (
    <section className="py-20 md:py-28">
      <Container className="flex flex-col items-center text-center">
        <span className="inline-flex items-center justify-center rounded-2xl dark:bg-white dark:px-8 dark:py-6">
          <img
            src="/branding/e-lab-logo.png"
            alt="e-Lab"
            className="h-20 w-auto object-contain sm:h-28 md:h-32"
          />
        </span>
        <p className="mt-8 text-xl text-[var(--color-ink-soft)] md:text-2xl">
          Explore. Experiment. Understand.
        </p>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--color-ink-soft)]">
          Interactive science learning that transforms complex concepts into visual
          experiences.
        </p>
      </Container>
    </section>
  );
}
