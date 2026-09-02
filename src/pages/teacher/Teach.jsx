import { useOutletContext, Link } from "react-router-dom";
import { ArrowRight, Presentation } from "lucide-react";
import { getAllResources } from "../../data/resources-registry.js";
import { getConcept } from "../../data/concepts/index.js";
import Container from "../../components/ui/Container.jsx";
import Card from "../../components/ui/Card.jsx";
import EmptyStatePanel from "../../components/ui/EmptyStatePanel.jsx";

// Lists resources authored for the classroom (audience === "teacher"),
// grouped by their primary concept's title so a teacher sees "States of
// Matter" rather than a Teacher-Resource label repeated on every card —
// the context (they're inside Teacher -> Teach) already makes that obvious.
export default function Teach() {
  const { subject } = useOutletContext();
  const teacherResources = getAllResources().filter((r) => r.audience === "teacher");

  const grouped = teacherResources.reduce((acc, resource) => {
    const primaryConcept = getConcept(resource.conceptIds[0]);
    const topicLabel = primaryConcept?.title ?? "General";
    if (!acc[topicLabel]) acc[topicLabel] = [];
    acc[topicLabel].push(resource);
    return acc;
  }, {});

  const topics = Object.entries(grouped);

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Teach</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Teach {subject.label} visually
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Classroom-ready, teacher-led experiences built for a projector or smartboard.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-8">
        {topics.length === 0 && (
          <EmptyStatePanel
            icon={Presentation}
            title="Teaching experiences are on the way"
            description="Teacher-led simulations will appear here, organized by topic, as they're built."
          />
        )}
        {topics.map(([topicLabel, resources]) => (
          <div key={topicLabel}>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
              {topicLabel}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {resources.map((resource) => (
                <Link key={resource.id} to={`/interactives/${resource.id}`}>
                  <Card className="flex items-center justify-between gap-3 p-5 transition-colors hover:border-[var(--color-ink)]">
                    <div>
                      <p className="text-base font-medium text-[var(--color-ink)]">{resource.title}</p>
                      {resource.subtitle && <p className="text-xs text-[var(--color-ink-faint)]">{resource.subtitle}</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm text-[var(--color-indigo)]">
                      Open <ArrowRight size={14} />
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
