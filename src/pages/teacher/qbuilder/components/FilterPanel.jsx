import { useMemo, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import {
  PAPERS, DIFFICULTIES, LEVELS, STATUSES, QUESTION_TYPE_GROUPS,
  getAllCurriculumCodes, getCurriculumCode,
} from "../lib/paperUtils.js";
import { getAllCommandTerms, getAllSkills } from "../../../../data/questions/index.js";
import CurriculumFilterTree from "./CurriculumFilterTree.jsx";
import CheckboxGroup from "./CheckboxGroup.jsx";

const ALL_CODES = getAllCurriculumCodes();
const ALL_COMMAND_TERMS = getAllCommandTerms();
const ALL_SKILLS = getAllSkills();

// All primary filters live here, in the left panel, as checkboxes — no
// dropdowns for Curriculum/Level/Paper/Difficulty/Type. `allQuestions` is
// the unfiltered bank, used only to compute the small option counts
// (e.g. "1.3 (24)") once per bank load, not recomputed against every
// other active filter (facet counting), which the brief allows ("if
// practical") in favour of staying simple and fast.
export default function FilterPanel({ filters, onChange, onClear, allQuestions, resultCount }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const counts = useMemo(() => {
    const byCode = {}, byLevel = {}, byPaper = {}, byDifficulty = {}, byType = {};
    for (const code of ALL_CODES) byCode[code] = 0;
    for (const q of allQuestions) {
      const code = getCurriculumCode(q);
      byCode[code] = (byCode[code] ?? 0) + 1;
      byLevel[q.level] = (byLevel[q.level] ?? 0) + 1;
      byPaper[q.paper] = (byPaper[q.paper] ?? 0) + 1;
      byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1;
      for (const group of QUESTION_TYPE_GROUPS) {
        if (group.match(q)) byType[group.id] = (byType[group.id] ?? 0) + 1;
      }
    }
    return { byCode, byLevel, byPaper, byDifficulty, byType };
  }, [allQuestions]);

  function set(patch) {
    onChange({ ...filters, ...patch });
  }

  const activeChips = [
    ...filters.curriculumCodes.map((c) => ({ key: `code-${c}`, label: c, clear: () => set({ curriculumCodes: filters.curriculumCodes.filter((x) => x !== c) }) })),
    ...filters.levels.map((l) => ({ key: `level-${l}`, label: l, clear: () => set({ levels: filters.levels.filter((x) => x !== l) }) })),
    ...filters.papers.map((p) => ({ key: `paper-${p}`, label: p, clear: () => set({ papers: filters.papers.filter((x) => x !== p) }) })),
    ...filters.difficulties.map((d) => ({ key: `diff-${d}`, label: d, clear: () => set({ difficulties: filters.difficulties.filter((x) => x !== d) }) })),
    ...filters.questionTypes.map((t) => ({
      key: `type-${t}`,
      label: QUESTION_TYPE_GROUPS.find((g) => g.id === t)?.label ?? t,
      clear: () => set({ questionTypes: filters.questionTypes.filter((x) => x !== t) }),
    })),
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search mole, VSEPR, titration…"
          className="w-full rounded-md border border-[var(--color-line)] bg-transparent py-1.5 pl-7 pr-2.5 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-ink)]"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-ink)]">
          {resultCount} question{resultCount === 1 ? "" : "s"} found
        </p>
        {activeChips.length > 0 && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
            <X size={11} /> Clear all
          </button>
        )}
      </div>

      {activeChips.length > 0 && activeChips.length <= 8 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--color-indigo-soft)] px-2 py-1 text-[11px] font-medium text-[var(--color-indigo)] hover:opacity-80"
            >
              {chip.label} <X size={10} />
            </button>
          ))}
        </div>
      )}
      {activeChips.length > 8 && (
        <p className="text-xs text-[var(--color-ink-faint)]">{activeChips.length} filters active</p>
      )}

      <div className="max-h-[calc(100vh-14rem)] space-y-5 overflow-y-auto pr-1">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Curriculum</p>
          <CurriculumFilterTree selectedCodes={filters.curriculumCodes} onChange={(codes) => set({ curriculumCodes: codes })} counts={counts.byCode} />
        </div>

        <CheckboxGroup title="Level" options={LEVELS} selected={filters.levels} onChange={(v) => set({ levels: v })} counts={counts.byLevel} />
        <CheckboxGroup title="Paper" options={PAPERS} selected={filters.papers} onChange={(v) => set({ papers: v })} counts={counts.byPaper} />
        <CheckboxGroup title="Difficulty" options={DIFFICULTIES} selected={filters.difficulties} onChange={(v) => set({ difficulties: v })} counts={counts.byDifficulty} />
        <CheckboxGroup title="Question type" options={QUESTION_TYPE_GROUPS} selected={filters.questionTypes} onChange={(v) => set({ questionTypes: v })} counts={counts.byType} />

        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]"
          >
            More filters
            <ChevronDown size={13} className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </button>
          {advancedOpen && (
            <div className="mt-2 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-[var(--color-ink-faint)]" htmlFor="filter-status">Status</label>
                <select
                  id="filter-status"
                  value={filters.status}
                  onChange={(e) => set({ status: e.target.value })}
                  className="w-full rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]"
                >
                  {["All", ...STATUSES].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {ALL_COMMAND_TERMS.length > 0 && (
                <div>
                  <label className="mb-1 block text-[11px] text-[var(--color-ink-faint)]" htmlFor="filter-command-term">Command term</label>
                  <select
                    id="filter-command-term"
                    value={filters.commandTerm}
                    onChange={(e) => set({ commandTerm: e.target.value })}
                    className="w-full rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]"
                  >
                    {["All", ...ALL_COMMAND_TERMS].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {ALL_SKILLS.length > 0 && (
                <div>
                  <label className="mb-1 block text-[11px] text-[var(--color-ink-faint)]" htmlFor="filter-skill">Skill</label>
                  <select
                    id="filter-skill"
                    value={filters.skill}
                    onChange={(e) => set({ skill: e.target.value })}
                    className="w-full rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]"
                  >
                    {["All", ...ALL_SKILLS].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div>
                <p className="mb-1 text-[11px] text-[var(--color-ink-faint)]">Marks range</p>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} value={filters.marksMin} onChange={(e) => set({ marksMin: e.target.value })} placeholder="Min" aria-label="Minimum marks" className="w-full rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]" />
                  <span className="text-[var(--color-ink-faint)]">&ndash;</span>
                  <input type="number" min={0} value={filters.marksMax} onChange={(e) => set({ marksMax: e.target.value })} placeholder="Max" aria-label="Maximum marks" className="w-full rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
