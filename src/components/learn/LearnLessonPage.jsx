import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPublishedLesson, listPublishedLessonMeta } from "../../lib/learnContentService.js";
import { getLearnCmsCurriculumTree } from "../../data/learnCmsCurriculum.js";
import LearnBlockRenderer from "./LearnBlockRenderer.jsx";
import CheckYourUnderstanding from "./CheckYourUnderstanding.jsx";
import ELabLoader from "../ui/ELabLoader.jsx";

/** Determines prev/next PUBLISHED lesson purely from parent topic +
 * display order + curriculum hierarchy — Admin never creates nav links
 * manually. If the current lesson is last in its topic, looks ahead to
 * the first published lesson of the next topic in curriculum order. */
function findAdjacentLessons(currentLesson, allLessons, tree) {
  const flatTopicIds = tree.flatMap((section) => section.topics.map((t) => t.id));
  const sameTopicLessons = allLessons
    .filter((l) => l.parent_topic === currentLesson.parent_topic)
    .sort((a, b) => a.display_order - b.display_order);
  const indexInTopic = sameTopicLessons.findIndex((l) => l.id === currentLesson.id);

  const prev = indexInTopic > 0 ? sameTopicLessons[indexInTopic - 1] : null;
  let next = indexInTopic < sameTopicLessons.length - 1 ? sameTopicLessons[indexInTopic + 1] : null;
  let nextIsNewTopic = false;

  if (!next) {
    const topicIndex = flatTopicIds.indexOf(currentLesson.parent_topic);
    for (let i = topicIndex + 1; i < flatTopicIds.length; i++) {
      const candidates = allLessons.filter((l) => l.parent_topic === flatTopicIds[i]).sort((a, b) => a.display_order - b.display_order);
      if (candidates.length > 0) {
        next = candidates[0];
        nextIsNewTopic = true;
        break;
      }
    }
  }

  return { prev, next, nextIsNewTopic };
}

export default function LearnLessonPage() {
  const { conceptId: pageId } = useParams(); // param name kept as conceptId — see LearnLayout.jsx
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [adjacent, setAdjacent] = useState({ prev: null, next: null, nextIsNewTopic: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getPublishedLesson(pageId), listPublishedLessonMeta()])
      .then(([data, allLessons]) => {
        if (!data?.page) throw new Error("This lesson isn't available.");
        setLesson(data);
        setAdjacent(findAdjacentLessons(data.page, allLessons, getLearnCmsCurriculumTree()));
      })
      .catch((err) => setError(err.message || "Couldn't load this lesson."))
      .finally(() => setLoading(false));
  }, [pageId]);

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><ELabLoader /></div>;
  if (error) return <p className="p-10 text-center text-sm text-[var(--color-coral)]">{error}</p>;
  if (!lesson) return null;

  const topicMeta = findTopicMeta(lesson.page.parent_topic);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {topicMeta && (
        <p className="text-xs text-[var(--color-ink-faint)]">
          {topicMeta.sectionLabel} <ChevronRight size={11} className="inline" /> {topicMeta.topicLabel}
        </p>
      )}
      <p className="mt-1 font-mono text-xs font-semibold text-[var(--color-indigo)]">{lesson.page.lesson_code}</p>
      <h1 className="mt-1 font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-ink)]">{lesson.page.title}</h1>

      <div className="mt-6 space-y-5">
        {lesson.blocks.map((block) => <LearnBlockRenderer key={block.id} block={block} />)}
      </div>

      <CheckYourUnderstanding checkQuestions={lesson.checkQuestions} />

      <div className="mt-8 flex items-center justify-between border-t border-[var(--color-line)] pt-5">
        {adjacent.prev ? (
          <button type="button" onClick={() => navigate(`/student/learn/${adjacent.prev.id}`)} className="flex items-center gap-1 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            <ChevronLeft size={15} /> Previous Concept
          </button>
        ) : <span />}
        {adjacent.next && (
          <button type="button" onClick={() => navigate(`/student/learn/${adjacent.next.id}`)} className="flex items-center gap-1 text-sm font-medium text-[var(--color-indigo)]">
            {adjacent.nextIsNewTopic ? "Next Topic" : "Next Concept"} <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function findTopicMeta(topicId) {
  const tree = getLearnCmsCurriculumTree();
  for (const section of tree) {
    const topic = section.topics.find((t) => t.id === topicId);
    if (topic) return { sectionLabel: section.label, topicLabel: topic.label };
  }
  return null;
}
