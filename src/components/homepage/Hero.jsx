import Container from "../ui/Container.jsx";

// The hero's job is identity + a slightly richer pitch — logo, tagline,
// description, and one understated curriculum note. Role selection lives
// in RoleCards immediately below; no CTAs or cards live here.
export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-10 md:pt-20 md:pb-12">
      {/* Extremely faint radial tint behind the logo — depth without a busy background. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background: "radial-gradient(ellipse 640px 320px at 50% 0%, var(--color-indigo-soft), transparent 70%)",
          opacity: 0.6,
        }}
      />

      <Container className="flex flex-col items-center text-center">
        <span className="inline-flex items-center justify-center rounded-2xl dark:bg-white dark:px-8 dark:py-6">
          <img
            src="/branding/e-lab-logo.png"
            alt="e-Lab"
            className="h-16 w-auto object-contain sm:h-20 md:h-24"
          />
        </span>
        <p className="mt-6 text-xl text-[var(--color-ink-soft)] md:text-2xl">
          Making Science Interactive.
        </p>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--color-ink-soft)]">
          Explore difficult science concepts through interactive models, simulations and
          visual learning experiences designed for students and teachers.
        </p>
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          Currently featuring IB Diploma Chemistry
        </p>
      </Container>
    </section>
  );
}
