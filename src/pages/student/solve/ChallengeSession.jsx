import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient.js";
import { getQuestionById } from "../../../data/questions/index.js";
import { getChallengeQuestions, saveAnswer, updateChallengeProgress, submitChallenge } from "../../../lib/challengeService.js";
import QuestionRenderer from "./QuestionRenderer.jsx";
import ELabLoader from "../../../components/ui/ELabLoader.jsx";
import Button from "../../../components/ui/Button.jsx";

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

export default function ChallengeSession() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [rows, setRows] = useState([]);
  const [answers, setAnswers] = useState({}); // question_id -> answer (local, source of truth for the UI)
  const [flagged, setFlagged] = useState(new Set());
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNavigator, setShowNavigator] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from("student_challenges").select("*").eq("id", challengeId).single(),
      getChallengeQuestions(challengeId),
    ])
      .then(([{ data: c, error: cErr }, qRows]) => {
        if (cErr) throw cErr;
        if (c.status === "submitted") {
          navigate(`${"/student/solve"}/${challengeId}/report`, { replace: true });
          return;
        }
        setChallenge(c);
        setRows(qRows);
        setIndex(c.current_question_index ?? 0);
        setFlagged(new Set(c.flagged_question_ids ?? []));
        setAnswers(Object.fromEntries(qRows.map((r) => [r.question_id, r.student_answer])));
        startedAtRef.current = new Date(c.started_at).getTime();
      })
      .catch((err) => setError(err.message || "Couldn't load this challenge."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  const questions = useMemo(() => rows.map((r) => getQuestionById(r.question_id)).filter(Boolean), [rows]);
  const current = questions[index];
  const currentRow = rows[index];

  // Timer counts down from the challenge's own time budget, anchored to
  // started_at (a wall-clock timestamp) rather than a running JS
  // interval alone — an ordinary re-render, or even a page refresh
  // (started_at/time_limit_seconds are both persisted), can't reset it.
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const submittedRef = useRef(false);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current || !challenge) return;
    submittedRef.current = true;
    setSubmitting(true);
    const questionsById = Object.fromEntries(questions.map((q) => [q.id, q]));
    const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    try {
      await submitChallenge(challenge.id, { questionsById, durationSeconds });
      navigate(`${"/student/solve"}/${challenge.id}/report`, { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong submitting your challenge.");
      submittedRef.current = false;
      setSubmitting(false);
    }
  }, [challenge, questions, navigate]);

  useEffect(() => {
    if (!challenge?.time_limit_seconds || !startedAtRef.current) return;
    const tick = () => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const remaining = challenge.time_limit_seconds - elapsed;
      setRemainingSeconds(remaining);
      if (remaining <= 0) doSubmit();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [challenge, doSubmit]);

  async function goTo(nextIndex) {
    // Save whatever's on screen before navigating away from it, rather
    // than on every keystroke — fewer requests, same durability where it
    // actually matters (leaving the question).
    if (currentRow) await saveAnswer(challenge.id, currentRow.question_id, answers[currentRow.question_id]);
    setIndex(nextIndex);
    setShowNavigator(false);
    updateChallengeProgress(challenge.id, { currentQuestionIndex: nextIndex });
  }

  async function toggleFlag() {
    const next = new Set(flagged);
    if (next.has(currentRow.question_id)) next.delete(currentRow.question_id);
    else next.add(currentRow.question_id);
    setFlagged(next);
    await updateChallengeProgress(challenge.id, { flaggedQuestionIds: [...next] });
  }

  const answeredCount = rows.filter((r) => {
    const a = answers[r.question_id];
    return a != null && a !== "" && !(typeof a === "object" && Object.values(a).every((v) => !v));
  }).length;
  const unansweredCount = rows.length - answeredCount;

  function requestSubmit() {
    if (unansweredCount > 0) setConfirmSubmit(true);
    else doSubmit();
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><ELabLoader /></div>;
  if (error) return <p className="p-10 text-center text-sm text-[var(--color-coral)]">{error}</p>;
  if (!challenge || !current) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">e-Lab Challenge</p>
            <p className="text-xs text-[var(--color-ink-faint)]">{challenge.topic_codes.join(" + ")}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {remainingSeconds != null && (
              <span role="timer" aria-live="polite" className={`font-mono font-medium ${remainingSeconds < 60 ? "text-[var(--color-coral)]" : "text-[var(--color-ink)]"}`}>
                {formatClock(remainingSeconds)} remaining
              </span>
            )}
            <span className="text-[var(--color-ink-faint)]">Q {index + 1} / {questions.length}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <QuestionRenderer
          question={current}
          answer={answers[current.id]}
          onAnswer={(value) => setAnswers((prev) => ({ ...prev, [current.id]: value }))}
        />
      </main>

      <footer className="sticky bottom-0 border-t border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <button type="button" onClick={toggleFlag} className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${flagged.has(currentRow.question_id) ? "border-[var(--color-amber)] bg-[var(--color-amber-soft)] text-[var(--color-amber)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
              <Flag size={13} /> {flagged.has(currentRow.question_id) ? "Flagged" : "Flag"}
            </button>
            <button type="button" onClick={() => setShowNavigator((v) => !v)} className="text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
              Question Navigator
            </button>
          </div>

          {showNavigator && (
            <div className="grid grid-cols-10 gap-1.5">
              {rows.map((r, i) => {
                const isAnswered = answers[r.question_id] != null && answers[r.question_id] !== "";
                const isFlagged = flagged.has(r.question_id);
                return (
                  <button
                    key={r.question_id} type="button" onClick={() => goTo(i)}
                    aria-current={i === index ? "true" : undefined}
                    className={`relative flex h-8 items-center justify-center rounded-md border text-xs font-medium ${
                      i === index ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" :
                      isAnswered ? "border-[var(--color-teal)]/40 bg-[var(--color-teal-soft)] text-[var(--color-teal)]" :
                      "border-[var(--color-line)] text-[var(--color-ink-faint)]"
                    }`}
                  >
                    {i + 1}
                    {isFlagged && <Flag size={9} className="absolute -right-1 -top-1 text-[var(--color-amber)]" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => goTo(index - 1)}>Previous</Button>
            {index < questions.length - 1 ? (
              <Button size="sm" onClick={() => goTo(index + 1)}>Next</Button>
            ) : (
              <Button size="sm" onClick={requestSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Challenge"}
              </Button>
            )}
          </div>
        </div>
      </footer>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmSubmit(false)}>
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[var(--color-ink)]">You still have {unansweredCount} unanswered question{unansweredCount === 1 ? "" : "s"}.</p>
            <div className="mt-4 flex gap-3">
              <Button variant="ghost" onClick={() => setConfirmSubmit(false)}>Return to Challenge</Button>
              <Button variant="danger" onClick={doSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Anyway"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
