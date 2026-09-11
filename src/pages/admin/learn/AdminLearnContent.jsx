import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, Loader2, FileText } from "lucide-react";
import { getLearnCmsCurriculumTree } from "../../../data/learnCmsCurriculum.js";
import { listLessonsForTopic } from "../../../lib/learnContentService.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { loadLearnDraft } from "../../../lib/learnAdminDraft.js";
import Badge from "../../../components/ui/Badge.jsx";
import Button from "../../../components/ui/Button.jsx";

export default function AdminLearnContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openTopics, setOpenTopics] = useState(new Set());
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Resumes the lesson the admin was actively editing before a temporary
  // trip to another Admin tab — fires once, only from the list view
  // itself (never overrides an explicit deep link to a specific lesson,
  // since this component only renders for the bare /admin/learn-content
  // route in the first place).
  useEffect(() => {
    if (!user?.id) return;
    const draft = loadLearnDraft(user.id);
    if (draft?.pageId) navigate(`/admin/learn-content/${draft.pageId}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [lessons, setLessons] = useState(null);
  const tree = getLearnCmsCurriculumTree();

  useEffect(() => {
    if (!selectedTopic) return;
    setLessons(null);
    listLessonsForTopic(selectedTopic).then(setLessons).catch(() => setLessons([]));
  }, [selectedTopic]);

  function toggleTopic(topicId) {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId); else next.add(topicId);
      return next;
    });
  }

  const selectedMeta = selectedTopic && findTopicLabel(tree, selectedTopic);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Learn Content</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Create and publish Student Learn lessons — changes go live immediately, no deployment needed.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
        <nav className="space-y-3">
          {tree.map((section) => (
            <div key={section.id}>
              <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{section.label}</p>
              {section.topics.map((topic) => (
                <div key={topic.id}>
                  <button type="button" onClick={() => toggleTopic(topic.id)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
                    <span>{topic.label}</span>
                    {topic.subtopics.length > 1 && (openTopics.has(topic.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                  </button>
                  {(openTopics.has(topic.id) || topic.subtopics.length === 1) && (
                    <div className="ml-2 border-l border-[var(--color-line)] pl-2">
                      {topic.subtopics.map((subtopic) => (
                        <button
                          key={subtopic.id}
                          type="button"
                          onClick={() => setSelectedTopic(subtopic.id)}
                          className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${selectedTopic === subtopic.id ? "bg-[var(--color-indigo-soft)] font-medium text-[var(--color-indigo)]" : "text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30"}`}
                        >
                          {subtopic.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div>
          {!selectedTopic ? (
            <p className="text-sm text-[var(--color-ink-faint)]">Select a topic on the left to manage its lessons.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--color-ink)]">{selectedMeta}</h2>
                <Button size="sm" onClick={() => navigate(`/admin/learn-content/new?parentTopic=${selectedTopic}`)}><Plus size={14} /> Create Lesson</Button>
              </div>

              {lessons === null ? (
                <div className="mt-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
              ) : lessons.length === 0 ? (
                <div className="mt-8 flex flex-col items-center gap-2 rounded-md border border-dashed border-[var(--color-line)] py-10 text-center">
                  <FileText size={20} className="text-[var(--color-ink-faint)]" />
                  <p className="text-sm text-[var(--color-ink-faint)]">No lessons yet.</p>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/learn-content/new?parentTopic=${selectedTopic}`)}><Plus size={14} /> Create Lesson</Button>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-[var(--color-line)] rounded-md border border-[var(--color-line)]">
                  {lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => navigate(`/admin/learn-content/${lesson.id}`)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-line)]/15"
                    >
                      <div>
                        <span className="font-mono text-xs text-[var(--color-ink-faint)]">{lesson.lesson_code}</span>
                        <p className="text-sm font-medium text-[var(--color-ink)]">{lesson.title}</p>
                      </div>
                      <Badge tone={lesson.status === "published" ? "teal" : "neutral"}>{lesson.status}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function findTopicLabel(tree, subtopicId) {
  for (const section of tree) {
    for (const topic of section.topics) {
      const subtopic = topic.subtopics.find((s) => s.id === subtopicId);
      if (subtopic) return subtopic.label;
    }
  }
  return subtopicId;
}
