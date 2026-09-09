import { useState } from "react";
import { Lightbulb, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { submitLearnCheckAnswers } from "../../lib/learnContentService.js";
import QuestionRenderer from "../../pages/student/solve/QuestionRenderer.jsx";
import Button from "../ui/Button.jsx";

// Mandatory system section at the bottom of every Learn lesson. It is
// intentionally stateless with respect to Assess/Progress.
export default function CheckYourUnderstanding({ pageId, checkQuestions = [] }) {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // Map keyed by assignment item_id
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const items = checkQuestions.map((q) => ({
        itemId: q.item_id || q.id,
        sourceType: q.source_type || "canonical",
        questionId: q.question_id || null,
        studentAnswer: answers[q.item_id || q.id] ?? null,
      }));
      const data = await submitLearnCheckAnswers(pageId, items);
      setResults(new Map(data.map((r) => [r.item_id, r])));
    } catch (err) {
      setSubmitError(err.message || "Could not submit your answers.");
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
          {checkQuestions.map((item, i) => {
            const key = item.item_id || item.id;
            return (
              <CheckQuestionCard
                key={key}
                index={i}
                item={item}
                answer={answers[key]}
                onAnswer={(val) => setAnswers((prev) => ({ ...prev, [key]: val }))}
                result={results?.get(key)}
              />
            );
          })}
          {submitError && <p className="text-sm text-[var(--color-coral)]">{submitError}</p>}
          {!results && (
            <Button onClick={handleSubmit} disabled={submitting || !pageId}>
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

function CheckQuestionCard({ index, item, answer, onAnswer, result }) {
  const question = item.question;
  return (
    <div className="light-surface rounded-md border border-[#DCE1F0] bg-white p-5 text-[#12161C] shadow-sm">
      {question ? (
        <QuestionRenderer
          question={question}
          questionNumber={index + 1}
          answer={answer}
          onAnswer={onAnswer}
        />
      ) : (
        <div>
          <p className="text-xs font-medium text-[#666D7A]">Question {index + 1}</p>
          <p className="mt-2 text-sm text-[#4A5160]">{item.source_type === "manual" ? item.question_text : item.question_id || "Question content will appear after the Learn CMS update is applied."}</p>
          <input
            type="text"
            disabled={!!result}
            value={answer ?? ""}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Your answer"
            className="mt-3 w-full rounded-md border border-[#DCE1F0] bg-white px-3 py-2 text-sm text-[#12161C] placeholder:text-[#666D7A] focus:border-[#3654D6] focus:outline-none"
          />
        </div>
      )}

      {result && (
        <div className={`mt-4 flex items-start gap-1.5 rounded-md p-3 text-xs ${result.is_correct ? "bg-[#E7F3F0] text-[#2B7A6E]" : result.is_correct === false ? "bg-[#F8ECE9] text-[#B85C4A]" : "bg-[#EEF1FB] text-[#4A5160]"}`}>
          {result.is_correct ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
          <div>
            <p className="font-semibold">{result.is_correct ? "Correct" : result.is_correct === false ? "Not quite" : "Submitted"}</p>
            {result.explanation && <p className="mt-0.5 text-[#4A5160]">{result.explanation}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
