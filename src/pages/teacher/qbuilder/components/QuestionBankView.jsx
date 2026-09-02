import { useMemo, useState } from "react";
import { SlidersHorizontal, FileText } from "lucide-react";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import { filterQuestions, DEFAULT_FILTERS } from "../lib/filterQuestions.js";
import FilterSidebar from "./FilterSidebar.jsx";
import QuestionCard from "./QuestionCard.jsx";
import QuestionPreviewModal from "./QuestionPreviewModal.jsx";
import MyPaperPanel from "./MyPaperPanel.jsx";

export default function QuestionBankView({ onEditCopy, onViewPaper }) {
  const { sampleQuestions, isInDraft, addToDraft, draft, draftTotalMarks } = useQBuilder();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const results = useMemo(() => filterQuestions(sampleQuestions, filters), [sampleQuestions, filters]);

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr_240px]">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-soft)]"
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
        {draft.questions.length > 0 && (
          <button
            type="button"
            onClick={onViewPaper}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)]"
          >
            <FileText size={14} /> My Paper &middot; {draft.questions.length} &middot; {draftTotalMarks} marks
          </button>
        )}
      </div>

      <aside className={`${mobileFiltersOpen ? "block" : "hidden"} lg:sticky lg:top-20 lg:block lg:self-start`}>
        <FilterSidebar filters={filters} onChange={setFilters} onClear={() => setFilters(DEFAULT_FILTERS)} />
      </aside>

      <div>
        <p className="mb-4 text-xs text-[var(--color-ink-faint)]">
          {results.length} question{results.length === 1 ? "" : "s"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {results.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              inDraft={isInDraft(question.id)}
              onPreview={() => setPreviewQuestion(question)}
              onAddToPaper={() => addToDraft(question)}
              onEditCopy={() => onEditCopy(question)}
            />
          ))}
          {results.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-[var(--color-ink-faint)]">
              No questions match the current filters.
            </p>
          )}
        </div>
      </div>

      <div className="hidden lg:block">
        <MyPaperPanel onViewPaper={onViewPaper} />
      </div>

      <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />
    </div>
  );
}
