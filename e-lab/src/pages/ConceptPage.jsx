import { Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import { getConcept } from "../data/concepts/index.js";
import { getCoverageForConcept } from "../data/coverage-map.js";
import { getResource } from "../data/resources-registry.js";
import ELabLoader from "../components/ui/ELabLoader.jsx";
import { getCurriculumLocationsForConcept } from "../lib/curriculum-resolver.js";
import { getLazyResourceComponent } from "../lib/lazy-resource.js";
import Container from "../components/ui/Container.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import RelatedConcepts from "../components/concept/RelatedConcepts.jsx";

const STATUS_TONE = { live: "teal", "in-development": "amber", planned: "neutral" };
const STATUS_LABEL = { live: "Live", "in-development": "In development", planned: "Planned" };

export default function ConceptPage() {
  const { conceptId } = useParams();
  const concept = getConcept(conceptId);
  const coverage = getCoverageForConcept(conceptId);
  const resources = coverage.resourceIds.map((id) => getResource(id)).filter(Boolean);
  const teacherResources = resources.filter((r) => r.audience === "teacher");
  const otherResources = resources.filter((r) => r.audience !== "teacher");
  const primaryLiveResource = resources.find((r) => r.status === "live" && r.component);
  const locations = getCurriculumLocationsForConcept(conceptId);
  const PreviewComponent = getLazyResourceComponent(primaryLiveResource);

  if (!concept) {
    return (
      <Container className="py-20">
        <p className="text-[var(--color-ink-soft)]">
          We don&rsquo;t have a concept called &ldquo;{conceptId}&rdquo;.{" "}
          <Link to="/topics" className="underline">Back to Topics</Link>
        </p>
      </Container>
    );
  }

  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <Link to="/topics" className="text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
          &larr; Topics
        </Link>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
          {concept.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--color-ink-soft)]">
          {concept.description}
        </p>
      </div>

      {locations.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {locations.map((loc) => (
            <Badge key={loc.subtopicId} tone="indigo">
              {loc.curriculumLabel}: {loc.subtopicLabel}
            </Badge>
          ))}
        </div>
      )}

      {PreviewComponent && (
        <div className="mt-12">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-[var(--color-line)] px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-[var(--color-ink)]">
                  Try it: {primaryLiveResource.title}
                </h2>
                <Button to={`/interactives/${primaryLiveResource.id}`} variant="ghost" size="sm">
                  Open full interactive
                </Button>
              </div>
            </div>
            <div className="p-6">
              <Suspense fallback={<div className="flex h-40 items-center justify-center"><ELabLoader size="compact" /></div>}>
                <PreviewComponent compact />
              </Suspense>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-12 grid gap-10 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-10">
          <RelatedConcepts conceptIds={concept.relatedConcepts} />
        </div>

        <div className="flex flex-col gap-8">
          {teacherResources.length > 0 && (
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
                Teacher Resources
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {teacherResources.map((resource) => (
                  <Link
                    key={resource.id}
                    to={`/interactives/${resource.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-line)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--color-ink)]"
                  >
                    <span className="text-[var(--color-ink)]">
                      {resource.title}
                      {resource.subtitle && (
                        <span className="block text-xs font-normal text-[var(--color-ink-faint)]">{resource.subtitle}</span>
                      )}
                    </span>
                    <Badge tone={STATUS_TONE[resource.status]}>{STATUS_LABEL[resource.status]}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
              Resources
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {resources.length === 0 && (
                <p className="text-sm text-[var(--color-ink-faint)]">No resource mapped yet.</p>
              )}
              {otherResources.length === 0 && teacherResources.length > 0 && (
                <p className="text-sm text-[var(--color-ink-faint)]">See Teacher Resources above.</p>
              )}
              {otherResources.map((resource) => (
                <Link
                  key={resource.id}
                  to={`/interactives/${resource.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-line)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--color-ink)]"
                >
                  <span className="text-[var(--color-ink)]">{resource.title}</span>
                  <Badge tone={STATUS_TONE[resource.status]}>{STATUS_LABEL[resource.status]}</Badge>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
