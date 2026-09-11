import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Loader2, Home } from "lucide-react";
import { getLearnCmsCurriculumTree } from "../../data/learnCmsCurriculum.js";
import { listPublishedLessonMeta } from "../../lib/learnContentService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { lessonOrderValue } from "../../lib/learnLevelAccess.js";

// Uniform sizing for Welcome + every main-topic row, per spec: same
// height/width/padding/font-size for all of them regardless of nesting.
const TOPIC_ROW_HEIGHT = "h-10";
const TOPIC_TEXT_SIZE = "text-[14px] font-semibold";

// "structure-1" -> "Structure 1", "reactivity-3" -> "Reactivity 3" — the
// primary nav label is the syllabus numbering, not the long descriptive
// title (which still appears, smaller, once a topic is expanded).
function topicNavLabel(topic) {
  const [word, num] = topic.id.split("-");
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} ${num}`;
}

export default function LearnCmsSidebar({ activeConceptId: activePageId, basePath }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const studentLevel = profile?.level || "SL";
  const [lessonsByTopic, setLessonsByTopic] = useState(null);
  // Accordion: at most ONE open topic, and at most ONE open subtopic
  // (within whichever topic is open) — a scalar id (or null), not a Set,
  // is what actually enforces that, rather than just conventionally
  // avoiding adding more than one.
  const [openTopicId, setOpenTopicId] = useState(null);
  const [openSubtopicId, setOpenSubtopicId] = useState(null);
  const [welcomeId, setWelcomeId] = useState(null);
  const tree = getLearnCmsCurriculumTree();

  // Every topic, flattened out of its section grouping ("Structure 1",
  // "Structure 2"... directly — no separate "Structure" section header),
  // and explicitly WITHOUT the "tools" section: Tools for Chemistry stays
  // fully available site-wide (Explore, admin's Parent Topic picker,
  // etc.) — it's only excluded from this particular curriculum nav,
  // per spec, since this sidebar is meant to be exactly Welcome + the six
  // syllabus topics.
  const allTopics = tree.filter((s) => s.id !== "tools").flatMap((section) => section.topics);

  useEffect(() => {
    listPublishedLessonMeta(studentLevel).then((rows) => {
      const grouped = {};
      for (const row of rows) {
        if (row.parent_topic === "__welcome__") { setWelcomeId(row.id); continue; }
        (grouped[row.parent_topic] ??= []).push(row);
      }
      Object.values(grouped).forEach((items) => items.sort((a, b) => lessonOrderValue(a, studentLevel) - lessonOrderValue(b, studentLevel) || String(a.id).localeCompare(String(b.id))));
      setLessonsByTopic(grouped);

      // Auto-open only the branch containing the lesson the student is
      // currently on — never anything else, and never force-open on
      // manual toggles (this effect only re-runs when the active lesson
      // or the lesson list itself changes).
      if (activePageId) {
        const active = rows.find((r) => r.id === activePageId);
        if (active && active.parent_topic !== "__welcome__") {
          const subtopicId = active.parent_topic;
          const owningTopic = allTopics.find((t) => t.subtopics.some((s) => s.id === subtopicId));
          setOpenSubtopicId(subtopicId);
          setOpenTopicId(owningTopic ? owningTopic.id : null);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).catch(() => setLessonsByTopic({}));
  }, [activePageId, studentLevel]);

  const firstLessonForSubtopic = (id) => lessonsByTopic?.[id]?.[0];
  const firstLessonForTopic = (topic) => topic.subtopics.map((s) => firstLessonForSubtopic(s.id)).find(Boolean);

  function toggleTopic(topicId) {
    setOpenTopicId((prev) => (prev === topicId ? null : topicId));
    setOpenSubtopicId(null); // switching topics always closes whatever subtopic was open
  }
  function toggleSubtopic(subtopicId) {
    setOpenSubtopicId((prev) => (prev === subtopicId ? null : subtopicId));
  }
  function openTopicAndNavigate(topic) {
    const first = firstLessonForTopic(topic);
    if (first) navigate(`${basePath}/${first.id}`);
    setOpenTopicId(topic.id);
  }
  function openSubtopicAndNavigate(subtopic) {
    const first = firstLessonForSubtopic(subtopic.id);
    if (first) navigate(`${basePath}/${first.id}`);
    setOpenSubtopicId(subtopic.id);
  }

  if (lessonsByTopic === null) return <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-[var(--color-ink-faint)]" /></div>;

  function TopicRow({ topic }) {
    const isOpen = openTopicId === topic.id;
    return (
      <div>
        <div className={`flex ${TOPIC_ROW_HEIGHT} w-full items-center gap-0.5 rounded-md`}>
          <button
            type="button"
            onClick={() => toggleTopic(topic.id)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${topicNavLabel(topic)}`}
            className="flex h-full shrink-0 items-center justify-center rounded-md px-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <button
            type="button"
            onClick={() => openTopicAndNavigate(topic)}
            className={`flex h-full min-w-0 flex-1 items-center rounded-md px-1.5 text-left ${TOPIC_TEXT_SIZE} text-[var(--color-ink)] hover:bg-[var(--color-line)]/30`}
          >
            <span className="truncate">{topicNavLabel(topic)}</span>
          </button>
        </div>

        {isOpen && (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--color-line)] pl-2">
            <p className="px-1.5 py-1 text-[11px] leading-snug text-[var(--color-ink-faint)]">{topic.label}</p>
            {topic.subtopics.map((subtopic) => {
              const subOpen = openSubtopicId === subtopic.id;
              const lessons = lessonsByTopic[subtopic.id] ?? [];
              return (
                <div key={subtopic.id}>
                  <div className="flex w-full items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggleSubtopic(subtopic.id)}
                      aria-expanded={subOpen}
                      aria-label={`${subOpen ? "Collapse" : "Expand"} ${subtopic.label}`}
                      className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"
                    >
                      {subOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openSubtopicAndNavigate(subtopic)}
                      className="min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left text-[13px] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"
                    >
                      <span className="mr-1.5 font-mono font-semibold text-[var(--color-ink)]">{subtopic.code}</span>
                      {subtopic.label}
                    </button>
                  </div>
                  {subOpen && (
                    <div className="ml-2 border-l border-[var(--color-line)] pl-3">
                      {lessons.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-[var(--color-ink-faint)]">Learning content coming soon.</p>
                      ) : (
                        lessons.map((lesson) => (
                          <Link
                            key={lesson.id}
                            to={`${basePath}/${lesson.id}`}
                            className={`block rounded-md px-2 py-1.5 text-[13px] leading-snug ${lesson.id === activePageId ? "bg-[var(--color-indigo-soft)] font-medium text-[var(--color-indigo)]" : "text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"}`}
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
        )}
      </div>
    );
  }

  return (
    <nav className="space-y-1" aria-label="Learn curriculum">
      <Link
        to={welcomeId ? `${basePath}/${welcomeId}` : basePath}
        className={`flex ${TOPIC_ROW_HEIGHT} items-center gap-2 rounded-md px-2.5 ${TOPIC_TEXT_SIZE} ${activePageId === welcomeId ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "text-[var(--color-ink)] hover:bg-[var(--color-line)]/30"}`}
      >
        <Home size={14} /> Welcome
      </Link>

      <div className="space-y-1 pt-1">
        {allTopics.map((topic) => <TopicRow key={topic.id} topic={topic} />)}
      </div>
    </nav>
  );
}
