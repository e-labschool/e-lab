import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { getLearnCmsCurriculumTree } from "../../data/learnCmsCurriculum.js";
import { listPublishedLessonMeta } from "../../lib/learnContentService.js";

export default function LearnCmsSidebar({ activeConceptId: activePageId, basePath }) {
  const [lessonsByTopic, setLessonsByTopic] = useState(null); // null while loading
  const [openTopics, setOpenTopics] = useState(new Set());
  const tree = getLearnCmsCurriculumTree();

  useEffect(() => {
    listPublishedLessonMeta()
      .then((rows) => {
        // Lessons are grouped by parent_topic, which is always a
        // SUBTOPIC id (e.g. "structure-1.1") — never the higher-level
        // topic/unit id (e.g. "structure-1"). Grouping at the wrong
        // level here was the exact reason a published lesson never
        // appeared: this lookup key must match what Admin actually
        // stores, confirmed directly against learnCmsCurriculum.js's
        // own tree shape rather than assumed.
        const grouped = {};
        for (const row of rows) (grouped[row.parent_topic] ??= []).push(row);
        setLessonsByTopic(grouped);
        // Auto-expand the topic containing the currently open lesson, if any.
        if (activePageId) {
          const active = rows.find((r) => r.id === activePageId);
          if (active) setOpenTopics(new Set([active.parent_topic]));
        }
      })
      .catch(() => setLessonsByTopic({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSubtopic(subtopicId) {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(subtopicId)) next.delete(subtopicId); else next.add(subtopicId);
      return next;
    });
  }

  if (lessonsByTopic === null) {
    return <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-[var(--color-ink-faint)]" /></div>;
  }

  return (
    <nav className="space-y-5">
      {tree.map((section) => (
        <div key={section.id}>
          <p className="mb-1.5 px-1 text-[17px] font-bold tracking-tight text-[var(--color-ink)]">{section.label}</p>
          <div className="space-y-2.5">
            {section.topics.map((topic) => (
              <div key={topic.id}>
                <p className="px-1 text-[15px] font-medium text-[var(--color-ink-soft)]">{topic.label}</p>
                <div className="mt-0.5 space-y-0.5">
                  {topic.subtopics.map((subtopic) => {
                    const isOpen = openTopics.has(subtopic.id);
                    const lessons = (lessonsByTopic[subtopic.id] ?? []).sort((a, b) => a.display_order - b.display_order);
                    return (
                      <div key={subtopic.id}>
                        <button
                          type="button"
                          onClick={() => toggleSubtopic(subtopic.id)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[14px] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"
                        >
                          <span>{subtopic.label}</span>
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        {isOpen && (
                          <div className="ml-2 border-l border-[var(--color-line)] pl-3">
                            {lessons.length === 0 ? (
                              <p className="px-2 py-2 text-xs text-[var(--color-ink-faint)]">Learning content coming soon.</p>
                            ) : (
                              lessons.map((lesson) => (
                                <Link
                                  key={lesson.id}
                                  to={`${basePath}/${lesson.id}`}
                                  className={`block rounded-md px-2 py-1.5 text-[14px] leading-snug ${
                                    lesson.id === activePageId
                                      ? "bg-[var(--color-indigo-soft)] font-medium text-[var(--color-indigo)]"
                                      : "text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"
                                  }`}
                                >
                                  <span className="font-mono text-xs">{lesson.lesson_code}</span> {lesson.title}
                                </Link>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
