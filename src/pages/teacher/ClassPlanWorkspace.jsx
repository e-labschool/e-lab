import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronUp, ChevronDown, Trash2, Plus, Loader2, Play, Copy, Archive } from "lucide-react";
import {
  getClassPlan, listLessonBlocks, addLessonBlock, updateLessonBlock, deleteLessonBlock, reorderLessonBlocks,
  duplicateClassPlan, archiveClassPlan,
} from "../../lib/classPlannerService.js";
import AddToLessonPicker from "./AddToLessonPicker.jsx";
import Button from "../../components/ui/Button.jsx";

const SOURCE_LABEL = { elab_teach: "e-Lab Teach", elab_interactive: "e-Lab Interactive", question_bank: "Question Bank", resource: "Resource", custom: "My Content" };

export default function ClassPlanWorkspace() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    Promise.all([getClassPlan(planId), listLessonBlocks(planId)]).then(([p, b]) => { setPlan(p); setBlocks(b); }).finally(() => setLoading(false));
  }, [planId]);

  const totalMinutes = blocks.reduce((s, b) => s + (b.duration_minutes || 0), 0);
  const overBy = totalMinutes - (plan?.duration_minutes ?? 0);

  async function handleAdd({ blockType, title, content, sourceType, sourceRef }) {
    const block = await addLessonBlock(planId, { position: blocks.length, blockType, title, content, durationMinutes: 10, sourceType, sourceRef });
    setBlocks((prev) => [...prev, block]);
  }

  async function move(index, direction) {
    const next = [...blocks];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setBlocks(next);
    await reorderLessonBlocks(next.map((b) => b.id));
  }

  async function remove(id) {
    await deleteLessonBlock(id);
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  // Duration updates locally on every keystroke (instant "Planned: X/Y
  // min" feedback), but only persists on blur — avoids a network request
  // per keystroke while a teacher is adjusting a number input.
  function updateDurationLocal(id, minutes) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, duration_minutes: minutes } : b)));
  }
  async function persistDuration(id, minutes) {
    await updateLessonBlock(id, { duration_minutes: minutes });
  }

  async function handleDuplicate() {
    const copy = await duplicateClassPlan(planId);
    navigate(`/teacher/class-planner/${copy.id}`);
  }
  async function handleArchive() {
    await archiveClassPlan(planId);
    navigate("/teacher/class-planner");
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>;
  if (!plan) return <p className="p-10 text-sm text-[var(--color-ink-faint)]">Class plan not found.</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-10">
      <button type="button" onClick={() => navigate("/teacher/class-planner")} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ChevronLeft size={15} /> My Class Plans
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">{plan.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-faint)]">{[plan.class_group, plan.topic_code, plan.level].filter(Boolean).join(" \u00b7 ")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleDuplicate}><Copy size={13} /> Duplicate</Button>
          <Button variant="secondary" size="sm" onClick={handleArchive}><Archive size={13} /> Archive</Button>
          <Button size="sm" onClick={() => navigate(`/teacher/class-planner/${planId}/present`)} disabled={blocks.length === 0}><Play size={13} /> Present Class</Button>
        </div>
      </div>

      <p className={`mt-3 text-sm font-semibold ${overBy > 0 ? "text-[var(--color-coral)]" : "text-[var(--color-ink)]"}`}>
        Planned: {totalMinutes} / {plan.duration_minutes} min {overBy > 0 && `\u2014 ${overBy} min over`}
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {blocks.map((b, i) => (
          <div key={b.id} className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-[var(--color-ink-faint)]">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-indigo)]">{b.block_type}</p>
                  <p className="text-sm font-medium text-[var(--color-ink)]">{b.title}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">{SOURCE_LABEL[b.source_type]}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} step={5} value={b.duration_minutes ?? 0}
                  onChange={(e) => updateDurationLocal(b.id, Number(e.target.value))}
                  onBlur={(e) => persistDuration(b.id, Number(e.target.value))}
                  className="w-14 rounded-md border border-[var(--color-line)] bg-transparent px-1.5 py-1 text-right text-xs text-[var(--color-ink)]"
                  aria-label={`Duration for ${b.title}`}
                />
                <span className="text-xs text-[var(--color-ink-faint)]">min</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] disabled:opacity-30"><ChevronUp size={15} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="Move down" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] disabled:opacity-30"><ChevronDown size={15} /></button>
                <button type="button" onClick={() => remove(b.id)} aria-label="Remove block" className="text-[var(--color-ink-faint)] hover:text-[var(--color-coral)]"><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="secondary" className="mt-4 w-full" onClick={() => setShowPicker(true)}><Plus size={15} /> Add to Lesson</Button>

      {showPicker && <AddToLessonPicker topicCode={plan.topic_code} onAdd={handleAdd} onClose={() => setShowPicker(false)} />}
    </div>
  );
}
