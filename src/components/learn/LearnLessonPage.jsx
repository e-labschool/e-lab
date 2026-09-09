import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPublishedLesson, listPublishedLessonMeta } from "../../lib/learnContentService.js";
import { getLearnCmsCurriculumTree } from "../../data/learnCmsCurriculum.js";
import LearnBlockRenderer from "./LearnBlockRenderer.jsx";
import CheckYourUnderstanding from "./CheckYourUnderstanding.jsx";
import ELabLoader from "../ui/ELabLoader.jsx";
import { splitLearnBlocksIntoPages } from "../../lib/learnPagination.js";

/** Determines prev/next PUBLISHED lesson purely from parent topic +
 * display order + curriculum hierarchy — Admin never creates nav links
 * manually. If the current lesson is last in its topic, looks ahead to
 * the first published lesson of the next topic in curriculum order. */
function findAdjacentLessons(currentLesson, allLessons, tree) {
  // flatTopicIds must be SUBTOPIC ids in curriculum order — parent_topic
  // is always a subtopic id, never the higher-level topic/unit id. Using
  // topic-level ids here (the original bug) meant flatTopicIds.indexOf()
  // could never find a match, silently breaking "next topic" lookup too.
  const flatTopicIds = tree.flatMap((section) => section.topics.flatMap((t) => t.subtopics.map((s) => s.id)));
  const sameTopicLessons = allLessons
    .filter((l) => l.parent_topic === currentLesson.parent_topic)
    .sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id)); // id as a stable tiebreaker for equal display_order
  const indexInTopic = sameTopicLessons.findIndex((l) => l.id === currentLesson.id);

  const prev = indexInTopic > 0 ? sameTopicLessons[indexInTopic - 1] : null;
  let next = indexInTopic < sameTopicLessons.length - 1 ? sameTopicLessons[indexInTopic + 1] : null;
  let nextIsNewTopic = false;

  if (!next) {
    const topicIndex = flatTopicIds.indexOf(currentLesson.parent_topic);
    for (let i = topicIndex + 1; i < flatTopicIds.length; i++) {
      const candidates = allLessons.filter((l) => l.parent_topic === flatTopicIds[i]).sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id)); // id as a stable tiebreaker for equal display_order
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
  const [contentPage, setContentPage] = useState(0);

  useEffect(() => {
    setContentPage(0);
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
  const pages = splitLearnBlocksIntoPages(lesson.blocks);
  const safePage = Math.min(contentPage, pages.length - 1);
  const activePage = pages[safePage];
  const isFirstContentPage = safePage === 0;
  const isLastContentPage = safePage === pages.length - 1;

  function goToContentPage(nextPage) {
    const clamped = Math.max(0, Math.min(nextPage, pages.length - 1));
    setContentPage(clamped);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {topicMeta && (
        <p className="text-xs text-[var(--color-ink-faint)]">
          {topicMeta.sectionLabel} <ChevronRight size={11} className="inline" /> {topicMeta.topicLabel}
        </p>
      )}
      <p className="mt-1 font-mono text-xs font-semibold text-[var(--color-indigo)]">{lesson.page.lesson_code}</p>
      <h1 className="mt-1 font-[var(--font-display)] text-[26px] font-bold tracking-tight text-[var(--color-ink)]">{lesson.page.title}</h1>

      {pages.length > 1 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--color-line)] py-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Page {safePage + 1} of {pages.length}</p>
            {activePage.label && <p className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">{activePage.label}</p>}
          </div>
          <div className="flex items-center gap-1.5" aria-label="Lesson pages">
            {pages.map((_, index) => (
              <button key={index} type="button" onClick={() => goToContentPage(index)} aria-current={safePage === index ? "page" : undefined} className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold ${safePage === index ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"}`}>
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {activePage.blocks.map((block) => <LearnBlockRenderer key={block.id} block={block} />)}
      </div>

      {isLastContentPage && <CheckYourUnderstanding pageId={pageId} checkQuestions={lesson.checkQuestions} />}

      {pages.length > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-[var(--color-line)] pt-5">
          {!isFirstContentPage ? (
            <button type="button" onClick={() => goToContentPage(safePage - 1)} className="flex items-center gap-1 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
              <ChevronLeft size={15} /> Previous Page
            </button>
          ) : <span />}
          {!isLastContentPage && (
            <button type="button" onClick={() => goToContentPage(safePage + 1)} className="flex items-center gap-1 rounded-md bg-[var(--color-indigo)] px-3 py-2 text-sm font-semibold text-white">
              Next Page <ChevronRight size={15} />
            </button>
          )}
        </div>
      )}

      {(isFirstContentPage || isLastContentPage) && (
        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-line)] pt-5">
          {isFirstContentPage && adjacent.prev ? (
            <button type="button" onClick={() => navigate(`/student/learn/${adjacent.prev.id}`)} className="flex items-center gap-1 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
              <ChevronLeft size={15} /> Previous Concept
            </button>
          ) : <span />}
          {isLastContentPage && adjacent.next && (
            <button type="button" onClick={() => navigate(`/student/learn/${adjacent.next.id}`)} className="flex items-center gap-1 text-sm font-medium text-[var(--color-indigo)]">
              {adjacent.nextIsNewTopic ? "Next Topic" : "Next Concept"} <ChevronRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function findTopicMeta(topicId) {
  // topicId here is always a SUBTOPIC id (parent_topic) — must search
  // section.topics[].subtopics, not section.topics itself, or this
  // silently returns null and the breadcrumb renders nothing (the same
  // root confusion as the sidebar/adjacent-lesson bugs above).
  const tree = getLearnCmsCurriculumTree();
  for (const section of tree) {
    for (const topic of section.topics) {
      const subtopic = topic.subtopics.find((s) => s.id === topicId);
      if (subtopic) return { sectionLabel: section.label, topicLabel: subtopic.label };
    }
  }
  return null;
}
