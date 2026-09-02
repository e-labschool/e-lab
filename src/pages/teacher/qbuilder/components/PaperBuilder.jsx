import { ArrowUp, ArrowDown, X, Pencil } from "lucide-react";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import Card from "../../../../components/ui/Card.jsx";

export default function PaperBuilder({ onEditQuestion }) {
  const { draft, draftTotalMarks, reorderDraft, removeFromDraft } = useQBuilder();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-6">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">My Paper</h2>
        <span className="text-sm text-[var(--color-ink-soft)]">Questions: {draft.questions.length}</span>
        <span className="text-sm text-[var(--color-ink-soft)]">Total Marks: {draftTotalMarks}</span>
      </div>

      {draft.questions.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-line)] px-6 py-14 text-center text-sm text-[var(--color-ink-faint)]">
          No questions added yet &mdash; add some from the Question Bank.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {draft.questions.map((question, index) => (
            <Card key={question.id} className="flex items-center gap-3 p-3.5">
              <span className="w-8 shrink-0 text-sm font-medium text-[var(--color-ink-faint)]">Q{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--color-ink)]">
                  {question.topic} \u00b7 {question.subtopic} \u2014 {question.marks} marks
                </p>
                <p className="truncate text-xs text-[var(--color-ink-faint)]">
                  {question.questionText.slice(0, 90)}{question.questionText.length > 90 ? "\u2026" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {question.isCustom && (
                  <button type="button" onClick={() => onEditQuestion(question)} aria-label="Edit" className="rounded-md border border-[var(--color-line)] p-1.5 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                    <Pencil size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => reorderDraft(index, index - 1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="rounded-md border border-[var(--color-line)] p-1.5 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => reorderDraft(index, index + 1)}
                  disabled={index === draft.questions.length - 1}
                  aria-label="Move down"
                  className="rounded-md border border-[var(--color-line)] p-1.5 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-30"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => removeFromDraft(question.id)}
                  aria-label="Remove"
                  className="rounded-md border border-[var(--color-line)] p-1.5 text-[var(--color-amber)] hover:border-[var(--color-amber)]"
                >
                  <X size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
