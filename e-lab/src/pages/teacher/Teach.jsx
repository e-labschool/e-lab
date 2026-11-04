import { useState, useEffect } from "react";
import { useOutletContext, Link, useNavigate } from "react-router-dom";
import { ArrowRight, Presentation, ChevronRight, Plus, Loader2 } from "lucide-react";
import { getAllResources } from "../../data/resources-registry.js";
import { getConcept } from "../../data/concepts/index.js";
import { getLearnTree } from "../../lib/learn-tree.js";
import { listClassPlans, createClassPlan, addLessonBlock, listLessonBlocks } from "../../lib/classPlannerService.js";
import Container from "../../components/ui/Container.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyStatePanel from "../../components/ui/EmptyStatePanel.jsx";

const SECTION_ACCENT = { Structure: "#3654D6", Reactivity: "#C96A21" };

// The curriculum navigator reuses the EXACT same tree Student Learn and
// Progress already use (learn-tree.js) — never a second, independently
// maintained syllabus list. Selecting a subtopic here does not show
// Student Learn content (that would blur Teacher/Student experiences
// together) — it shows an honest "coming soon" placeholder, since teacher
// -specific explanations/strategies/misconceptions are a separate,
// not-yet-built content layer, per the brief's explicit instruction not
// to invent that content now.
function CurriculumNav({ selected, onSelect }) {
  const tree = getLearnTree();
  const [expandedTopic, setExpandedTopic] = useState(null);

  return (
    <nav className="flex flex-col gap-3 text-sm">
      {tree.sections.map((section) => (
        <div key={section.id}>
          <p className="px-1 text-xs font-semibold uppercase tracking-wide" style={{ color: SECTION_ACCENT[section.label] }}>{section.label}</p>
          <div className="mt-1 flex flex-col gap-0.5">
            {section.topics.map((topic) => {
              const isExpanded = expandedTopic === topic.id;
              return (
                <div key={topic.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] text-[var(--color-ink-soft)] hover:bg-[var(--color-ink)]/5"
                  >
                    <ChevronRight size={11} className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    <span className="font-medium">{topic.code}</span> {topic.label}
                  </button>
                  {isExpanded && (
                    <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--color-line)] pl-2">
                      {topic.subtopics.map((sub) => (
                        <button
                          key={sub.code}
                          type="button"
                          onClick={() => onSelect(sub)}
                          className={`rounded-md px-2 py-1 text-left text-xs ${selected?.code === sub.code ? "bg-[var(--color-indigo-soft)] font-medium text-[var(--color-indigo)]" : "text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"}`}
                        >
                          {sub.code} {sub.label}
                        </button>
                      ))}
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

export default function Teach() {
  const { subject } = useOutletContext();
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const teacherResources = getAllResources().filter((r) => r.audience === "teacher");

  const grouped = teacherResources.reduce((acc, resource) => {
    const primaryConcept = getConcept(resource.conceptIds[0]);
    const topicLabel = primaryConcept?.title ?? "General";
    if (!acc[topicLabel]) acc[topicLabel] = [];
    acc[topicLabel].push(resource);
    return acc;
  }, {});
  const topics = Object.entries(grouped);

  return (
    <Container className="py-8 md:py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Teach</p>
        <h1 className="mt-1.5 font-[var(--font-display)] text-[32px] font-bold tracking-tight text-[var(--color-ink)]">
          Teach {subject.label} visually
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-ink-soft)]">
          Browse the full syllabus, or explore classroom-ready teaching experiences below.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
          <CurriculumNav selected={selectedSubtopic} onSelect={setSelectedSubtopic} />
        </div>

        <div>
          {selectedSubtopic ? (
            <div className="rounded-md border border-dashed border-[var(--color-line)] p-8 text-center">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{selectedSubtopic.code} {selectedSubtopic.label}</p>
              <p className="mt-2 text-sm text-[var(--color-ink-faint)]">Teacher content for this topic will be added soon.</p>
              <AddToClassButton subtopic={selectedSubtopic} />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {topics.length === 0 && (
                <EmptyStatePanel icon={Presentation} title="Teaching experiences are on the way" description="Teacher-led simulations will appear here, organized by topic, as they're built." />
              )}
              {topics.map(([topicLabel, resources]) => (
                <div key={topicLabel}>
                  <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{topicLabel}</h2>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {resources.map((resource) => (
                      <Link key={resource.id} to={`/interactives/${resource.id}`}>
                        <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-[var(--color-ink)]">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-ink)]">{resource.title}</p>
                            {resource.subtitle && <p className="text-xs text-[var(--color-ink-faint)]">{resource.subtitle}</p>}
                          </div>
                          <span className="inline-flex items-center gap-1 text-sm text-[var(--color-indigo)]">
                            Open <ArrowRight size={14} />
                          </span>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}

// The Teach -> Class Planner connection: a teacher never has to leave
// Teach, search for this same content again, and manually recreate it —
// they pick (or create) a plan right here, and a lesson block referencing
// this subtopic is added immediately.
function AddToClassButton({ subtopic }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open && plans === null) listClassPlans().then(setPlans);
  }, [open, plans]);

  async function addTo(planId) {
    const existing = await listLessonBlocks(planId);
    await addLessonBlock(planId, {
      position: existing.length, blockType: "Explain", title: `${subtopic.code} ${subtopic.label}`,
      content: { placeholder: true }, durationMinutes: 10, sourceType: "elab_teach", sourceRef: subtopic.code,
    });
    navigate(`/teacher/class-planner/${planId}`);
  }

  async function createAndAdd() {
    setCreating(true);
    const plan = await createClassPlan({ title: `${subtopic.code} ${subtopic.label}`, topicCode: subtopic.code, durationMinutes: 60 });
    await addTo(plan.id);
  }

  return (
    <div className="mt-4">
      <Button size="sm" onClick={() => setOpen((v) => !v)}><Plus size={13} /> Add to Class</Button>
      {open && (
        <div className="mx-auto mt-3 max-w-xs rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 text-left">
          {plans === null ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-[var(--color-ink-faint)]" /></div>
          ) : (
            <>
              {plans.slice(0, 4).map((p) => (
                <button key={p.id} type="button" onClick={() => addTo(p.id)} className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/20 hover:text-[var(--color-ink)]">
                  {p.title}
                </button>
              ))}
              <button type="button" onClick={createAndAdd} disabled={creating} className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">
                {creating ? "Creating\u2026" : "+ Create New Class Plan"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
