import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, ChevronLeft, ChevronRight, Plus, HelpCircle, Upload, ImageIcon, AlertTriangle } from "lucide-react";
import { listQuestions, listQuestionsForVisualStats } from "../../../lib/questionBankService.js";
import { getVisualStatus, matchesVisualFilter, VISUAL_FILTER_OPTIONS } from "./visualStatus.js";
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

const VISUAL_BADGE_TONE = {
  "no-visual": "neutral", "possible-visual-needed": "amber", "elab-visual": "indigo",
  "uploaded-image": "teal", "visual-issue": "coral",
};
const VISUAL_BADGE_LABEL = {
  "no-visual": "No Visual", "possible-visual-needed": "Possible Visual Needed",
  "uploaded-image": "Uploaded Image", "visual-issue": "Visual Issue",
};

export default function AdminQuestionBank() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [visualFilter, setVisualFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Real counts, computed from actual data — never hard-coded — via one
  // lightweight fetch of visual-relevant fields for every question.
  const [visualCounts, setVisualCounts] = useState(null);

  useEffect(() => {
    listQuestions({ filters, page, pageSize: PAGE_SIZE })
      .then(({ rows: r, totalCount: t }) => { setRows(r); setTotalCount(t); })
      .catch((err) => setError(err.message || "Couldn't load questions."))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => {
    listQuestionsForVisualStats()
      .then((allRows) => {
        const counts = { "no-visual": 0, "possible-visual-needed": 0, "elab-visual-or-image": 0, "visual-issue": 0 };
        for (const q of allRows) {
          const status = getVisualStatus(q);
          if (status === "elab-visual" || status === "uploaded-image") counts["elab-visual-or-image"] += 1;
          else counts[status] = (counts[status] ?? 0) + 1;
        }
        setVisualCounts(counts);
      })
      .catch(() => setVisualCounts(null));
  }, []);

  function updateFilters(patch) {
    setLoading(true);
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  // The visual filter is applied client-side, on top of the server-paginated
  // page already fetched — a known limitation for very large result sets
  // (a page of 25 may show fewer rows after filtering), disclosed rather
  // than silently accepted as fully accurate at scale.
  const displayedRows = rows.filter((q) => matchesVisualFilter(q, visualFilter));
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Question Bank</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Canonical e-Lab questions, shared across Assess, Question Builder, and Quick Assess.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/admin/question-bank/import")}><Upload size={15} /> Import Questions</Button>
          <Button onClick={() => navigate("/admin/question-bank/new")}><Plus size={15} /> New Question</Button>
        </div>
      </div>

      {visualCounts && (
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["no-visual", "No Visual", visualCounts["no-visual"]],
            ["possible-visual-needed", "Possible Visual Needed", visualCounts["possible-visual-needed"]],
            ["elab-visual-or-image", "Has Visual", visualCounts["elab-visual-or-image"]],
            ["visual-issue", "Visual Issues", visualCounts["visual-issue"]],
          ].map(([id, label, count]) => (
            <button
              key={id} type="button" onClick={() => setVisualFilter(id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                visualFilter === id ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
              }`}
            >
              {label} \u00b7 {count}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
        <select
          aria-label="Visual" value={visualFilter} onChange={(e) => setVisualFilter(e.target.value)}
          className="rounded-md border border-[var(--color-indigo)]/40 bg-[var(--color-indigo-soft)] px-2 py-1.5 text-xs font-medium text-[var(--color-indigo)] focus:border-[var(--color-indigo)]"
        >
          {VISUAL_FILTER_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {(JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) || visualFilter !== "all") && (
          <button type="button" onClick={() => { updateFilters(DEFAULT_FILTERS); setVisualFilter("all"); }} className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-[var(--color-ink-faint)]">{totalCount} question{totalCount === 1 ? "" : "s"}</span>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--color-coral)]">{error}</p>}

      {loading ? (
        <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : displayedRows.length === 0 ? (
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
                  <th className="px-4 py-2.5 font-medium">Visual</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((q) => {
                  const visualStatusId = getVisualStatus(q);
                  return (
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
                      <td className="px-4 py-2.5">
                        {visualStatusId === "no-visual" ? (
                          <span className="text-xs text-[var(--color-ink-faint)]">\u2014</span>
                        ) : (
                          <Badge tone={VISUAL_BADGE_TONE[visualStatusId]}>
                            {visualStatusId === "elab-visual"
                              ? <span className="flex items-center gap-1">Visual \u00b7 {q.visual_data.type}</span>
                              : visualStatusId === "visual-issue"
                                ? <span className="flex items-center gap-1"><AlertTriangle size={11} /> {VISUAL_BADGE_LABEL[visualStatusId]}</span>
                                : visualStatusId === "uploaded-image"
                                  ? <span className="flex items-center gap-1"><ImageIcon size={11} /> {VISUAL_BADGE_LABEL[visualStatusId]}</span>
                                  : VISUAL_BADGE_LABEL[visualStatusId]}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
