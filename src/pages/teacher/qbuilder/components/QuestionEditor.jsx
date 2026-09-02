import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  LEVELS, PAPERS, SYLLABUS_SECTIONS, TOPICS_BY_SECTION, SUBTOPICS_BY_TOPIC,
  DIFFICULTIES, QUESTION_TYPES, generateCustomId,
} from "../lib/paperUtils.js";
import FormattedTextField from "./FormattedTextField.jsx";
import Container from "../../../../components/ui/Container.jsx";

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-ink)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function emptyQuestion() {
  return {
    id: generateCustomId(),
    level: "SL",
    paper: "Paper 1B",
    syllabusSection: "Structure",
    topic: "Structure 1",
    subtopic: "1.1",
    marks: 2,
    difficulty: "Medium",
    questionType: "Short Response",
    questionText: "",
    answer: "",
    markscheme: "",
    tags: [],
    isCustom: true,
  };
}

// Handles both Create Question (sourceQuestion is null) and Edit Copy
// (sourceQuestion pre-fills the form with a fresh, already-copied id — the
// original Question Bank record is never touched).
export default function QuestionEditor({ sourceQuestion, onBack, onSave, onSaveAndAddToPaper }) {
  const [form, setForm] = useState(() => sourceQuestion ?? emptyQuestion());

  function set(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleSectionChange(section) {
    const firstTopic = TOPICS_BY_SECTION[section][0];
    set({ syllabusSection: section, topic: firstTopic, subtopic: SUBTOPICS_BY_TOPIC[firstTopic][0] });
  }

  function handleTopicChange(topic) {
    set({ topic, subtopic: SUBTOPICS_BY_TOPIC[topic][0] });
  }

  const isValid = form.questionText.trim().length > 0;

  return (
    <Container className="py-10">
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
          {sourceQuestion ? "Edit copy" : "Create question"}
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
          Question Editor
        </h1>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <SelectField label="Level" value={form.level} onChange={(v) => set({ level: v })} options={LEVELS} />
          <SelectField label="Paper" value={form.paper} onChange={(v) => set({ paper: v })} options={PAPERS} />
          <SelectField label="Difficulty" value={form.difficulty} onChange={(v) => set({ difficulty: v })} options={DIFFICULTIES} />
          <SelectField label="Syllabus Section" value={form.syllabusSection} onChange={handleSectionChange} options={SYLLABUS_SECTIONS} />
          <SelectField label="Topic" value={form.topic} onChange={handleTopicChange} options={TOPICS_BY_SECTION[form.syllabusSection]} />
          <SelectField label="Subtopic" value={form.subtopic} onChange={(v) => set({ subtopic: v })} options={SUBTOPICS_BY_TOPIC[form.topic]} />
          <SelectField label="Question Type" value={form.questionType} onChange={(v) => set({ questionType: v })} options={QUESTION_TYPES} />
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Marks</label>
            <input
              type="number"
              min={1}
              value={form.marks}
              onChange={(e) => set({ marks: Number(e.target.value) })}
              className="w-full rounded-md border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-ink)]"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <FormattedTextField label="Question" value={form.questionText} onChange={(v) => set({ questionText: v })} rows={5} placeholder="Enter the question text..." />
          <FormattedTextField label="Answer" value={form.answer} onChange={(v) => set({ answer: v })} rows={3} placeholder="Expected answer..." />
          <FormattedTextField label="Markscheme" value={form.markscheme} onChange={(v) => set({ markscheme: v })} rows={4} placeholder="M1 / A1 style marking points..." />
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-6">
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onSave(form)}
            className="rounded-md border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink)] disabled:opacity-40"
          >
            Save to My Questions
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onSaveAndAddToPaper(form)}
            className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)] disabled:opacity-40"
          >
            Save & Add to Paper
          </button>
        </div>
      </div>
    </Container>
  );
}
