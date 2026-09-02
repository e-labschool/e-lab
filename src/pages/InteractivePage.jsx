import { Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { getResource } from "../data/resources-registry.js";
import { getConcept } from "../data/concepts/index.js";
import { getLazyResourceComponent } from "../lib/lazy-resource.js";
import Container from "../components/ui/Container.jsx";
import Badge from "../components/ui/Badge.jsx";
import InteractiveFrame from "../components/interactive-shell/InteractiveFrame.jsx";

const STATUS_TONE = { live: "teal", "in-development": "amber", planned: "neutral" };
const STATUS_LABEL = { live: "Live", "in-development": "In development", planned: "Planned" };

export default function InteractivePage() {
  const { interactiveId } = useParams();
  const resource = getResource(interactiveId);
  const EngineComponent = resource?.status === "live" ? getLazyResourceComponent(resource) : null;

  if (!resource) {
    return (
      <Container className="py-20">
        <p className="text-[var(--color-ink-soft)]">
          We don&rsquo;t have an interactive called &ldquo;{interactiveId}&rdquo;.{" "}
          <Link to="/interactives" className="underline">Back to Interactives</Link>
        </p>
      </Container>
    );
  }

  const concepts = resource.conceptIds.map((id) => getConcept(id)).filter(Boolean);

  return (
    <Container className="py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <Link to="/interactives" className="text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
            &larr; Interactives
          </Link>
          <h1 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            {resource.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{resource.description}</p>
        </div>
        <Badge tone={STATUS_TONE[resource.status]}>{STATUS_LABEL[resource.status]}</Badge>
      </div>

      {EngineComponent ? (
        <Suspense
          fallback={
            <div className="flex h-96 items-center justify-center rounded-lg border border-[var(--color-line)] text-sm text-[var(--color-ink-faint)]">
              Loading interactive&hellip;
            </div>
          }
        >
          <EngineComponent />
        </Suspense>
      ) : (
        <InteractiveFrame title={resource.title} compact>
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--color-line)] px-6 py-16 text-center">
            <Clock size={22} className="text-[var(--color-ink-faint)]" />
            <p className="text-sm text-[var(--color-ink-soft)]">
              This {resource.resourceType.replace(/-/g, " ")} is {resource.status === "in-development" ? "in development" : "planned"} and not yet built.
            </p>
          </div>
        </InteractiveFrame>
      )}

      {concepts.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
            Covers these concepts
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {concepts.map((concept) => (
              <Link
                key={concept.id}
                to={`/topics/${concept.id}`}
                className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
              >
                {concept.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
