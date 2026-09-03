import { useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import DraftQuestionRow from "./DraftQuestionRow.jsx";
import QuestionPreviewModal from "./QuestionPreviewModal.jsx";

// Same drag-and-drop question list as the compact Paper Draft panel — one
// ordering (draft.questions), two places it can be rearranged from.
export default function PaperBuilder({ onEditQuestion }) {
  const { draft, draftTotalMarks, reorderDraft, removeFromDraft } = useQBuilder();
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={draft.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {draft.questions.map((q, i) => (
                <DraftQuestionRow
                  key={q.id}
                  question={q}
                  index={i}
                  onRemove={() => removeFromDraft(q.id)}
                  onEdit={q.isCustom ? () => onEditQuestion(q) : undefined}
                  onClick={() => setPreviewQuestion(q)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />
    </div>
  );
}
