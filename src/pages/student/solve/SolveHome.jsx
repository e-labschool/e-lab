import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Flame, ArrowRight, Loader2, PenTool } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getChallengeStats, getChallengeHistory, getActiveChallenge } from "../../../lib/challengeService.js";
import { getStreak } from "../../../lib/challengeService.js";
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
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    Promise.all([getChallengeStats(), getStreak(), getChallengeHistory(5), getActiveChallenge()])
      .then(([s, streakData, h, a]) => {
        setStats(s);
        setStreak(streakData);
        setHistory(h);
        setActive(a);
      })
      .finally(() => setLoading(false));
  }, [isConfigured]);

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Solve</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Solve</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Challenge yourself. Build a practice session from any part of IB DP Chemistry.</p>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : !isConfigured ? (
        <div className="mt-12"><EmptyStatePanel icon={PenTool} title="Solve requires Supabase to be connected" /></div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Challenge Streak" value={`\uD83D\uDD25 ${streak?.current_streak ?? 0} Day${(streak?.current_streak ?? 0) === 1 ? "" : "s"}`} />
            <StatCard label="Questions Solved" value={stats?.questionsSolved ?? 0} />
            <StatCard label="Overall Accuracy" value={stats?.accuracy != null ? `${stats.accuracy}%` : "\u2014"} />
            <StatCard label="Challenges Completed" value={stats?.challengesCompleted ?? 0} />
          </div>

          {active ? (
            <div className="mt-8 rounded-lg border border-[var(--color-indigo)]/30 bg-[var(--color-indigo-soft)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-indigo)]">Continue Challenge</p>
              <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{active.topic_codes.join(" + ")}</p>
              <p className="text-xs text-[var(--color-ink-faint)]">Question {(active.current_question_index ?? 0) + 1} of {active.question_count}</p>
              <Button className="mt-3" size="sm" onClick={() => navigate(`/student/solve/${active.id}`)}>Continue <ArrowRight size={14} /></Button>
            </div>
          ) : (
            <div className="mt-8 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
              <p className="text-lg font-semibold text-[var(--color-ink)]">Take a Challenge</p>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Choose your topics and build a focused chemistry challenge.</p>
              <Button className="mt-4" onClick={() => navigate("/student/solve/new")}>Take a Challenge <ArrowRight size={15} /></Button>
            </div>
          )}

          {streak && streak.current_streak > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
              <Flame size={13} className="text-[var(--color-amber)]" /> Complete a challenge today to keep your streak going.
            </p>
          )}

          <p className="mt-10 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Recent Challenges</p>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-faint)]">No challenges yet — take your first one above.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
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

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-4">
      <p className="text-lg font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{label}</p>
    </div>
  );
}
