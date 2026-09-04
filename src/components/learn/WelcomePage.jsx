import { useOutletContext, Link } from "react-router-dom";
import { ArrowRight, Award } from "lucide-react";
import { useLearningProgress } from "../../context/ProgressContext.jsx";
import { usePreferences } from "../../context/PreferencesContext.jsx";
import { getConceptContext } from "../../lib/learn-tree.js";
import { computeMilestones, getOverallProgress } from "../../lib/milestones.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Button from "../ui/Button.jsx";

// The landing page every time a student clicks the main Learn tab — never
// auto-redirected past, per the brief — but with Continue Learning
// front-and-centre so returning students never have to search for where
// they left off. Deliberately reads like a teacher's welcome, not a
// marketing page: short paragraphs, one clear next action.
export default function WelcomePage() {
  const { basePath } = useOutletContext();
  const { user } = useAuth();
  const { progress } = useLearningProgress();
  const { lastConceptId } = usePreferences();

  const lastConcept = lastConceptId ? getConceptContext(lastConceptId) : null;
  const overall = getOverallProgress(progress);
  const milestones = computeMilestones(progress);
  const achievedMilestones = milestones.filter((m) => m.achieved);
  const latestMilestone = achievedMilestones[achievedMilestones.length - 1];

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Learn</p>
      <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
        Welcome to e-Lab
      </h1>
      <p className="mt-1 text-base text-[var(--color-ink-soft)]">Your chemistry journey starts here.</p>

      <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-[var(--color-ink-soft)]">
        <p>
          e-Lab is designed to learn with you — one concept at a time. Explore the complete IB Diploma
          Chemistry course, interact with chemistry in ways that make difficult ideas visible, and check
          your understanding as you progress.
        </p>
        <p>You don't need to rush. Choose a concept, explore it carefully, interact with the models, and use Check Yourself when you're ready.</p>
        <p>
          As you learn, e-Lab remembers your progress and helps you continue from where you stopped — from
          understanding particles and bonding to explaining reactions, energy, equilibrium and organic
          mechanisms.
        </p>
      </div>

      <p className="mt-6 font-[var(--font-display)] text-sm font-medium tracking-wide text-[var(--color-ink)]">
        Learn. Interact. Check yourself. Keep progressing.
      </p>

      {lastConcept ? (
        <div className="mt-10 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
          <p className="text-xs text-[var(--color-ink-faint)]">Continue where you left off</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
            {lastConcept.code} — {lastConcept.concept.title}
          </p>
          <Button to={`${basePath}/${lastConceptId}`} className="mt-3">
            Continue Learning <ArrowRight size={15} />
          </Button>
        </div>
      ) : (
        <div className="mt-10">
          <Button to={`${basePath}/states-of-matter`}>
            Start Learning <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {user && overall.total > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md border border-[var(--color-line)] p-3">
            <p className="text-lg font-semibold text-[var(--color-ink)]">{overall.completed}</p>
            <p className="text-[11px] text-[var(--color-ink-faint)]">Concepts completed</p>
          </div>
          <div className="rounded-md border border-[var(--color-line)] p-3">
            <p className="text-lg font-semibold text-[var(--color-ink)]">{overall.percent}%</p>
            <p className="text-[11px] text-[var(--color-ink-faint)]">Course progress</p>
          </div>
          <div className="rounded-md border border-[var(--color-line)] p-3">
            <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{latestMilestone ? latestMilestone.label : "—"}</p>
            <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Latest milestone</p>
          </div>
        </div>
      )}

      {!user && (
        <p className="mt-8 text-xs text-[var(--color-ink-faint)]">
          <Award size={12} className="mr-1 inline" />
          Sign in to save your progress and unlock milestones as you learn.
        </p>
      )}

      <Link to={basePath} className="mt-10 block text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        Last studied: {lastConcept ? `${lastConcept.code} — ${lastConcept.concept.title}` : "Not started yet"}
      </Link>
    </div>
  );
}
