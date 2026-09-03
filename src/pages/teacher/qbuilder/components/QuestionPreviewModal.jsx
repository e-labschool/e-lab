import { X } from "lucide-react";
import Badge from "../../../../components/ui/Badge.jsx";
import { getQuestionMarks } from "../../../../data/questions/schema.js";
import StimulusRenderer from "./visuals/StimulusRenderer.jsx";

export default function QuestionPreviewModal({ question, onClose }) {
  if (!question) return null;

  const marks = getQuestionMarks(question);
  const hasParts = Array.isArray(question.parts) && question.parts.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="font-[var(--font-mono)] text-xs text-[var(--color-ink-faint)]">{question.id}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
          <Badge tone="neutral">{question.topicCode ?? `${question.topic} \u00b7 ${question.subtopic}`}</Badge>
          <Badge tone="neutral">{question.level}</Badge>
          <Badge tone="neutral">{question.paper}</Badge>
          <Badge tone="neutral">{marks} {marks === 1 ? "Mark" : "Marks"}</Badge>
          <Badge tone="neutral">{question.difficulty}</Badge>
          <Badge tone="neutral">{question.questionType}</Badge>
        </div>

        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink)]">{question.questionText}</p>

        {question.stimulus && (
          <div className="mt-3">
            <StimulusRenderer stimulus={question.stimulus} />
          </div>
        )}

        {question.questionType === "MCQ" && Array.isArray(question.options) && (
          <ul className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-ink-soft)]">
            {question.options.map((opt) => (
              <li key={opt.id}>{opt.id}. {opt.text}</li>
            ))}
          </ul>
        )}

        {hasParts ? (
          <div className="mt-6 flex flex-col gap-4 border-t border-[var(--color-line)] pt-4">
            {question.parts.map((part, i) => (
              <div key={part.id ?? i}>
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  ({part.id ?? String.fromCharCode(97 + i)}) {part.questionText} <span className="text-[var(--color-ink-faint)]">[{part.marks}]</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-xs text-[var(--color-ink-soft)]">{part.markscheme}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4 border-t border-[var(--color-line)] pt-4">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Answer</p>
              <p className="whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{question.correctAnswer ?? question.answer}</p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Markscheme</p>
              <p className="whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{question.markscheme}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
