import { useState } from "react";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import QuestionCard from "./QuestionCard.jsx";
import QuestionPreviewModal from "./QuestionPreviewModal.jsx";
import EmptyStatePanel from "../../../../components/ui/EmptyStatePanel.jsx";
import { FilePlus } from "lucide-react";

export default function MyQuestionsView({ onEdit }) {
  const { myQuestions, isInDraft, addToDraft, deleteMyQuestion } = useQBuilder();
  const [previewQuestion, setPreviewQuestion] = useState(null);

  if (myQuestions.length === 0) {
    return (
      <EmptyStatePanel
        icon={FilePlus}
        title="No custom questions yet"
        description="Questions you create, or copies you edit from the Question Bank, will appear here."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {myQuestions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          inDraft={isInDraft(question.id)}
          onPreview={() => setPreviewQuestion(question)}
          onAddToPaper={() => addToDraft(question)}
          onEdit={() => onEdit(question)}
          onDelete={() => deleteMyQuestion(question.id)}
        />
      ))}
      <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />
    </div>
  );
}
