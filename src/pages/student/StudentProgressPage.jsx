import { CheckCircle2, Circle } from "lucide-react";
import { useLearningProgress } from "../../context/ProgressContext.jsx";
import { getLearnTree, getConceptIdsForTopic, summarizeProgress } from "../../lib/learn-tree.js";
import { computeMilestones, getOverallProgress } from "../../lib/milestones.js";
import Container from "../../components/ui/Container.jsx";

export default function StudentProgressPage() {
  const { progress } = useLearningProgress();
  const tree = getLearnTree();
  const overall = getOverallProgress(progress);
  const milestones = computeMilestones(progress);

  return (
    <Container className="py-14">
      <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Progress</h1>

      <div className="mt-6 rounded-lg border border-[var(--color-line)] p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-ink-soft)]">Overall course progress</span>
          <span className="font-semibold text-[var(--color-ink)]">{overall.completed} / {overall.total} concepts &middot; {overall.percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-line)]">
          <div className="h-full rounded-full bg-[var(--color-indigo)] transition-all" style={{ width: `${overall.percent}%` }} />
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tree?.sections.map((section) => (
          <div key={section.id} className="rounded-lg border border-[var(--color-line)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{section.label}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {section.topics.map((topic) => {
                const ids = getConceptIdsForTopic(topic.id);
                const { completed, total } = summarizeProgress(progress, ids);
                return (
                  <div key={topic.id} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-ink-soft)]">{topic.code} {topic.label}</span>
                    <span className="text-xs text-[var(--color-ink-faint)]">{completed} / {total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Milestones</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {milestones.map((m) => (
            <div key={m.id} className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${m.achieved ? "border-[var(--color-teal)] bg-[var(--color-teal-soft)]" : "border-[var(--color-line)]"}`}>
              {m.achieved ? <CheckCircle2 size={16} className="shrink-0 text-[var(--color-teal)]" /> : <Circle size={16} className="shrink-0 text-[var(--color-ink-faint)]" />}
              <span className={m.achieved ? "text-[var(--color-teal)]" : "text-[var(--color-ink-faint)]"}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
