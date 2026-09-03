import { useState } from "react";
import { Eye, Copy, Check, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Card from "../../../../components/ui/Card.jsx";
import Badge from "../../../../components/ui/Badge.jsx";
import { getQuestionMarks } from "../../../../data/questions/schema.js";
import { getCurriculumCode } from "../lib/paperUtils.js";

export default function QuestionCard({
  question,
  inDraft,
  onPreview,
  onAddToPaper,
  onEditCopy,
  onEdit,
  onDelete,
}) {
  const [markschemeOpen, setMarkschemeOpen] = useState(false);
  const marks = getQuestionMarks(question);
  const hasParts = Array.isArray(question.parts) && question.parts.length > 0;
  const hasVisual = question.stimulus && question.stimulus.type !== "text";

  return (
    <Card className={`flex flex-col gap-3 p-5 transition-colors ${inDraft ? "border-[var(--color-teal)]/50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center rounded-md bg-[var(--color-indigo-soft)] px-2 py-0.5 font-[var(--font-mono)] text-xs font-medium text-[var(--color-indigo)]">
          {getCurriculumCode(question)}
        </span>
        <div className="flex gap-1.5">
          {hasVisual && <Badge tone="teal">Visual</Badge>}
          {question.status && question.status !== "published" && <Badge tone="amber">{question.status}</Badge>}
          {question.isCustom && <Badge tone="indigo">Custom</Badge>}
        </div>
      </div>

      <p className="whitespace-pre-line text-sm text-[var(--color-ink)]">
        {question.questionText.length > 140 ? `${question.questionText.slice(0, 140)}\u2026` : question.questionText}
        {hasParts && <span className="ml-1 text-xs text-[var(--color-ink-faint)]">({question.parts.length} parts)</span>}
      </p>

      {question.questionType === "MCQ" && Array.isArray(question.options) && (
        <ul className="flex flex-col gap-1 text-xs text-[var(--color-ink-soft)]">
          {question.options.map((opt) => (
            <li key={opt.id}>{opt.id}. {opt.text}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
        <span>{question.paper}</span>
        <span>&middot;</span>
        <span className="font-medium text-[var(--color-ink-soft)]">{marks} mark{marks === 1 ? "" : "s"}</span>
        <span>&middot;</span>
        <span>{question.difficulty}</span>
        <span>&middot;</span>
        <span>{question.questionType}</span>
        <span>&middot;</span>
        <span>{question.level}</span>
      </div>

      <button
        type="button"
        onClick={() => setMarkschemeOpen((v) => !v)}
        className="inline-flex w-fit items-center gap-1 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
      >
        {markschemeOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} View Markscheme
      </button>
      {markschemeOpen && (
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-xs text-[var(--color-ink-soft)]">
          {hasParts ? (
            <div className="flex flex-col gap-2">
              {question.parts.map((part, i) => (
                <div key={part.id ?? i}>
                  <p className="font-medium text-[var(--color-ink)]">({part.id ?? String.fromCharCode(97 + i)}) &mdash; {part.marks} mark{part.marks === 1 ? "" : "s"}</p>
                  <p className="whitespace-pre-line">{part.markscheme}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="whitespace-pre-line">{question.markscheme}</p>
          )}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3">
        <button type="button" onClick={onPreview} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
          <Eye size={13} /> Preview
        </button>

        {onAddToPaper && (
          <button
            type="button"
            onClick={onAddToPaper}
            disabled={inDraft}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
              inDraft ? "border-[var(--color-teal)] text-[var(--color-teal)]" : "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
            }`}
          >
            {inDraft ? <Check size={13} /> : <Plus size={13} />} {inDraft ? "Added" : "Add"}
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
