import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, ArrowRight, Check, Loader2 } from "lucide-react";
import { CURRICULA } from "../../data/curricula.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function CurriculumSubjectSelect() {
  const navigate = useNavigate();
  const { profile, upsertProfile } = useAuth();
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [savingLevel, setSavingLevel] = useState(null);
  const [error, setError] = useState(null);

  const selectedCurriculum = CURRICULA.find((c) => c.id === selectedCurriculumId) ?? null;
  const selectedSubject = selectedCurriculum?.subjects.find((s) => s.id === selectedSubjectId) ?? null;

  function selectCurriculum(curriculumId) {
    setSelectedCurriculumId(curriculumId);
    setSelectedSubjectId(null);
    setError(null);
  }

  function selectSubject(subjectId) {
    setSelectedSubjectId(subjectId);
    setError(null);
  }

  async function selectLevel(level) {
    if (!selectedCurriculum || !selectedSubject) return;
    setSavingLevel(level);
    setError(null);
    try {
      await upsertProfile({
        curriculum: selectedCurriculum.name,
        level,
      });
      navigate(selectedSubject.path, { replace: true });
    } catch (err) {
      setError(err.message || "We couldn't save your course level. Please try again.");
    } finally {
      setSavingLevel(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Welcome to e-Lab</p>
      <h1 className="mt-1.5 font-[var(--font-display)] text-[28px] font-bold tracking-tight text-[var(--color-ink)]">Set Up Your Course</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        Choose your curriculum, subject and level. Your level decides which lessons, assessments and resources are available to you.
      </p>

      <section className="mt-8">
        <h2 className="font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">Choose Your Curriculum</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {CURRICULA.map((curriculum) => (
            <CurriculumCard
              key={curriculum.id}
              curriculum={curriculum}
              selected={curriculum.id === selectedCurriculumId}
              onSelect={() => selectCurriculum(curriculum.id)}
            />
          ))}
        </div>
      </section>

      {selectedCurriculum && (
        <section className="mt-10 animate-[fadeIn_0.25s_ease-out]">
          <h2 className="font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">Choose Your Subject</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {selectedCurriculum.subjects.filter((s) => s.available).map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                selected={subject.id === selectedSubjectId}
                onSelect={() => selectSubject(subject.id)}
              />
            ))}
          </div>
        </section>
      )}

      {selectedSubject && (
        <section className="mt-10 animate-[fadeIn_0.25s_ease-out]">
          <h2 className="font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">Choose Your Level</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            HL includes all shared SL content plus the additional Higher Level material.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <LevelCard
              level="SL"
              title="Standard Level"
              description="Access the shared SL course content."
              current={profile?.level === "SL"}
              loading={savingLevel === "SL"}
              disabled={Boolean(savingLevel)}
              onSelect={() => selectLevel("SL")}
            />
            <LevelCard
              level="HL"
              title="Higher Level"
              description="Access all shared SL content plus HL-only extensions."
              current={profile?.level === "HL"}
              loading={savingLevel === "HL"}
              disabled={Boolean(savingLevel)}
              onSelect={() => selectLevel("HL")}
            />
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-[var(--color-coral)]">{error}</p>}
        </section>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function CurriculumCard({ curriculum, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-1 rounded-md border bg-[var(--color-paper-raised)] p-5 text-left shadow-[0_1px_2px_rgba(20,30,80,0.06),0_4px_12px_-4px_rgba(20,30,80,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(20,30,80,0.08),0_10px_20px_-6px_rgba(20,30,80,0.16)] ${
        selected ? "border-[var(--color-indigo)] ring-2 ring-[var(--color-indigo)]/25" : "border-[var(--color-line)]"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <p className="font-semibold text-[var(--color-ink)]">{curriculum.name}</p>
        {selected && <Check size={17} className="text-[var(--color-indigo)]" />}
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-indigo)]">{selected ? "Selected" : "Select"} {!selected && <ArrowRight size={12} />}</p>
    </button>
  );
}

function SubjectCard({ subject, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-4 rounded-md border bg-[var(--color-paper-raised)] p-5 text-left shadow-[0_1px_2px_rgba(20,30,80,0.06),0_4px_12px_-4px_rgba(20,30,80,0.1)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-indigo)] hover:shadow-[0_2px_4px_rgba(20,30,80,0.08),0_10px_20px_-6px_rgba(20,30,80,0.16)] ${selected ? "border-[var(--color-indigo)] ring-2 ring-[var(--color-indigo)]/25" : "border-[var(--color-line)]"}`}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-[var(--color-indigo)]">
        <FlaskConical size={28} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-[var(--color-ink)]">{subject.name}</p>
          {selected && <Check size={17} className="text-[var(--color-indigo)]" />}
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-indigo)]">{selected ? "Selected" : "Select"} {!selected && <ArrowRight size={12} />}</p>
      </div>
    </button>
  );
}

function LevelCard({ level, title, description, current, loading, disabled, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="group rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 text-left shadow-[0_1px_2px_rgba(20,30,80,0.06),0_4px_12px_-4px_rgba(20,30,80,0.1)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-indigo)] hover:shadow-[0_2px_4px_rgba(20,30,80,0.08),0_10px_20px_-6px_rgba(20,30,80,0.16)] disabled:cursor-wait disabled:opacity-70"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--color-indigo)] px-2 py-1 text-xs font-bold text-white">{level}</span>
            <p className="font-semibold text-[var(--color-ink)]">{title}</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">{description}</p>
          {current && <p className="mt-2 text-xs font-medium text-[var(--color-indigo)]">Currently saved on your profile</p>}
        </div>
        {loading ? <Loader2 size={18} className="shrink-0 animate-spin text-[var(--color-indigo)]" /> : <ArrowRight size={18} className="shrink-0 text-[var(--color-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-indigo)]" />}
      </div>
    </button>
  );
}
