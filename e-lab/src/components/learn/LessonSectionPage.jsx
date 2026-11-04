import { useEffect, lazy, Suspense } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, FlaskConical, HelpCircle } from "lucide-react";
import ELabLoader from "../ui/ELabLoader.jsx";
import { getConceptContext, getAdjacentConcepts } from "../../lib/learn-tree.js";
import { getLessonCompletion } from "../../data/lessons/index.js";
import { useLearningProgress } from "../../context/ProgressContext.jsx";
import { usePreferences } from "../../context/PreferencesContext.jsx";
import { AnalogyBlock } from "../lesson/AnalogyBlock.jsx";
import ZoomSequenceVisual from "../lesson/ZoomSequenceVisual.jsx";
import ThreeWayParticlesVisual from "../lesson/ThreeWayParticlesVisual.jsx";
import SideBySideVisual from "../lesson/SideBySideVisual.jsx";
import CheckYourself from "./CheckYourself.jsx";

// The 3D-backed interactives (Three.js/R3F/drei) are lazy-loaded, never
// imported directly here — this file sits on the main Learn route tree,
// so a direct import would pull all of Three.js into every page load
// instead of only when a student actually opens a 3D interactive (the
// exact bundle-weight regression the brief's performance section warns
// against). 2D-only visuals (ZoomSequenceVisual, ThreeWayParticlesVisual,
// SideBySideVisual above) have no such cost and stay as regular imports.
const MatterExplorerInteractive = lazy(() => import("../lesson/MatterExplorerInteractive.jsx"));
const ContainerBuildInteractive = lazy(() => import("../lesson/ContainerBuildInteractive.jsx"));
const MixtureBeakerInteractive = lazy(() => import("../lesson/MixtureBeakerInteractive.jsx"));

const VISUAL_COMPONENTS = { "zoom-sequence": ZoomSequenceVisual, "three-way-particles": ThreeWayParticlesVisual, "side-by-side": SideBySideVisual };
const INTERACTIVE_COMPONENTS = { "particle-box": MatterExplorerInteractive, "container-build": ContainerBuildInteractive, "mixture-beaker": MixtureBeakerInteractive };

function SectionLabel({ children }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{children}</p>;
}

