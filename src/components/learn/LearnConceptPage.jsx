import { useEffect, Suspense } from "react";
import { useParams, useOutletContext, Link, Navigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Lightbulb, AlertTriangle, FlaskConical } from "lucide-react";
import ELabLoader from "../ui/ELabLoader.jsx";
import { getConcept } from "../../data/concepts/index.js";
import { getConceptContext, getAdjacentConcepts } from "../../lib/learn-tree.js";
import { getConceptContent } from "../../data/concept-content.js";
import { getLessonSubsection } from "../../data/lessons/index.js";
import { getCoverageForConcept } from "../../data/coverage-map.js";
import { getResource } from "../../data/resources-registry.js";
import { getLazyResourceComponent } from "../../lib/lazy-resource.js";
import { useLearningProgress } from "../../context/ProgressContext.jsx";
import { usePreferences } from "../../context/PreferencesContext.jsx";
import CheckYourself from "./CheckYourself.jsx";
import LessonSectionPage from "./LessonSectionPage.jsx";

export default function LearnConceptPage() {
  const { conceptId } = useParams();

  // A subtopic with a full e-Lab lesson sequence (see src/data/lessons)
  // renders through LessonSectionPage instead — its IDs never exist in
  // the regular concepts registry (getConcept below), so this check must
  // come first, not as a fallback.
  const lessonSection = getLessonSubsection(conceptId);
  if (lessonSection) return <LessonSectionPage section={lessonSection} />;

  return <RegularConceptPage conceptId={conceptId} />;
}

function RegularConceptPage({ conceptId }) {
  const { basePath } = useOutletContext();
  const concept = getConcept(conceptId);
  const ctx = getConceptContext(conceptId);
  const content = getConceptContent(conceptId);
  const { previous, next } = getAdjacentConcepts(conceptId);
  const { openConcept } = useLearningProgress();
  const { setLastConcept } = usePreferences();

  const coverage = getCoverageForConcept(conceptId);
  const liveResource = coverage.resourceIds.map((id) => getResource(id)).find((r) => r?.status === "live" && r.component);
  const InteractiveComponent = getLazyResourceComponent(liveResource);

  useEffect(() => {
    if (!conceptId) return;
    openConcept(conceptId);
    setLastConcept(conceptId, `${basePath}/${conceptId}`);
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  if (!concept || !ctx) return <Navigate to={basePath} replace />;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Breadcrumb */}
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
        <span>{ctx.topicLabel}</span>
        <ChevronRight size={11} />
        <span>{ctx.subtopicLabel}</span>
        <ChevronRight size={11} />
        <span className="font-medium text-[var(--color-ink-soft)]">{ctx.code} {concept.title}</span>
      </p>

      <h1 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
        {concept.title}
      </h1>

      {content ? (
        <>
          <p className="mt-4 rounded-md bg-[var(--color-indigo-soft)] px-4 py-3 text-sm text-[var(--color-indigo)]">
            {content.learningIntention}
          </p>

          <div className="mt-6 flex flex-col gap-4 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
            {content.explanation.map((para, i) => <p key={i}>{para}</p>)}
          </div>

          <div className="mt-6 flex items-start gap-2.5 rounded-md border border-[var(--color-line)] p-4">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-[var(--color-amber)]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Key idea</p>
              <p className="mt-1 text-sm text-[var(--color-ink)]">{content.keyIdea}</p>
            </div>
          </div>

          {content.workedExample && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-[var(--color-line)] p-4">
              <FlaskConical size={16} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Worked example</p>
                <p className="mt-1 text-sm text-[var(--color-ink)]">{content.workedExample}</p>
              </div>
            </div>
          )}

          {content.misconception && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-[var(--color-line)] p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-coral)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Common misconception</p>
                <p className="mt-1 text-sm text-[var(--color-ink)]">{content.misconception}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 rounded-md border border-dashed border-[var(--color-line)] p-5">
          <p className="text-sm text-[var(--color-ink-soft)]">{concept.description}</p>
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
            The full explanation for this concept is coming soon — you can still explore any interactive below and use Check Yourself.
          </p>
        </div>
      )}

      {InteractiveComponent && (
        <div className="mt-8 -mx-6 sm:mx-0">
          <p className="mb-2 px-6 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)] sm:px-0">Explore</p>
          <Suspense fallback={<div className="flex h-64 items-center justify-center"><ELabLoader size="compact" /></div>}>
            <InteractiveComponent compact />
          </Suspense>
        </div>
      )}

      <div className="mt-10">
        <CheckYourself conceptId={conceptId} />
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-[var(--color-line)] pt-5 text-sm">
        {previous ? (
          <Link to={`${basePath}/${previous.concept.id}`} className="flex items-center gap-1.5 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            <ChevronLeft size={15} />
            <span className="text-left">
              <span className="block text-[11px] text-[var(--color-ink-faint)]">Previous</span>
              {previous.code} {previous.concept.title}
            </span>
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`${basePath}/${next.concept.id}`} className="flex items-center gap-1.5 text-right text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            <span className="text-right">
              <span className="block text-[11px] text-[var(--color-ink-faint)]">Next</span>
              {next.code} {next.concept.title}
            </span>
            <ChevronRight size={15} />
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}
