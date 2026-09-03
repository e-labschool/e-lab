import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Pencil } from "lucide-react";
import { getCurriculumCode } from "../lib/paperUtils.js";

// One compact row inside the Paper Draft panel / Paper Builder. Shows only
// [code] [truncated first line] [marks] plus a drag handle and remove
// control — never the full question text, per the brief. Self-contained
// sortable item so both the compact side panel and the full Paper Builder
// can render the same list with the same drag behaviour.
export default function DraftQuestionRow({ question, index, onRemove, onClick, onEdit, compact = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const firstLine = question.questionText.split("\n")[0];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder question ${index + 1}, ${getCurriculumCode(question)}`}
        className="shrink-0 cursor-grab touch-none text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] active:cursor-grabbing"
      >
        <GripVertical size={15} />
      </button>

      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="shrink-0 rounded bg-[var(--color-indigo-soft)] px-1.5 py-0.5 font-[var(--font-mono)] text-[11px] font-medium text-[var(--color-indigo)]">
          {getCurriculumCode(question)}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-ink-soft)]">{firstLine}</span>
      </button>

      <span className="shrink-0 font-[var(--font-mono)] text-xs font-medium text-[var(--color-ink)]">{question.marks}</span>

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${getCurriculumCode(question)}`}
          className="shrink-0 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
        >
          <Pencil size={13} />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${getCurriculumCode(question)} from paper`}
        className="shrink-0 text-[var(--color-ink-faint)] hover:text-[var(--color-amber)]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
