import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, PenLine, Library } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLearningProgress } from "../../context/ProgressContext.jsx";
import { usePreferences } from "../../context/PreferencesContext.jsx";
import { getConceptContext } from "../../lib/learn-tree.js";
import { getOverallProgress } from "../../lib/milestones.js";
import Container from "../../components/ui/Container.jsx";
import Button from "../../components/ui/Button.jsx";

const SHORTCUTS = [
  { to: "/student/learn", label: "Learn", icon: BookOpen, description: "Work through the IB DP Chemistry syllabus, concept by concept." },
  { to: "/student/solve", label: "Solve", icon: PenLine, description: "Practice questions to test what you know." },
  { to: "/student/resources", label: "Resources", icon: Library, description: "Reference material and revision resources." },
];

export default function StudentDashboard() {
  const { profile } = useAuth();
  const { progress } = useLearningProgress();
  const { lastConceptId } = usePreferences();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const lastConcept = lastConceptId ? getConceptContext(lastConceptId) : null;
  const overall = getOverallProgress(progress);
  const lastCheckScores = Object.values(progress)
    .filter((p) => p.last_check_score != null)
    .sort((a, b) => new Date(b.last_visited_at ?? 0) - new Date(a.last_visited_at ?? 0));
  const mostRecentCheck = lastCheckScores[0];

  return (
    <Container className="py-14">
      <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
        Welcome back, {firstName}
      </h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-line)] p-4">
          <p className="text-xs text-[var(--color-ink-faint)]">Current level</p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">{profile?.level || "\u2014"}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] p-4">
          <p className="text-xs text-[var(--color-ink-faint)]">Current topic</p>
          <p className="mt-1 truncate text-lg font-semibold text-[var(--color-ink)]">
            {lastConcept ? lastConcept.subtopicLabel : "Not started yet"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] p-4">
          <p className="text-xs text-[var(--color-ink-faint)]">Overall progress</p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">{overall.percent}%</p>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] p-4">
          <p className="text-xs text-[var(--color-ink-faint)]">Recent Check Yourself score</p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
            {mostRecentCheck ? `${mostRecentCheck.last_check_score}` : "\u2014"}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
        {lastConcept ? (
          <>
            <p className="text-xs text-[var(--color-ink-faint)]">Continue learning</p>
            <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{lastConcept.code} — {lastConcept.concept.title}</p>
            <Button to={`/student/learn/${lastConceptId}`} className="mt-3" size="sm">
              Continue Learning <ArrowRight size={14} />
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-soft)]">You haven't started a concept yet.</p>
            <Button to="/student/learn" className="mt-3" size="sm">
              Start Learning <ArrowRight size={14} />
            </Button>
          </>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {SHORTCUTS.map((s) => (
          <Link key={s.to} to={s.to} className="group rounded-lg border border-[var(--color-line)] p-5 transition-colors hover:border-[var(--color-ink)]">
            <s.icon size={18} className="text-[var(--color-indigo)]" />
            <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">{s.label}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{s.description}</p>
          </Link>
        ))}
      </div>
    </Container>
  );
}
