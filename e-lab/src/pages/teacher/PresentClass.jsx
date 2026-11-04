import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getClassPlan, listLessonBlocks } from "../../lib/classPlannerService.js";
import Wordmark from "../../components/layout/Wordmark.jsx";

// A basic, functional Present Class flow — per the brief's explicit
// "do not overbuild this yet" instruction, this is intentionally simple:
// step through blocks, large text, exit. No advanced classroom-control
// system, no animations. Teacher-private notes (teacher_notes) are never
// rendered here — only student_facing blocks are shown at all, and even
// for those, only title/content is displayed, never the notes field.
export default function PresentClass() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getClassPlan(planId), listLessonBlocks(planId)]).then(([p, b]) => {
      setPlan(p);
      setBlocks(b.filter((block) => block.student_facing !== false));
    }).finally(() => setLoading(false));
  }, [planId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0B1220]"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>;

  const current = blocks[index];

  return (
    <div className="flex min-h-screen flex-col bg-[#0B1220] text-white">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Wordmark onDark />
          {plan && <span className="text-sm text-white/40">{plan.title}</span>}
        </div>
        <button type="button" onClick={() => navigate(`/teacher/class-planner/${planId}`)} className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
          <X size={16} /> Exit Presentation
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        {!current ? (
          <p className="text-lg text-white/60">This lesson has no blocks yet.</p>
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#8C97B8]">{current.block_type}</p>
            <h1 className="mt-3 max-w-3xl font-[var(--font-display)] text-3xl font-bold sm:text-4xl">{current.title}</h1>
            {current.content?.body && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/80">{current.content.body}</p>}
            {current.source_type === "elab_teach" && <p className="mt-5 text-sm text-white/40">Teaching content for this topic will be added soon.</p>}
          </>
        )}
      </main>

      <footer className="flex items-center justify-between px-6 py-5">
        <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="flex items-center gap-1.5 rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-white/80 disabled:opacity-30">
          <ChevronLeft size={15} /> Previous
        </button>
        <p className="text-sm text-white/40">{blocks.length > 0 ? `${index + 1} / ${blocks.length}` : "\u2014"}</p>
        <button type="button" onClick={() => setIndex((i) => Math.min(blocks.length - 1, i + 1))} disabled={index >= blocks.length - 1} className="flex items-center gap-1.5 rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-white/80 disabled:opacity-30">
          Next <ChevronRight size={15} />
        </button>
      </footer>
    </div>
  );
}
