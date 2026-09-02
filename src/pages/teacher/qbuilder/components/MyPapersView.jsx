import { FolderOpen, Copy, Trash2, FolderOutput } from "lucide-react";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import { calcTotalMarks, formatDateStamp } from "../lib/paperUtils.js";
import Card from "../../../../components/ui/Card.jsx";
import EmptyStatePanel from "../../../../components/ui/EmptyStatePanel.jsx";

export default function MyPapersView({ onOpenPaper }) {
  const { myPapers, duplicateSavedPaper, deleteSavedPaper, loadPaperIntoDraft } = useQBuilder();

  if (myPapers.length === 0) {
    return (
      <EmptyStatePanel
        icon={FolderOutput}
        title="No saved papers yet"
        description="Build a paper in the Question Bank, then save it from the Paper Builder to see it here."
      />
    );
  }

  function handleOpen(paperId) {
    loadPaperIntoDraft(paperId);
    onOpenPaper();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {myPapers.map((paper) => (
        <Card key={paper.id} className="flex flex-col gap-3 p-5">
          <div>
            <p className="text-base font-medium text-[var(--color-ink)]">{paper.title}</p>
            <p className="text-xs text-[var(--color-ink-faint)]">{formatDateStamp(paper.createdAt)}</p>
          </div>
          <div className="flex gap-4 text-sm text-[var(--color-ink-soft)]">
            <span>{paper.questions.length} questions</span>
            <span>{calcTotalMarks(paper.questions)} marks</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-3">
            <button type="button" onClick={() => handleOpen(paper.id)} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
              <FolderOpen size={13} /> Open
            </button>
            <button type="button" onClick={() => duplicateSavedPaper(paper.id)} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
              <Copy size={13} /> Duplicate
            </button>
            <button type="button" onClick={() => deleteSavedPaper(paper.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-amber)] hover:border-[var(--color-amber)]">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