export default function LessonSectionPage({ section }) {
  const { basePath } = useOutletContext();
  const ctx = getConceptContext(section.id);
  const { previous, next } = getAdjacentConcepts(section.id);
  const { openConcept } = useLearningProgress();
  const { setLastConcept } = usePreferences();
  const completion = next ? null : getLessonCompletion(ctx?.subtopicId);

  useEffect(() => {
    openConcept(section.id);
    setLastConcept(section.id, `${basePath}/${section.id}`);
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  const hasFullContent = Boolean(section.simpleExplanation);
  const VisualComponent = section.visual && VISUAL_COMPONENTS[section.visual.type];
  const InteractiveComponent = section.interactive && INTERACTIVE_COMPONENTS[section.interactive.type];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
        <span>{ctx?.topicLabel}</span>
        <ChevronRight size={11} />
        <span>{ctx?.subtopicLabel}</span>
        <ChevronRight size={11} />
        <span className="font-medium text-[var(--color-ink-soft)]">{ctx?.code} {section.title}</span>
      </p>

      <h1 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
        {section.title}
      </h1>

      {!hasFullContent ? (
        <div className="mt-6 rounded-md border border-dashed border-[var(--color-line)] p-5">
          <p className="text-sm text-[var(--color-ink-soft)]">{section.shortDescription}</p>
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">The full lesson for this subsection is coming soon.</p>
        </div>
      ) : (
        <>
          {/* 1. Simple explanation */}
          <div className="mt-5 flex flex-col gap-2.5 text-[15px] leading-relaxed text-[var(--color-ink)]">
            {section.simpleExplanation.map((line, i) => <p key={i}>{line}</p>)}
          </div>

          {/* 2. Real-life analogy */}
          {section.analogy && (
            <div className="mt-6">
              <AnalogyBlock heading={section.analogy.heading} body={section.analogy.body} notice={section.analogy.notice} />
            </div>
          )}

          {/* 3. Visual explanation */}
          {VisualComponent && (
            <div className="mt-6">
              <SectionLabel>See it</SectionLabel>
              <VisualComponent {...section.visual} />
            </div>
          )}

          {/* 4. Proper scientific explanation / definitions */}
          {section.scientificExplanation && (
            <div className="mt-6">
              <SectionLabel>{section.scientificExplanation.heading ?? "The chemistry"}</SectionLabel>
              <div className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                {section.scientificExplanation.body.map((p, i) => <p key={i}>{p}</p>)}
              </div>

              {section.scientificExplanation.definitions?.map((def) => (
                <div key={def.term} className="mt-4 rounded-md border border-[var(--color-line)] p-4">
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{def.term}</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{def.body}</p>
                  {def.examples && (
                    <p className="mt-2 text-xs text-[var(--color-ink-faint)]">Examples: {def.examples.join(" · ")}</p>
                  )}
                  {def.emphasize && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {def.emphasize.map((e) => (
                        <span key={e} className="rounded-full bg-[var(--color-indigo-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-indigo)]">{e}</span>
                      ))}
                    </div>
                  )}
                  {def.misconception && (
                    <div className="mt-3 flex items-start gap-2 rounded-md bg-[var(--color-amber-soft)] px-3 py-2 text-xs text-[var(--color-amber)]">
                      <HelpCircle size={14} className="mt-0.5 shrink-0" />
                      <span><strong>{def.misconception.question}</strong> {def.misconception.answer}</span>
                    </div>
                  )}
                </div>
              ))}

              {section.scientificExplanation.modelReminder && (
                <div className="mt-4 flex items-start gap-2.5 rounded-md border border-[var(--color-line)] p-4">
                  <FlaskConical size={16} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Model reminder</p>
                    <p className="mt-1 text-sm text-[var(--color-ink)]">{section.scientificExplanation.modelReminder}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Simulation / interactive */}
          {InteractiveComponent && (
            <div className="mt-8">
              <SectionLabel>Try it yourself{section.interactive.title ? ` — ${section.interactive.title}` : ""}</SectionLabel>
              <Suspense fallback={<div className="flex h-48 items-center justify-center"><ELabLoader size="compact" /></div>}>
                <InteractiveComponent {...section.interactive} />
              </Suspense>
              {section.interactive.after && (
                <div className="mt-3 rounded-md bg-[var(--color-indigo-soft)] px-4 py-3 text-sm text-[var(--color-indigo)]">
                  <strong>{section.interactive.afterLabel}</strong> {section.interactive.after}
                </div>
              )}
            </div>
          )}

          {/* Summary, when the section has one */}
          {section.summary && (
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {section.summary.map((row) => (
                <div key={row.label} className="rounded-md border border-[var(--color-line)] p-3">
                  <p className="text-xs font-semibold text-[var(--color-ink)]">{row.label}</p>
                  <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{row.value}</p>
                </div>
              ))}
            </div>
          )}

          {section.closing && (
            <div className="mt-6 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 text-center">
              <p className="text-sm font-medium text-[var(--color-ink)]">{section.closing.summaryLabel}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{section.closing.summary}</p>
              <div className="mt-2 flex justify-center gap-2 text-xs font-medium text-[var(--color-indigo)]">
                {section.closing.levels.map((l, i) => (
                  <span key={l}>{l}{i < section.closing.levels.length - 1 && <span className="mx-1.5 text-[var(--color-ink-faint)]">{"\u2195"}</span>}</span>
                ))}
              </div>
            </div>
          )}

          {/* 6. Check Yourself */}
          <div className="mt-10">
            <CheckYourself conceptId={section.id} />
          </div>
        </>
      )}

      {completion && (
        <div className="mt-10 rounded-lg border border-[var(--color-teal)]/30 bg-[var(--color-teal-soft)] p-6 text-center">
          <p className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-teal)]">{completion.heading}</p>
          <p className="mt-2 text-sm text-[var(--color-ink)]">{completion.intro}</p>
          <ul className="mx-auto mt-2 max-w-sm space-y-1 text-left text-sm text-[var(--color-ink-soft)]">
            {completion.outcomes.map((o) => <li key={o}>{"\u2713"} {o}</li>)}
          </ul>
        </div>
      )}

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
