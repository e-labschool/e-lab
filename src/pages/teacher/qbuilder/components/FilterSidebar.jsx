import { Search, X } from "lucide-react";
import {
  LEVELS, PAPERS, SYLLABUS_SECTIONS, TOPICS_BY_SECTION, SUBTOPICS_BY_TOPIC,
  DIFFICULTIES, QUESTION_TYPES,
} from "../lib/paperUtils.js";

function toggleInArray(array, value) {
  return array.includes(value) ? array.filter((v) => v !== value) : [...array, value];
}

function CheckboxGroup({ label, options, selected, onToggle }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</p>
      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="accent-[var(--color-indigo)]"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function FilterSidebar({ filters, onChange, onClear }) {
  const availableTopics = filters.syllabusSection.length > 0
    ? filters.syllabusSection.flatMap((s) => TOPICS_BY_SECTION[s])
    : Object.values(TOPICS_BY_SECTION).flat();

  const availableSubtopics = filters.topic.length > 0
    ? filters.topic.flatMap((t) => (SUBTOPICS_BY_TOPIC[t] || []).map((s) => `${t} \u00b7 ${s}`))
    : [];

  function set(patch) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search questions..."
          className="w-full rounded-md border border-[var(--color-line)] bg-transparent py-2 pl-8 pr-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-ink)]"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Level</p>
        <div className="inline-flex rounded-md border border-[var(--color-line)] p-0.5 text-sm">
          {["All", ...LEVELS].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => set({ level })}
              className={`rounded px-3 py-1 transition-colors ${
                filters.level === level ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)]"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <CheckboxGroup label="Paper" options={PAPERS} selected={filters.paper} onToggle={(v) => set({ paper: toggleInArray(filters.paper, v) })} />
      <CheckboxGroup label="Syllabus Section" options={SYLLABUS_SECTIONS} selected={filters.syllabusSection} onToggle={(v) => set({ syllabusSection: toggleInArray(filters.syllabusSection, v), topic: [], subtopic: [] })} />
      <CheckboxGroup label="Topic" options={availableTopics} selected={filters.topic} onToggle={(v) => set({ topic: toggleInArray(filters.topic, v), subtopic: [] })} />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Subtopic</p>
        {availableSubtopics.length === 0 ? (
          <p className="text-xs text-[var(--color-ink-faint)]">Select a topic first.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {availableSubtopics.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
                <input
                  type="checkbox"
                  checked={filters.subtopic.includes(option)}
                  onChange={() => set({ subtopic: toggleInArray(filters.subtopic, option) })}
                  className="accent-[var(--color-indigo)]"
                />
                {option}
              </label>
            ))}
          </div>
        )}
      </div>

      <CheckboxGroup label="Difficulty" options={DIFFICULTIES} selected={filters.difficulty} onToggle={(v) => set({ difficulty: toggleInArray(filters.difficulty, v) })} />
      <CheckboxGroup label="Question Type" options={QUESTION_TYPES} selected={filters.questionType} onToggle={(v) => set({ questionType: toggleInArray(filters.questionType, v) })} />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Marks</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={filters.marksMin}
            onChange={(e) => set({ marksMin: e.target.value })}
            placeholder="Min"
            className="w-16 rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]"
          />
          <span className="text-[var(--color-ink-faint)]">&ndash;</span>
          <input
            type="number"
            min={0}
            value={filters.marksMax}
            onChange={(e) => set({ marksMax: e.target.value })}
            placeholder="Max"
            className="w-16 rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink)]"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <X size={14} /> Clear Filters
      </button>
    </div>
  );
}
