import { FileText } from "lucide-react";
import Card from "../../../../components/ui/Card.jsx";
import { useQBuilder } from "../context/QBuilderContext.jsx";

export default function MyPaperPanel({ onViewPaper }) {
  const { draft, draftTotalMarks, clearDraft } = useQBuilder();

  return (
    <Card className="sticky top-20 p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
        <FileText size={15} /> My Paper
      </div>
      <div className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-ink-soft)]">
        <span>Questions: {draft.questions.length}</span>
        <span>Total Marks: {draftTotalMarks}</span>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onViewPaper}
          disabled={draft.questions.length === 0}
          className="rounded-md bg-[var(--color-ink)] px-3 py-2 text-sm text-[var(--color-paper)] disabled:opacity-40"
        >
          View Paper
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
    </Card>
  );
}
