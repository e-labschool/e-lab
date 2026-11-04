import { GraduationCap, Presentation } from "lucide-react";
import Container from "../ui/Container.jsx";
import Card from "../ui/Card.jsx";

export default function AudienceSplit() {
  return (
    <section className="border-b border-[var(--color-line)] py-20">
      <Container>
        <h2 className="mb-10 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Built for both sides of the classroom
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-8">
            <GraduationCap size={22} strokeWidth={1.75} className="text-[var(--color-indigo)]" />
            <h3 className="mt-4 text-lg font-medium text-[var(--color-ink)]">For Students</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-ink-soft)]">
              Explore difficult chemistry concepts through guided interaction,
              visualization and experimentation.
            </p>
          </Card>

          <Card className="p-8">
            <Presentation size={22} strokeWidth={1.75} className="text-[var(--color-amber)]" />
            <h3 className="mt-4 text-lg font-medium text-[var(--color-ink)]">For Teachers</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-ink-soft)]">
              Use interactive visualizations as live classroom teaching and
              explanation tools.
            </p>
          </Card>
        </div>
      </Container>
    </section>
  );
}
