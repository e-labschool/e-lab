import Container from "../ui/Container.jsx";

// The hero's job is identity + a slightly richer pitch — logo, tagline,
// description, and one understated curriculum note. Role selection lives
// in RoleCards immediately below; no CTAs or cards live here.
export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-8 md:pt-14 md:pb-10">
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
            className="h-14 w-auto object-contain sm:h-16 md:h-20"
          />
        </span>
        <p className="mt-4 text-xl text-[var(--color-ink-soft)] md:text-2xl">
          Making Science Interactive.
        </p>
        <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-[var(--color-ink-soft)]">
          e-Lab is a visual and interactive learning platform built for students and teachers.
          Designed by educators, it brings together concept learning, assessment, progress
          tracking, teaching tools and academic resources in one focused science learning environment.
        </p>
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          Currently featuring IB Diploma Chemistry
        </p>
      </Container>
    </section>
  );
}
