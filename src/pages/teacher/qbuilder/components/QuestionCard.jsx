import { Eye, Copy, Check, Plus, Pencil, Trash2 } from "lucide-react";
import Card from "../../../../components/ui/Card.jsx";
import Badge from "../../../../components/ui/Badge.jsx";

export default function QuestionCard({
  question,
  inDraft,
  onPreview,
  onAddToPaper,
  onEditCopy,
  onEdit,
  onDelete,
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="font-[var(--font-mono)] text-xs text-[var(--color-ink-faint)]">{question.id}</span>
        {question.isCustom && <Badge tone="indigo">Custom</Badge>}
      </div>

      <p className="whitespace-pre-line text-sm text-[var(--color-ink)]">
        {question.questionText.length > 180 ? `${question.questionText.slice(0, 180)}\u2026` : question.questionText}
      </p>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <Badge tone="neutral">{question.topic} \u00b7 {question.subtopic}</Badge>
        <Badge tone="neutral">{question.level}</Badge>
        <Badge tone="neutral">{question.paper}</Badge>
        <Badge tone="neutral">{question.marks} {question.marks === 1 ? "Mark" : "Marks"}</Badge>
        <Badge tone={question.difficulty === "Hard" ? "amber" : question.difficulty === "Medium" ? "indigo" : "teal"}>
          {question.difficulty}
        </Badge>
        <Badge tone="neutral">{question.questionType}</Badge>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3">
        <button type="button" onClick={onPreview} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
          <Eye size={13} /> Preview
        </button>

        {onAddToPaper && (
          <button
            type="button"
            onClick={onAddToPaper}
            disabled={inDraft}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed ${
              inDraft ? "border-[var(--color-teal)] text-[var(--color-teal)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {inDraft ? <Check size={13} /> : <Plus size={13} />} {inDraft ? "Added" : "Add to Paper"}
          </button>
        )}

        {onEditCopy && (
          <button type="button" onClick={onEditCopy} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            <Copy size={13} /> Edit Copy
          </button>
        )}

        {onEdit && (
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            <Pencil size={13} /> Edit
          </button>
        )}

        {onDelete && (
          <button type="button" onClick={onDelete} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-amber)] hover:border-[var(--color-amber)]">
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </Card>
  );
}
