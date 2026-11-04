import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Flame, ArrowRight, Loader2, PenTool, AlertTriangle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getChallengeStats, getChallengeHistory, getActiveChallenge, getChallengeQuestions, abandonChallenge } from "../../../lib/challengeService.js";
import { getStreak } from "../../../lib/challengeService.js";
import { hydrateChallengeQuestions } from "../../../lib/canonicalQuestions.js";
import Container from "../../../components/ui/Container.jsx";
import Button from "../../../components/ui/Button.jsx";
import EmptyStatePanel from "../../../components/ui/EmptyStatePanel.jsx";

export default function SolveHome() {
  const { isConfigured } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState(null);
  // null = not checked yet, true = can safely resume, false = stale/unresolvable
  const [activeResumable, setActiveResumable] = useState(null);
  const [discarding, setDiscarding] = useState(false);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    Promise.all([getChallengeStats(), getStreak(), getChallengeHistory(5), getActiveChallenge()])
      .then(async ([s, streakData, h, a]) => {
        setStats(s);
        setStreak(streakData);
        setHistory(h);
        setActive(a);
        if (a) {
          // A "Continue Challenge" is only ever offered if every one of
          // its questions can actually be hydrated — the same rule
          // ChallengeSession itself enforces. This is what stops an
          // obsolete pre-pinning pilot session from trapping the student
          // behind a card that leads to a dead end.
          try {
            const rows = await getChallengeQuestions(a.id);
            const hydrated = await hydrateChallengeQuestions(rows);
            setActiveResumable(rows.length > 0 && rows.every((r) => hydrated.get(r.id)));
          } catch {
            setActiveResumable(false);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [isConfigured]);

  async function handleDiscardStaleChallenge() {
    if (!active) return;
    setDiscarding(true);
    try {
      // Reuses the existing abandon path exactly as-is — same RLS-backed
      // update ("Users can update own challenges"), same terminal status,
      // same ownership scoping. No new permission or write path.
      await abandonChallenge(active.id);
      setActive(null);
      setActiveResumable(null);
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <Container className="py-8 md:py-10">
      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Solve</p>
        <h1 className="mt-1.5 font-[var(--font-display)] text-[32px] font-bold tracking-tight text-[var(--color-ink)]">Solve</h1>
        <p className="mt-2 text-[15px] text-[var(--color-ink-soft)]">Challenge yourself. Build a practice session from any part of IB DP Chemistry.</p>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : !isConfigured ? (
        <div className="mt-8"><EmptyStatePanel icon={PenTool} title="Solve requires Supabase to be connected" /></div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard tone="amber" label="Challenge Streak" value={`\uD83D\uDD25 ${streak?.current_streak ?? 0} Day${(streak?.current_streak ?? 0) === 1 ? "" : "s"}`} />
            <StatCard tone="indigo" label="Questions Solved" value={stats?.questionsSolved ?? 0} />
            <StatCard tone="teal" label="Overall Accuracy" value={stats?.accuracy != null ? `${stats.accuracy}%` : "\u2014"} />
            <StatCard tone="violet" label="Challenges Completed" value={stats?.challengesCompleted ?? 0} />
          </div>

          {active && activeResumable ? (
            <div className="mt-6 rounded-xl border border-[var(--color-indigo)]/30 bg-[var(--color-indigo-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-indigo)]">Continue Challenge</p>
              <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{active.topic_codes.join(" + ")}</p>
              <p className="text-xs text-[var(--color-ink-faint)]">Question {(active.current_question_index ?? 0) + 1} of {active.question_count}</p>
              <Button className="mt-3" size="sm" onClick={() => navigate(`/student/solve/${active.id}`)}>Continue <ArrowRight size={14} /></Button>
            </div>
          ) : active && activeResumable === false ? (
            <div className="mt-6 rounded-xl border border-[var(--color-coral)]/30 bg-[var(--color-coral-soft)] p-5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-coral)]"><AlertTriangle size={13} /> Challenge unavailable</p>
              <p className="mt-1.5 text-sm font-medium text-[var(--color-ink)]">This earlier challenge can no longer be resumed.</p>
              <p className="text-xs text-[var(--color-ink-faint)]">Some of its questions are no longer available. This can happen with sessions started before a recent update.</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={handleDiscardStaleChallenge} disabled={discarding}>
                  {discarding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Discard Challenge"}
                </Button>
                <Button size="sm" onClick={() => navigate("/student/solve/new")}>Start New Challenge <ArrowRight size={14} /></Button>
              </div>
            </div>
          ) : active && activeResumable === null ? (
            <div className="mt-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
          ) : (
            <div className="mt-6 rounded-2xl border border-[var(--color-indigo)]/15 bg-gradient-to-br from-[var(--color-indigo-soft)] via-[var(--color-violet-soft)] to-[var(--color-paper-raised)] p-6 shadow-[0_2px_4px_rgba(20,30,80,0.06),0_8px_20px_-6px_rgba(20,30,80,0.12)]">
              <p className="text-xl font-bold text-[var(--color-ink)]">Take a Challenge</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Choose your topics and build a focused chemistry challenge.</p>
              <Button className="mt-4" onClick={() => navigate("/student/solve/new")}>Take a Challenge <ArrowRight size={15} /></Button>
            </div>
          )}

          {streak && streak.current_streak > 0 && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
              <Flame size={13} className="text-[var(--color-amber)]" /> Complete a challenge today to keep your streak going.
            </p>
          )}

          <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Recent Challenges</p>
          {history.length === 0 ? (
            <p className="mt-2.5 text-sm text-[var(--color-ink-faint)]">No challenges yet — take your first one above.</p>
          ) : (
            <div className="mt-2.5 flex flex-col gap-2">
              {history.map((c) => {
                const pct = c.max_score > 0 ? Math.round((c.score / c.max_score) * 100) : null;
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-md border border-[var(--color-line)] p-3.5">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-ink)]">{c.topic_codes.join(" + ")}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">
                        {c.question_count} Questions {pct != null && `\u00b7 ${Math.round(c.score)}/${Math.round(c.max_score)} \u00b7 ${pct}%`} &middot; {new Date(c.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link to={`/student/solve/${c.id}/report`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-indigo)] hover:underline">
                      View Report <ArrowRight size={11} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Container>
  );
}

function StatCard({ label, value, tone }) {
  const TONES = {
    amber: "bg-[var(--color-amber-soft)] text-[var(--color-amber)]",
    indigo: "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]",
    teal: "bg-[var(--color-teal-soft)] text-[var(--color-teal)]",
    violet: "bg-[var(--color-violet-soft)] text-[var(--color-violet)]",
  };
  return (
    <div className={`rounded-xl border border-[var(--color-line)] p-4 shadow-[0_1px_2px_rgba(20,30,80,0.05)] ${TONES[tone] ?? ""}`}>
      <p className="text-lg font-bold text-[var(--color-ink)]">{value}</p>
      <p className="mt-0.5 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}
