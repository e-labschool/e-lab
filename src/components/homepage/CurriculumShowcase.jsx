import { Link } from "react-router-dom";
import { getCurriculum } from "../../data/curricula/index.js";
import Container from "../ui/Container.jsx";
import Card from "../ui/Card.jsx";

// Renders section cards generated entirely from curriculum metadata — this
// component has no idea "Structure" and "Reactivity" are the section names
// until it reads the curriculum map at runtime. A future curriculum with
// completely different section names needs zero changes here.
export default function CurriculumShowcase() {
  const curriculum = getCurriculum("dp-chemistry", "2025");
  if (!curriculum) return null;

  return (
    <section className="py-20">
      <Container>
        <div className="mb-10">
          <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            Explore DP Chemistry
          </h2>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{curriculum.label}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {curriculum.sections.map((section) => {
            const subtopicCount = section.topics.reduce((sum, t) => sum + t.subtopics.length, 0);
            return (
              <Link key={section.id} to={`/explore/dp-chemistry#${section.id}`}>
                <Card className="p-8 transition-colors hover:border-[var(--color-ink)]">
                  <h3 className="text-xl font-medium text-[var(--color-ink)]">{section.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                    {section.description}
                  </p>
                  <p className="mt-4 text-xs text-[var(--color-ink-faint)]">
                    {section.topics.length} topics &middot; {subtopicCount} subtopics
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
