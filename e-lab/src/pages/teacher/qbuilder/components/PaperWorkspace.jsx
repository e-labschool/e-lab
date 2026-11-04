import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import PaperBuilder from "./PaperBuilder.jsx";
import PaperDetailsForm from "./PaperDetailsForm.jsx";
import PaperPreview from "./PaperPreview.jsx";
import MarkschemePreview from "./MarkschemePreview.jsx";
import ExportControls from "./ExportControls.jsx";
import Container from "../../../../components/ui/Container.jsx";

const STAGES = [
  { id: "builder", label: "Build" },
  { id: "details", label: "Paper Details" },
  { id: "preview", label: "Preview" },
];

export default function PaperWorkspace({ onBack, onEditQuestion, onSaved }) {
  const { draft, draftTotalMarks, saveCurrentPaper } = useQBuilder();
  const [stage, setStage] = useState("builder");
  const [previewMode, setPreviewMode] = useState("paper"); // "paper" | "markscheme"

  function handleSave() {
    saveCurrentPaper(draft.details.assessmentTitle);
    onSaved();
  }

  return (
    <Container className="py-10">
      <div className="qbuilder-chrome mb-6 flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
          <ArrowLeft size={14} /> Back to Question Bank
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={draft.questions.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)] disabled:opacity-40"
        >
          <Save size={14} /> Save Paper
        </button>
      </div>

      <div className="qbuilder-chrome mb-8 inline-flex rounded-full border border-[var(--color-line)] p-0.5 text-sm">
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStage(s.id)}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              stage === s.id ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {stage === "builder" && <PaperBuilder onEditQuestion={onEditQuestion} />}
      {stage === "details" && <PaperDetailsForm />}

      {stage === "preview" && (
        <div>
          <div className="qbuilder-chrome mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex rounded-full border border-[var(--color-line)] p-0.5 text-sm">
              {["paper", "markscheme"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPreviewMode(m)}
                  className={`rounded-full px-4 py-1.5 capitalize transition-colors ${
                    previewMode === m ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)]"
                  }`}
                >
                  {m === "paper" ? "Question Paper" : "Markscheme"}
                </button>
              ))}
            </div>
            <ExportControls draft={draft} totalMarks={draftTotalMarks} mode={previewMode} />
          </div>

          <div className="qbuilder-print-area">
            {previewMode === "paper" ? (
              <PaperPreview draft={draft} totalMarks={draftTotalMarks} />
            ) : (
              <MarkschemePreview draft={draft} totalMarks={draftTotalMarks} />
            )}
          </div>
        </div>
      )}
    </Container>
  );
}
