import { Search, X } from "lucide-react";
import {
  PAPERS, SYLLABUS_SECTIONS, DIFFICULTIES, QUESTION_TYPES, LEVELS, STATUSES, getAllCurriculumCodes,
} from "../lib/paperUtils.js";
import { UNITS } from "../../../../data/questions/unitMeta.js";
import { getAllCommandTerms, getAllSkills } from "../../../../data/questions/index.js";

const PAPER_TABS = ["All", ...PAPERS];
const ALL_CODES = getAllCurriculumCodes();
const ALL_UNITS = UNITS.map((u) => u.unit);
const ALL_COMMAND_TERMS = getAllCommandTerms();
const ALL_SKILLS = getAllSkills();

function Select({ value, onChange, options, ariaLabel }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="rounded-md border border-[var(--color-line)] bg-transparent px-2.5 py-1.5 text-sm text-[var(--color-ink)]"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

// A compact, mostly-horizontal filter system: paper is a primary tab row
// (matching the "Paper 1A | Paper 1B | Paper 2" brief exactly), everything
// else collapses into a flex-wrap bar of small dropdowns so filtering never
// dominates vertical space above the question list.
export default function FilterBar({ filters, onChange, onClear }) {
  const unitsForSection = filters.section === "All" ? ALL_UNITS : ALL_UNITS.filter((u) => u.startsWith(filters.section));
  const codesForUnit =
    filters.unit !== "All"
      ? ALL_CODES.filter((c) => c.startsWith(`${filters.unit[0]}${filters.unit.split(" ")[1]}.`))
      : filters.section === "All"
      ? ALL_CODES
      : ALL_CODES.filter((c) => c[0] === filters.section[0]);

  function set(patch) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-line)] pb-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PAPER_TABS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set({ paper: p })}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              filters.paper === p
                ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                : "border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search mole, VSEPR, titration..."
            className="w-52 rounded-md border border-[var(--color-line)] bg-transparent py-1.5 pl-7 pr-2.5 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-ink)]"
          />
        </div>

        <Select ariaLabel="Level" value={filters.level} onChange={(v) => set({ level: v })} options={["All", ...LEVELS]} />
        <Select
          ariaLabel="Syllabus section"
          value={filters.section}
          onChange={(v) => set({ section: v, unit: "All", code: "All" })}
          options={["All", ...SYLLABUS_SECTIONS]}
        />
        <Select ariaLabel="Unit" value={filters.unit} onChange={(v) => set({ unit: v, code: "All" })} options={["All", ...unitsForSection]} />
        <Select ariaLabel="Topic" value={filters.code} onChange={(v) => set({ code: v })} options={["All", ...codesForUnit]} />
        <Select ariaLabel="Difficulty" value={filters.difficulty} onChange={(v) => set({ difficulty: v })} options={["All", ...DIFFICULTIES]} />
        <Select ariaLabel="Question type" value={filters.questionType} onChange={(v) => set({ questionType: v })} options={["All", ...QUESTION_TYPES]} />
        {ALL_COMMAND_TERMS.length > 0 && (
          <Select ariaLabel="Command term" value={filters.commandTerm} onChange={(v) => set({ commandTerm: v })} options={["All", ...ALL_COMMAND_TERMS]} />
        )}
        {ALL_SKILLS.length > 0 && (
          <Select ariaLabel="Skill" value={filters.skill} onChange={(v) => set({ skill: v })} options={["All", ...ALL_SKILLS]} />
        )}
        <Select ariaLabel="Status" value={filters.status} onChange={(v) => set({ status: v })} options={["All", ...STATUSES]} />

        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            value={filters.marksMin}
            onChange={(e) => set({ marksMin: e.target.value })}
            placeholder="Min"
            aria-label="Minimum marks"
            className="w-14 rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]"
          />
          <span className="text-[var(--color-ink-faint)]">&ndash;</span>
          <input
            type="number"
            min={0}
            value={filters.marksMax}
            onChange={(e) => set({ marksMax: e.target.value })}
            placeholder="Max"
            aria-label="Maximum marks"
            className="w-14 rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]"
          />
        </div>

        <button
          type="button"
          onClick={onClear}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          <X size={12} /> Clear Filters
        </button>
      </div>
    </div>
  );
}
