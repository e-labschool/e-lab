import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { getConceptChecks } from "../../data/concept-checks.js";
import { useLearningProgress } from "../../context/ProgressContext.jsx";
import { useProtectedAction } from "../auth/ProtectedAction.jsx";
import Button from "../ui/Button.jsx";

function normalize(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

function QuestionBlock({ question, answer, onAnswer, revealed }) {
  const isCorrect = revealed && normalize(answer) === normalize(question.correctAnswer);

  return (
    <div className="rounded-md border border-[var(--color-line)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">{question.prompt}</p>

      {question.type === "mcq" && (
        <div className="mt-3 flex flex-col gap-1.5">
          {question.options.map((opt) => {
            const selected = answer === opt;
            const showCorrect = revealed && opt === question.correctAnswer;
            const showWrong = revealed && selected && opt !== question.correctAnswer;
            return (
              <button
                key={opt}
                type="button"
                disabled={revealed}
                onClick={() => onAnswer(opt)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  showCorrect
                    ? "border-[var(--color-teal)] bg-[var(--color-teal-soft)] text-[var(--color-teal)]"
                    : showWrong
                    ? "border-[var(--color-coral)] bg-[var(--color-coral-soft)] text-[var(--color-coral)]"
                    : selected
                    ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                    : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "true-false" && (
        <div className="mt-3 flex gap-2">
          {[true, false].map((v) => {
            const selected = answer === v;
            const showCorrect = revealed && v === question.correctAnswer;
            const showWrong = revealed && selected && v !== question.correctAnswer;
            return (
              <button
                key={String(v)}
                type="button"
                disabled={revealed}
                onClick={() => onAnswer(v)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  showCorrect
                    ? "border-[var(--color-teal)] bg-[var(--color-teal-soft)] text-[var(--color-teal)]"
                    : showWrong
                    ? "border-[var(--color-coral)] bg-[var(--color-coral-soft)] text-[var(--color-coral)]"
                    : selected
                    ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                    : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                }`}
              >
                {v ? "True" : "False"}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "numeric" && (
        <input
          type="text"
          disabled={revealed}
          value={answer ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Your answer"
          className="mt-3 w-full rounded-md border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none"
        />
      )}

      {revealed && (
        <div className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs ${isCorrect ? "bg-[var(--color-teal-soft)] text-[var(--color-teal)]" : "bg-[var(--color-amber-soft)] text-[var(--color-amber)]"}`}>
          {isCorrect ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
          <span>{question.explanation}</span>
        </div>
      )}
    </div>
  );
}

function scoreLabel(score, total) {
  if (score === total) return "Excellent. You're ready to continue.";
  if (score >= Math.ceil(total / 2)) return "Good. Review the highlighted point and continue when ready.";
  return "Revisit the concept above and try again when ready.";
}

// After every concept: 2-3 short questions, immediate feedback (never a
// bare "wrong"), a retry with no penalty, and the score/attempt persisted
// for signed-in students via useLearningProgress. This is formative
// practice, not an exam — no grades, no lockouts.
export default function CheckYourself({ conceptId }) {
  const questions = getConceptChecks(conceptId);
  const { statusFor, markCompleted, recordCheckAttempt } = useLearningProgress();
  const [runProtected, protectedPrompt] = useProtectedAction();
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  if (!questions) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-center">
        <p className="text-sm text-[var(--color-ink-faint)]">Check Yourself questions for this concept are coming soon.</p>
      </div>
    );
  }

  const score = questions.filter((q) => normalize(answers[q.id]) === normalize(q.correctAnswer)).length;
  const allAnswered = questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");

  function handleSubmit() {
    setSubmitted(true);
    runProtected(() => {
      for (const q of questions) {
        recordCheckAttempt(conceptId, {
          questionId: q.id,
          isCorrect: normalize(answers[q.id]) === normalize(q.correctAnswer),
          score,
        });
      }
    });
  }

  function handleRetry() {
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Check yourself</p>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">A quick check of what you just learned — {questions.length} short questions.</p>

      <div className="mt-4 flex flex-col gap-3">
        {questions.map((q) => (
          <QuestionBlock
            key={q.id}
            question={q}
            answer={answers[q.id]}
            revealed={submitted}
            onAnswer={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
          />
        ))}
      </div>

      {protectedPrompt}

      {!submitted ? (
        <Button className="mt-4" onClick={handleSubmit} disabled={!allAnswered}>
          Submit
        </Button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            {score} / {questions.length} — {scoreLabel(score, questions.length)}
          </p>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            <RotateCcw size={13} /> Try again
          </Button>
          {statusFor(conceptId) !== "completed" && (
            <Button size="sm" onClick={() => runProtected(() => markCompleted(conceptId))}>
              Mark concept complete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
