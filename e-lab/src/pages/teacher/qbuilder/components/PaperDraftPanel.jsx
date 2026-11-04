import { useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FileText, ArrowRight } from "lucide-react";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import DraftQuestionRow from "./DraftQuestionRow.jsx";
import QuestionPreviewModal from "./QuestionPreviewModal.jsx";

// The live paper-building summary: stays visible while the teacher keeps
// browsing the Question Bank. Same drag-and-drop list (DraftQuestionRow)
// is reused by the full Paper Builder, so reordering here IS the final
// paper order — there's only ever one ordering, stored in draft.questions.
export default function PaperDraftPanel({ onViewPaper, className = "" }) {
  const { draft, draftTotalMarks, reorderDraft, removeFromDraft, clearDraft } = useQBuilder();
  const [previewQuestion, setPreviewQuestion] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.questions.findIndex((q) => q.id === active.id);
    const newIndex = draft.questions.findIndex((q) => q.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) reorderDraft(oldIndex, newIndex);
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="flex items-center gap-2 px-1 pb-3 text-sm font-medium text-[var(--color-ink)]">
        <FileText size={15} /> Paper Draft
      </div>

      <div className="flex-1 overflow-y-auto">
        {draft.questions.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--color-line)] px-3 py-8 text-center text-xs text-[var(--color-ink-faint)]">
            Add questions from the bank to build your paper.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={draft.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {draft.questions.map((q, i) => (
                  <DraftQuestionRow
                    key={q.id}
                    question={q}
                    index={i}
                    compact
                    onRemove={() => removeFromDraft(q.id)}
                    onClick={() => setPreviewQuestion(q)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="sticky bottom-0 mt-3 border-t border-[var(--color-line)] bg-[var(--color-paper)] pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-ink-soft)]">{draft.questions.length} question{draft.questions.length === 1 ? "" : "s"}</span>
          <span className="font-medium text-[var(--color-ink)]">Total Marks: {draftTotalMarks}</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={onViewPaper}
            disabled={draft.questions.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--color-ink)] px-3 py-2 text-sm text-[var(--color-paper)] disabled:opacity-40"
          >
            View Paper <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={clearDraft}
            disabled={draft.questions.length === 0}
            className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-soft)] disabled:opacity-40"
          >
            Clear Paper
          </button>
        </div>
      </div>

      <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />
    </div>
  );
}
