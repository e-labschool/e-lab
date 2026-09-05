import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, XCircle, HelpCircle, ArrowRight } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient.js";
import { getQuestionById } from "../../../data/questions/index.js";
import { getChallengeQuestions } from "../../../lib/challengeService.js";
import { getFirstConceptIdForSubtopicCode } from "../../../lib/learn-tree.js";
import ELabLoader from "../../../components/ui/ELabLoader.jsx";
import Button from "../../../components/ui/Button.jsx";

function formatDuration(seconds) {
  if (!seconds) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function ChallengeReport() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from("student_challenges").select("*").eq("id", challengeId).single(),
      getChallengeQuestions(challengeId),
    ]).then(([{ data: c }, qRows]) => {
      setChallenge(c);
      setRows(qRows);
      setLoading(false);
    });
  }, [challengeId]);

  const byTopic = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.topic_code)) map.set(r.topic_code, { correct: 0, total: 0 });
      const entry = map.get(r.topic_code);
      entry.total += 1;
      if (r.is_correct) entry.correct += 1;
    }
    return [...map.entries()].map(([code, { correct, total }]) => ({ code, correct, total, pct: Math.round((correct / total) * 100) }));
  }, [rows]);

  const strengths = byTopic.filter((t) => t.pct >= 75);
  const areasToReview = byTopic.filter((t) => t.pct < 50);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><ELabLoader /></div>;
  if (!challenge) return <p className="p-10 text-center text-sm text-[var(--color-ink-faint)]">Challenge not found.</p>;

  const pct = challenge.max_score > 0 ? Math.round((challenge.score / challenge.max_score) * 100) : null;

  if (reviewing) {
    return <ReviewAnswers rows={rows} onBack={() => setReviewing(false)} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Challenge Complete</p>
      <div className="mt-3 flex items-end gap-3">
        <p className="font-[var(--font-display)] text-4xl font-semibold text-[var(--color-ink)]">{challenge.score ?? 0} / {challenge.max_score ?? 0}</p>
        {pct != null && <p className="pb-1 text-lg text-[var(--color-ink-faint)]">{pct}%</p>}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--color-line)] p-4"><p className="text-xs text-[var(--color-ink-faint)]">Time</p><p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">{formatDuration(challenge.duration_seconds)}</p></div>
        <div className="rounded-lg border border-[var(--color-line)] p-4"><p className="text-xs text-[var(--color-ink-faint)]">Questions</p><p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">{challenge.question_count}</p></div>
      </div>

      <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Performance by Topic</p>
      <div className="mt-3 flex flex-col gap-2">
        {byTopic.map((t) => (
          <div key={t.code} className="rounded-md border border-[var(--color-line)] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--color-ink)]">{t.code}</span>
              <span className="text-[var(--color-ink-faint)]">{t.correct} / {t.total} &middot; {t.pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]"><div className="h-full rounded-full bg-[var(--color-indigo)]" style={{ width: `${t.pct}%` }} /></div>
          </div>
        ))}
      </div>

      {(strengths.length > 0 || areasToReview.length > 0) && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-teal)]">Strengths</p>
              {strengths.map((t) => <p key={t.code} className="mt-1.5 text-sm text-[var(--color-ink-soft)]">{t.code} <span className="text-xs text-[var(--color-ink-faint)]">— strong performance</span></p>)}
            </div>
          )}
          {areasToReview.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-amber)]">Areas to Review</p>
              {areasToReview.map((t) => <p key={t.code} className="mt-1.5 text-sm text-[var(--color-ink-soft)]">{t.code} <span className="text-xs text-[var(--color-ink-faint)]">— more practice recommended</span></p>)}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Button onClick={() => setReviewing(true)}>Review Answers</Button>
        <Button variant="secondary" onClick={() => navigate("/student/solve")}>Back to Solve</Button>
      </div>
    </div>
  );
}

function ReviewAnswers({ rows, onBack }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <button type="button" onClick={onBack} className="text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">&larr; Back to report</button>
      <h1 className="mt-3 font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Review Answers</h1>

      <div className="mt-6 flex flex-col gap-5">
        {rows.map((row) => {
          const q = getQuestionById(row.question_id);
          if (!q) return null;
          const conceptId = getFirstConceptIdForSubtopicCode(row.topic_code);
          const status = row.is_correct === true ? "correct" : row.is_correct === false ? "incorrect" : "review";
          return (
            <div key={row.id} className="rounded-lg border border-[var(--color-line)] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-[var(--color-ink)]">{q.questionText}</p>
                {status === "correct" && <CheckCircle2 size={16} className="shrink-0 text-[var(--color-teal)]" />}
                {status === "incorrect" && <XCircle size={16} className="shrink-0 text-[var(--color-coral)]" />}
                {status === "review" && <HelpCircle size={16} className="shrink-0 text-[var(--color-amber)]" />}
              </div>
              <p className="mt-2 text-xs text-[var(--color-ink-faint)]">Your answer: <span className="text-[var(--color-ink-soft)]">{typeof row.student_answer === "object" ? JSON.stringify(row.student_answer) : (row.student_answer ?? "\u2014")}</span></p>
              {status !== "review" && q.correctAnswer && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">Correct answer: <span className="text-[var(--color-ink-soft)]">{q.correctAnswer}</span></p>}
              {row.marks_awarded != null && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{row.marks_awarded} / {row.marks_possible} marks</p>}
              {q.explanation && <p className="mt-2 text-xs text-[var(--color-ink-soft)]">{q.explanation}</p>}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-[var(--color-ink-faint)]">{row.topic_code}</span>
                {conceptId && (
                  <Link to={`/student/learn/${conceptId}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-indigo)] hover:underline">
                    Learn This Concept <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
