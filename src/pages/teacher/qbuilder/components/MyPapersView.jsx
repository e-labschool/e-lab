import { useState } from "react";
import { FolderOpen, Copy, Trash2, FolderOutput, Upload, Loader2 } from "lucide-react";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import { calcTotalMarks, formatDateStamp } from "../lib/paperUtils.js";
import { loadLegacyLocalPapers, loadLegacyDraftPaper, clearLegacyLocalPapers } from "../lib/storage.js";
import { createPaper, addItem } from "../lib/paperService.js";
import Card from "../../../../components/ui/Card.jsx";
import Button from "../../../../components/ui/Button.jsx";
import EmptyStatePanel from "../../../../components/ui/EmptyStatePanel.jsx";

export default function MyPapersView({ onOpenPaper }) {
  const { myPapers, duplicateSavedPaper, deleteSavedPaper, loadPaperIntoDraft } = useQBuilder();
  const [legacyPapers, setLegacyPapers] = useState(() => {
    const local = loadLegacyLocalPapers();
    const draft = loadLegacyDraftPaper();
    const draftHasContent = draft?.questions?.length > 0;
    return draftHasContent ? [{ ...draft, title: draft.details?.assessmentTitle || "Untitled (unsaved draft)" }, ...local] : local;
  });
  const [importing, setImporting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function handleImportLocalPapers() {
    setImporting(true);
    try {
      for (const legacy of legacyPapers) {
        // Every question from an old local paper becomes a frozen
        // custom_question snapshot — never an attempt to re-resolve a
        // Supabase version for old data, which could silently change
        // what an old paper meant. This preserves exactly what the
        // teacher had, per the same "frozen at the moment" principle
        // used everywhere else in this architecture.
        const paper = await createPaper({ title: legacy.title || "Imported paper", status: "saved" });
        await Promise.all(
          (legacy.questions ?? []).map((q, i) => addItem(paper.id, { position: i, customQuestion: q, marksOverride: null }))
        );
      }
      clearLegacyLocalPapers();
      setLegacyPapers([]);
      window.location.reload(); // simplest reliable way to refresh myPapers from the context's own load-on-mount logic
    } catch {
      setImporting(false);
    }
  }

  if (myPapers.length === 0 && legacyPapers.length === 0) {
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
    <div>
      {legacyPapers.length > 0 && !dismissed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-amber)]/30 bg-[var(--color-amber-soft)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">Found {legacyPapers.length} paper{legacyPapers.length === 1 ? "" : "s"} saved locally in this browser</p>
            <p className="text-xs text-[var(--color-ink-faint)]">Import them so they're available from any device, or dismiss if you don't need them.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleImportLocalPapers} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload size={13} /> Import local papers</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} disabled={importing}>Dismiss</Button>
          </div>
        </div>
      )}
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
    </div>
  );
}
