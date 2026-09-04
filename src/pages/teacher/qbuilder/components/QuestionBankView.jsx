import { useMemo, useState } from "react";
import { FileText, SlidersHorizontal, X } from "lucide-react";
import { useQBuilder } from "../context/QBuilderContext.jsx";
import { filterQuestions, DEFAULT_FILTERS, countActiveFilters } from "../lib/filterQuestions.js";
import { QUESTION_TYPE_MATCHERS } from "../lib/paperUtils.js";
import FilterPanel from "./FilterPanel.jsx";
import QuestionCard from "./QuestionCard.jsx";
import QuestionPreviewModal from "./QuestionPreviewModal.jsx";
import PaperDraftPanel from "./PaperDraftPanel.jsx";

// Three-column workspace on desktop: Filters (left, ~260px) + Question
// Bank (main) + Paper Draft (right, sticky, ~28% of the bank+draft area —
// preserved from before). Filters and Paper Draft both collapse to
// full-width drawers on mobile/tablet rather than permanently splitting a
// small screen three ways.
export default function QuestionBankView({ onEditCopy, onViewPaper }) {
  const { sampleQuestions, isInDraft, addToDraft, draft, draftTotalMarks } = useQBuilder();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [mobileDraftOpen, setMobileDraftOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const results = useMemo(
    () => filterQuestions(sampleQuestions, filters, QUESTION_TYPE_MATCHERS),
    [sampleQuestions, filters]
  );
  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr_300px] lg:items-start lg:gap-6">
      {/* Desktop: persistent left filter panel. */}
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:border-r lg:border-[var(--color-line)] lg:pr-5">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(DEFAULT_FILTERS)}
          allQuestions={sampleQuestions}
          resultCount={results.length}
        />
      </aside>

      <div>
        {/* Mobile/tablet: filters button opening a drawer. */}
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink)] lg:hidden"
        >
          <SlidersHorizontal size={14} />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>

        <div className="grid gap-4 sm:grid-cols-2">
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

      {/* Desktop: persistent sticky side panel. */}
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)]">
        <PaperDraftPanel onViewPaper={onViewPaper} />
      </aside>

      {/* Mobile/tablet: compact summary bar that opens a drawer. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileDraftOpen(true)}
          className="flex w-full items-center justify-between text-sm"
        >
          <span className="inline-flex items-center gap-1.5 text-[var(--color-ink)]">
            <FileText size={15} /> Paper Draft
          </span>
          <span className="text-[var(--color-ink-soft)]">
            {draft.questions.length} question{draft.questions.length === 1 ? "" : "s"} &middot; {draftTotalMarks} marks
          </span>
        </button>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 flex items-stretch bg-black/40 lg:hidden" onClick={() => setMobileFiltersOpen(false)}>
          <div
            className="h-full w-full max-w-xs overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-paper)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-ink)]">Filters</span>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="Close" className="text-[var(--color-ink-faint)]">
                <X size={18} />
              </button>
            </div>
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onClear={() => setFilters(DEFAULT_FILTERS)}
              allQuestions={sampleQuestions}
              resultCount={results.length}
            />
          </div>
        </div>
      )}

      {mobileDraftOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 lg:hidden" onClick={() => setMobileDraftOpen(false)}>
          <div
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-lg border-t border-[var(--color-line)] bg-[var(--color-paper)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setMobileDraftOpen(false)} aria-label="Close" className="text-[var(--color-ink-faint)]">
                <X size={18} />
              </button>
            </div>
            <PaperDraftPanel onViewPaper={onViewPaper} />
          </div>
        </div>
      )}

      {/* Spacer so the fixed mobile bar never overlaps the last row of cards. */}
      <div className="h-16 lg:hidden" aria-hidden="true" />

      <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />
    </div>
  );
}
