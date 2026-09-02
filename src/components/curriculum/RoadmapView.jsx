import { Link } from "react-router-dom";
import { getCoverageForConcept } from "../../data/coverage-map.js";

const STATUS_DOT = {
  live: "bg-[var(--color-teal)]",
  "in-development": "bg-[var(--color-amber)]",
  planned: "bg-[var(--color-ink-faint)]",
  uncovered: "bg-transparent border border-[var(--color-line)]",
};

// Renders a curriculum's tree purely from the generic sections/topics/subtopics
// schema. No section, topic, or subtopic label is assumed or hardcoded here —
// this same component renders Structure/Reactivity today and would render an
// entirely different section structure for a future curriculum unchanged.
export default function RoadmapView({ roadmap }) {
  return (
    <div className="flex flex-col gap-16">
      {roadmap.sections.map((section) => (
        <div key={section.id} id={section.id}>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            {section.label}
          </h2>
          {section.description && (
            <p className="mt-1.5 max-w-xl text-sm text-[var(--color-ink-soft)]">{section.description}</p>
          )}

          <div className="mt-8 flex flex-col gap-10">
            {section.topics.map((topic) => (
              <div key={topic.id}>
                <h3 className="text-base font-medium text-[var(--color-ink)]">{topic.label}</h3>
                <div className="mt-4 flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
                  {topic.subtopics.map((subtopic) => (
                    <div key={subtopic.id} className="flex flex-col gap-2.5 py-4">
                      <span className="text-sm text-[var(--color-ink-soft)]">{subtopic.label}</span>
                      <div className="flex flex-wrap gap-2">
                        {subtopic.concepts.map((concept) => {
                          const coverage = getCoverageForConcept(concept.id);
                          return (
                            <Link
                              key={concept.id}
                              to={`/topics/${concept.id}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[coverage.coverageStatus]}`}
                                aria-hidden="true"
                              />
                              {concept.title}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
