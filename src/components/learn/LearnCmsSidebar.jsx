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

  function toggleTopic(topicId) {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId); else next.add(topicId);
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
          <div className="space-y-0.5">
            {section.topics.map((topic) => {
              const isOpen = openTopics.has(topic.id);
              const lessons = (lessonsByTopic[topic.id] ?? []).sort((a, b) => a.display_order - b.display_order);
              return (
                <div key={topic.id}>
                  <button
                    type="button"
                    onClick={() => toggleTopic(topic.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[15px] font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"
                  >
                    <span>{topic.label}</span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
    </nav>
  );
}
