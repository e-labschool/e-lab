import Container from "../components/ui/Container.jsx";

export default function About() {
  return (
    <Container className="max-w-2xl py-16">
      <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
        About e-Lab
      </h1>
      <div className="mt-6 flex flex-col gap-4 text-base leading-relaxed text-[var(--color-ink-soft)]">
        <p>
          e-Lab is an interactive science platform built for both teachers explaining
          concepts in the classroom and students exploring them independently. The same
          interactive works for both — only the surrounding controls change.
        </p>
        <p>
          Underneath, e-Lab is organized around chemistry concepts that exist
          independently of any one syllabus. The first release maps those concepts to DP
          Chemistry's first-assessment-2025 curriculum, but the concepts and interactives
          themselves don't know that curriculum exists — new curricula and subjects can be
          layered on without rebuilding anything that already works.
        </p>
        <p className="text-sm text-[var(--color-ink-faint)]">
          e-Lab is an independent educational resource and is not affiliated with or
          endorsed by the International Baccalaureate Organization, Cambridge Assessment
          International Education, or any curriculum publisher. All explanations,
          questions, diagrams and interactive content on e-Lab are original.
        </p>
      </div>
    </Container>
  );
}
