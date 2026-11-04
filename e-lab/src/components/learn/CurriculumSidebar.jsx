import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Home, ChevronRight, Circle, CheckCircle2 } from "lucide-react";
import { getLearnTree } from "../../lib/learn-tree.js";
import { useLearningProgress } from "../../context/ProgressContext.jsx";

const SECTION_ACCENT = {
  Structure: { text: "text-[var(--color-indigo)]" },
  Reactivity: { text: "text-[var(--color-amber)]" },
};

function StatusIcon({ status }) {
  if (status === "completed") return <CheckCircle2 size={13} className="shrink-0 text-[var(--color-teal)]" />;
  if (status === "in_progress") return <Circle size={13} className="shrink-0 fill-[var(--color-amber-soft)] text-[var(--color-amber)]" />;
  return <Circle size={13} className="shrink-0 text-[var(--color-line)]" />;
}

// The full curriculum tree, Welcome always first, Structure (cool/indigo)
// and Reactivity (warm/amber) as the two colour families, with subtle
// (non-colour-only) current-item indication via a left border + bold
// weight + icon, per the brief. Only the section/topic containing the
// active concept auto-expands — everything else starts collapsed so 102
// concepts don't turn into one enormous unscrollable list.
export default function CurriculumSidebar({ activeConceptId, basePath }) {
  const tree = getLearnTree();
  const { statusFor } = useLearningProgress();
  const [expandedTopics, setExpandedTopics] = useState(() => new Set());
  const [expandedSubtopics, setExpandedSubtopics] = useState(() => new Set());

  useEffect(() => {
    if (!activeConceptId || !tree) return;
    const ctx = tree.conceptIndex.get(activeConceptId);
    if (!ctx) return;
    setExpandedTopics((prev) => new Set(prev).add(ctx.subtopicCode.slice(0, 2))); // e.g. "S1"
    setExpandedSubtopics((prev) => new Set(prev).add(ctx.subtopicId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConceptId]);

  if (!tree) return null;

  function toggleTopic(unitCode) {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(unitCode)) next.delete(unitCode);
      else next.add(unitCode);
      return next;
    });
  }
  function toggleSubtopic(subtopicId) {
    setExpandedSubtopics((prev) => {
      const next = new Set(prev);
      if (next.has(subtopicId)) next.delete(subtopicId);
      else next.add(subtopicId);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-1 text-sm" aria-label="Curriculum">
      <NavLink
        to={basePath}
        end
        className={({ isActive }) =>
          `flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors ${
            isActive
              ? "border-l-2 border-[var(--color-ink)] bg-[var(--color-line)]/30 font-medium text-[var(--color-ink)]"
              : "border-l-2 border-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/20 hover:text-[var(--color-ink)]"
          }`
        }
      >
        <Home size={15} /> Welcome
      </NavLink>

      <div className="mt-2 flex flex-col gap-3">
        {tree.sections.map((section) => {
          const accent = SECTION_ACCENT[section.label];
          return (
            <div key={section.id}>
              <p className={`px-2.5 text-xs font-semibold uppercase tracking-wide ${accent.text}`}>{section.label}</p>
              <div className="mt-1 flex flex-col gap-0.5">
                {section.topics.map((topic) => {
                  const topicExpanded = expandedTopics.has(topic.code);
                  return (
                    <div key={topic.id}>
                      <button
                        type="button"
                        onClick={() => toggleTopic(topic.code)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/20 hover:text-[var(--color-ink)]"
                      >
                        <ChevronRight size={12} className={`shrink-0 transition-transform ${topicExpanded ? "rotate-90" : ""}`} />
                        <span className="font-medium">{topic.code}</span>
                        <span className="truncate">{topic.label}</span>
                      </button>

                      {topicExpanded && (
                        <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--color-line)] pl-2">
                          {topic.subtopics.map((subtopic) => {
                            const subExpanded = expandedSubtopics.has(subtopic.id);
                            const completedCount = subtopic.concepts.filter((c) => statusFor(c.id) === "completed").length;
                            return (
                              <div key={subtopic.id}>
                                <button
                                  type="button"
                                  onClick={() => toggleSubtopic(subtopic.id)}
                                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/20 hover:text-[var(--color-ink)]"
                                >
                                  <ChevronRight size={11} className={`shrink-0 transition-transform ${subExpanded ? "rotate-90" : ""}`} />
                                  <span className="font-medium">{subtopic.code}</span>
                                  <span className="flex-1 truncate">{subtopic.label}</span>
                                  <span className="text-[10px] text-[var(--color-ink-faint)]">{completedCount}/{subtopic.concepts.length}</span>
                                </button>

                                {subExpanded && (
                                  <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--color-line)] pl-2">
                                    {subtopic.concepts.map((concept) => {
                                      const isActive = concept.id === activeConceptId;
                                      const status = statusFor(concept.id);
                                      return (
                                        <NavLink
                                          key={concept.id}
                                          to={`${basePath}/${concept.id}`}
                                          className={`flex items-center gap-1.5 rounded-md py-1 pl-1.5 pr-2 text-xs transition-colors ${
                                            isActive
                                              ? "border-l-2 border-[var(--color-ink)] bg-[var(--color-line)]/30 font-medium text-[var(--color-ink)]"
                                              : "border-l-2 border-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/20 hover:text-[var(--color-ink)]"
                                          }`}
                                        >
                                          <StatusIcon status={status} />
                                          <span className="truncate">{concept.title}</span>
                                        </NavLink>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
