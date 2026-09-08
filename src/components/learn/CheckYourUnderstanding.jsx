import { useState } from "react";
import { Lightbulb, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { submitLearnCheckAnswers } from "../../lib/learnContentService.js";
import Button from "../ui/Button.jsx";

// Mandatory system section — permanently attached to the bottom of every
// lesson, never a draggable/deletable block. Deliberately does NOT touch
// student_challenges or Progress in any way (see mark_learn_check_answers
// in the SQL migration) — this is explicitly not the Assess experience.
export default function CheckYourUnderstanding({ checkQuestions }) {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // Map keyed by question_id after submit

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const items = checkQuestions.map((q) => ({
        questionId: q.question_id, questionVersionId: q.question_version_id, studentAnswer: answers[q.question_id] ?? null,
      }));
      const data = await submitLearnCheckAnswers(items);
      setResults(new Map(data.map((r) => [r.question_id, r])));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10 rounded-md border border-[var(--color-indigo)]/25 bg-gradient-to-br from-[var(--color-indigo-soft)] to-[var(--color-paper-raised)] p-6">
      <div className="flex items-center gap-2">
        <span className="glowing-bulb flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-amber-soft)]"><Lightbulb size={16} className="text-[var(--color-amber)]" /></span>
        <p className="text-lg font-bold text-[var(--color-ink)]">Check Your Understanding</p>
      </div>

      {checkQuestions.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-ink-faint)]">No check questions have been added to this lesson yet.</p>
      ) : !started ? (
        <>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Ready to test the concept?</p>
          <Button className="mt-3" onClick={() => setStarted(true)}>Start Check</Button>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          {checkQuestions.map((q, i) => (
            <CheckQuestionCard
              key={q.id}
              index={i}
              answer={answers[q.question_id]}
              onAnswer={(val) => setAnswers((prev) => ({ ...prev, [q.question_id]: val }))}
              result={results?.get(q.question_id)}
            />
          ))}
          {!results && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Answers"}
            </Button>
          )}
        </div>
      )}

      <style>{`
        .glowing-bulb { animation: elab-bulb-pulse 2.4s ease-in-out infinite; }
        @keyframes elab-bulb-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.35); } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); } }
        @media (prefers-reduced-motion: reduce) { .glowing-bulb { animation: none; } }
      `}</style>
    </div>
  );
}

function CheckQuestionCard({ index, answer, onAnswer, result }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white p-4">
      <p className="text-xs font-medium text-[var(--color-ink-faint)]">Question {index + 1}</p>
      <input
        type="text"
        disabled={!!result}
        value={answer ?? ""}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder="Your answer"
        className="mt-2 w-full rounded-md border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-indigo)] focus:outline-none"
      />
      {result && (
        <div className={`mt-2 flex items-start gap-1.5 rounded-md p-2 text-xs ${result.is_correct ? "bg-[var(--color-teal-soft)] text-[var(--color-teal)]" : "bg-[var(--color-coral-soft)] text-[var(--color-coral)]"}`}>
          {result.is_correct ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
          <div>
            <p className="font-medium">{result.is_correct ? "Correct" : "Not quite"}</p>
            {result.explanation && <p className="mt-0.5 text-[var(--color-ink-soft)]">{result.explanation}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
