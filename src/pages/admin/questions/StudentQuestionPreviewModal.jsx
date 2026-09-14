import { X } from "lucide-react";
import QuestionRenderer from "../../student/solve/QuestionRenderer.jsx";

function parseStructured(value) {
  if (!value) return null;
  if (Array.isArray(value) || typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function toRenderableQuestion(source) {
  return {
    id: source.id,
    marks: Number(source.marks) || 0,
    questionType: source.questionType ?? source.question_type,
    questionText: source.questionText ?? source.questionContent ?? source.question_content ?? "",
    stimulus: source.stimulus ?? source.visualData ?? source.visual_data ?? null,
    parts: parseStructured(source.parts),
    options: parseStructured(source.options),
  };
}

export default function StudentQuestionPreviewModal({ question, onClose }) {
  const renderable = toRenderableQuestion(question);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-paper-raised)] px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">Student Preview</p>
            <p className="text-xs text-[var(--color-ink-faint)]">Student-facing content only — no answer key, markscheme or explanation.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-md p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>
        <div className="p-6">
          <QuestionRenderer question={renderable} questionNumber={1} answer={null} onAnswer={() => {}} onFocusInput={() => {}} />
        </div>
      </div>
    </div>
  );
}
