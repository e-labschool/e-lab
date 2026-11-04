import { useParams, Link } from "react-router-dom";
import { buildRoadmap } from "../lib/curriculum-resolver.js";
import Container from "../components/ui/Container.jsx";
import RoadmapView from "../components/curriculum/RoadmapView.jsx";

export default function ExploreCurriculum() {
  const { curriculumId } = useParams();
  // v1 only has one version per curriculum; a later version param would resolve here too.
  const roadmap = buildRoadmap(curriculumId, undefined);

  if (!roadmap) {
    return (
      <Container className="py-20">
        <p className="text-[var(--color-ink-soft)]">
          We don&rsquo;t have a curriculum map for &ldquo;{curriculumId}&rdquo; yet.{" "}
          <Link to="/explore" className="underline">Back to Explore</Link>
        </p>
      </Container>
    );
  }

  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <Link to="/explore" className="text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
          &larr; Explore
        </Link>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
          {roadmap.label}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Tap any concept to open its page — predictions, hints and the full interactive
          all live there, independent of where it sits in this roadmap.
        </p>
      </div>

      <div className="mt-14">
        <RoadmapView roadmap={roadmap} />
      </div>
    </Container>
  );
}
