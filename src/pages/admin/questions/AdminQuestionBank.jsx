import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, ChevronLeft, ChevronRight, Plus, HelpCircle } from "lucide-react";
import { listQuestions } from "../../../lib/questionBankService.js";
import Badge from "../../../components/ui/Badge.jsx";
import Button from "../../../components/ui/Button.jsx";

const PAGE_SIZE = 25;
const STATUS_TONE = { draft: "neutral", reviewed: "amber", published: "teal", archived: "coral" };
const LEVELS = ["SL", "HL", "SL/HL"];
const PAPERS = ["Paper 1A", "Paper 1B", "Paper 2"];
const QUESTION_TYPES = ["MCQ", "Calculation", "Short Response", "Extended Response", "Data-based"];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Challenge"];
const STATUSES = ["draft", "reviewed", "published", "archived"];
const DEFAULT_FILTERS = { search: "", topicCode: "", concept: "", level: "", paper: "", questionType: "", difficulty: "", status: "" };

export default function AdminQuestionBank() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listQuestions({ filters, page, pageSize: PAGE_SIZE })
      .then(({ rows: r, totalCount: t }) => { setRows(r); setTotalCount(t); })
      .catch((err) => setError(err.message || "Couldn't load questions."))
      .finally(() => setLoading(false));
  }, [filters, page]);

  function updateFilters(patch) {
    setLoading(true);
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Question Bank</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Canonical e-Lab questions, shared across Assess, Question Builder, and Quick Assess.</p>
        </div>
        <Button onClick={() => navigate("/admin/question-bank/new")}><Plus size={15} /> New Question</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
          <input
            type="text" placeholder="Search ID or question text" value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="w-56 rounded-md border border-[var(--color-line)] bg-transparent py-1.5 pl-7 pr-2.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
          />
        </div>
        <input
          type="text" placeholder="Topic code (e.g. S1.1)" value={filters.topicCode}
          onChange={(e) => updateFilters({ topicCode: e.target.value })}
          className="w-36 rounded-md border border-[var(--color-line)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)]"
        />
        <input
          type="text" placeholder="Concept" value={filters.concept}
          onChange={(e) => updateFilters({ concept: e.target.value })}
          className="w-40 rounded-md border border-[var(--color-line)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)]"
        />
        <FilterSelect label="Level" value={filters.level} options={LEVELS} onChange={(v) => updateFilters({ level: v })} />
        <FilterSelect label="Paper" value={filters.paper} options={PAPERS} onChange={(v) => updateFilters({ paper: v })} />
        <FilterSelect label="Type" value={filters.questionType} options={QUESTION_TYPES} onChange={(v) => updateFilters({ questionType: v })} />
        <FilterSelect label="Difficulty" value={filters.difficulty} options={DIFFICULTIES} onChange={(v) => updateFilters({ difficulty: v })} />
        <FilterSelect label="Status" value={filters.status} options={STATUSES} onChange={(v) => updateFilters({ status: v })} />
        {JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) && (
          <button type="button" onClick={() => updateFilters(DEFAULT_FILTERS)} className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-[var(--color-ink-faint)]">{totalCount} question{totalCount === 1 ? "" : "s"}</span>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--color-coral)]">{error}</p>}

      {loading ? (
        <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : rows.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <HelpCircle size={20} className="text-[var(--color-ink-faint)]" />
          <p className="text-sm text-[var(--color-ink-faint)]">No questions match these filters.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-line)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-ink-faint)]">
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">Topic</th>
                  <th className="px-4 py-2.5 font-medium">Concept</th>
                  <th className="px-4 py-2.5 font-medium">Level</th>
                  <th className="px-4 py-2.5 font-medium">Paper</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Difficulty</th>
                  <th className="px-4 py-2.5 font-medium">Marks</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => navigate(`/admin/question-bank/${q.id}`)}
                    className="cursor-pointer border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-line)]/15"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-ink)]">{q.id}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{q.topic_code}</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--color-ink-faint)]">{q.concept}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{q.level}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{q.paper}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{q.question_type}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{q.difficulty}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-soft)]">{q.marks}</td>
                    <td className="px-4 py-2.5"><Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-ink-faint)]">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1.5">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-line)] disabled:opacity-40"><ChevronLeft size={13} /></button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-line)] disabled:opacity-40"><ChevronRight size={13} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <select
      aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-xs text-[var(--color-ink-soft)] focus:border-[var(--color-ink)]"
    >
      <option value="">{label}: All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
