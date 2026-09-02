import { useOutletContext } from "react-router-dom";
import { buildRoadmap } from "../../lib/curriculum-resolver.js";
import Container from "../../components/ui/Container.jsx";
import RoadmapView from "../../components/curriculum/RoadmapView.jsx";

// Reuses the exact same curriculum-resolver + RoadmapView already used by
// /explore/:curriculumId — Learn is a curated entry point onto the same
// concept data, not a second copy of it.
export default function Learn() {
  const { subject } = useOutletContext();
  const roadmap = buildRoadmap(subject.curriculumId, undefined);

  if (!roadmap) return null;

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Learn</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Understand {subject.label}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Concept explanations, visual learning and interactive simulations, organized the way
          {" "}{roadmap.label} is taught.
        </p>
      </div>

      <div className="mt-12">
        <RoadmapView roadmap={roadmap} />
      </div>
    </Container>
  );
}
