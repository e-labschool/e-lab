import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Loader2, Home } from "lucide-react";
import { getLearnCmsCurriculumTree } from "../../data/learnCmsCurriculum.js";
import { listPublishedLessonMeta } from "../../lib/learnContentService.js";

export default function LearnCmsSidebar({ activeConceptId: activePageId, basePath }) {
  const navigate = useNavigate();
  const [lessonsByTopic, setLessonsByTopic] = useState(null);
  const [openTopics, setOpenTopics] = useState(new Set());
  const [welcomeId, setWelcomeId] = useState(null);
  const tree = getLearnCmsCurriculumTree();

  useEffect(() => {
    listPublishedLessonMeta().then((rows) => {
      const grouped = {};
      for (const row of rows) {
        if (row.parent_topic === "__welcome__") { setWelcomeId(row.id); continue; }
        (grouped[row.parent_topic] ??= []).push(row);
      }
      Object.values(grouped).forEach((items) => items.sort((a,b)=>(a.display_order??0)-(b.display_order??0)));
      setLessonsByTopic(grouped);
      if (activePageId) {
        const active = rows.find((r) => r.id === activePageId);
        if (active && active.parent_topic !== "__welcome__") setOpenTopics(new Set([active.parent_topic]));
      }
    }).catch(() => setLessonsByTopic({}));
  }, [activePageId]);

  const firstLessonForSubtopic = (id) => lessonsByTopic?.[id]?.[0];
  const firstLessonForTopic = (topic) => topic.subtopics.map(s => firstLessonForSubtopic(s.id)).find(Boolean);
  function openSubtopic(subtopic) {
    const first = firstLessonForSubtopic(subtopic.id);
    if (first) navigate(`${basePath}/${first.id}`);
    setOpenTopics((prev) => new Set(prev).add(subtopic.id));
  }
  if (lessonsByTopic === null) return <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-[var(--color-ink-faint)]" /></div>;

  return <nav className="space-y-5" aria-label="Learn curriculum">
    <Link to={welcomeId ? `${basePath}/${welcomeId}` : basePath} className={`flex items-center gap-2 rounded-md px-2 py-2 text-[14px] font-semibold ${activePageId===welcomeId ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "text-[var(--color-ink)] hover:bg-[var(--color-line)]/30"}`}><Home size={14}/> Welcome</Link>
    {tree.filter(s=>s.id!=="tools").map((section) => <div key={section.id}>
      <p className="mb-1.5 px-1 text-[17px] font-bold tracking-tight text-[var(--color-ink)]">{section.label}</p>
      <div className="space-y-2.5">{section.topics.map((topic) => {
        const firstTopicLesson=firstLessonForTopic(topic);
        return <div key={topic.id}>
          <button type="button" onClick={()=>{ if(firstTopicLesson) navigate(`${basePath}/${firstTopicLesson.id}`); if(topic.subtopics[0]) setOpenTopics(p=>new Set(p).add(topic.subtopics[0].id)); }} className="w-full px-1 text-left text-[15px] font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"><span className="mr-1.5 font-mono font-bold text-[var(--color-ink)]">{topic.code}</span>{topic.label}</button>
          <div className="mt-0.5 space-y-0.5">{topic.subtopics.map((subtopic) => {
            const isOpen=openTopics.has(subtopic.id); const lessons=lessonsByTopic[subtopic.id]??[];
            return <div key={subtopic.id}>
              <button type="button" onClick={()=>{ if(isOpen) setOpenTopics(p=>{const n=new Set(p);n.delete(subtopic.id);return n}); else openSubtopic(subtopic); }} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[14px] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"><span><span className="mr-1.5 font-mono font-semibold text-[var(--color-ink)]">{subtopic.code}</span>{subtopic.label}</span>{isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>
              {isOpen && <div className="ml-2 border-l border-[var(--color-line)] pl-3">{lessons.length===0?<p className="px-2 py-2 text-xs text-[var(--color-ink-faint)]">Learning content coming soon.</p>:lessons.map(lesson=><Link key={lesson.id} to={`${basePath}/${lesson.id}`} className={`block rounded-md px-2 py-1.5 text-[14px] leading-snug ${lesson.id===activePageId?"bg-[var(--color-indigo-soft)] font-medium text-[var(--color-indigo)]":"text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"}`}><span className="font-mono text-xs">{lesson.lesson_code}</span> {lesson.title}</Link>)}</div>}
            </div>})}</div>
        </div>})}</div>
    </div>)}
  </nav>;
}
