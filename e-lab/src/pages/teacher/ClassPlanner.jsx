import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, CalendarDays } from "lucide-react";
import { listClassPlans, createClassPlan } from "../../lib/classPlannerService.js";
import Container from "../../components/ui/Container.jsx";
import Button from "../../components/ui/Button.jsx";

export default function ClassPlanner() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    listClassPlans().then(setPlans).finally(() => setLoading(false));
  }, []);

  return (
    <Container className="py-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-[32px] font-bold tracking-tight text-[var(--color-ink)]">My Class Plans</h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-ink-soft)]">Plan and organise your next class using curriculum-linked teaching tools.</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus size={15} /> New Class Plan</Button>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : plans.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 rounded-md border border-dashed border-[var(--color-line)] py-20 text-center">
          <CalendarDays size={22} className="text-[var(--color-ink-faint)]" />
          <p className="text-sm font-medium text-[var(--color-ink)]">No class plans yet</p>
          <p className="max-w-xs text-xs text-[var(--color-ink-faint)]">Create your first plan to start building a lesson.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/teacher/class-planner/${p.id}`)}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 text-left shadow-[0_1px_2px_rgba(20,30,80,0.05)] transition-transform hover:-translate-y-px"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--color-ink)]">{p.title}</p>
                {p.status === "draft" && <span className="rounded-full bg-[var(--color-amber-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-amber)]">Draft</span>}
              </div>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                {[p.class_group, p.topic_code, p.level].filter(Boolean).join(" \u00b7 ")}
              </p>
              <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{p.duration_minutes} min{p.planned_date ? ` \u00b7 ${new Date(p.planned_date).toLocaleDateString()}` : ""}</p>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <NewPlanDialog
          onClose={() => setShowNew(false)}
          onCreated={(plan) => navigate(`/teacher/class-planner/${plan.id}`)}
        />
      )}
    </Container>
  );
}

function NewPlanDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [classGroup, setClassGroup] = useState("");
  const [topicCode, setTopicCode] = useState("");
  const [level, setLevel] = useState("SL");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [plannedDate, setPlannedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const plan = await createClassPlan({ title: title || `${classGroup || "Class"} \u2014 ${topicCode || "Untitled"}`, classGroup, topicCode, level, durationMinutes: Number(durationMinutes), plannedDate });
      onCreated(plan);
    } catch (err) {
      setError(err.message || "Something went wrong creating this plan.");
      setSaving(false);
    }
  }

  const inputClasses = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";
  const labelClasses = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={handleCreate} className="w-full max-w-sm rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-[var(--color-ink)]">New Class Plan</p>
        <div className="mt-4 flex flex-col gap-3">
          <div><label className={labelClasses} htmlFor="np-title">Plan Title</label><input id="np-title" className={inputClasses} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional \u2014 auto-generated if left blank" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClasses} htmlFor="np-class">Class / Group</label><input id="np-class" className={inputClasses} value={classGroup} onChange={(e) => setClassGroup(e.target.value)} placeholder="DP1" /></div>
            <div><label className={labelClasses} htmlFor="np-topic">Topic</label><input id="np-topic" className={inputClasses} value={topicCode} onChange={(e) => setTopicCode(e.target.value)} placeholder="S1.1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={labelClasses}>Level</span>
              <div className="flex gap-1.5">{["SL", "HL"].map((l) => <button key={l} type="button" onClick={() => setLevel(l)} className={`flex-1 rounded-md border py-1.5 text-xs font-semibold ${level === l ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>{l}</button>)}</div>
            </div>
            <div><label className={labelClasses} htmlFor="np-duration">Duration (min)</label><input id="np-duration" type="number" min={5} step={5} className={inputClasses} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} /></div>
          </div>
          <div><label className={labelClasses} htmlFor="np-date">Date (optional)</label><input id="np-date" type="date" className={inputClasses} value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} /></div>
        </div>
        {error && <p className="mt-3 text-xs text-[var(--color-coral)]">{error}</p>}
        <div className="mt-4 flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Plan"}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
