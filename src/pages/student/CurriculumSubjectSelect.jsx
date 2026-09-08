import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, ArrowRight, ImageOff } from "lucide-react";
import { CURRICULA } from "../../data/curricula.js";

export default function CurriculumSubjectSelect() {
  const navigate = useNavigate();
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(null);

  const selectedCurriculum = CURRICULA.find((c) => c.id === selectedCurriculumId) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Welcome to e-Lab</p>
      <h1 className="mt-1.5 font-[var(--font-display)] text-[28px] font-bold tracking-tight text-[var(--color-ink)]">Choose Your Curriculum</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CURRICULA.map((curriculum) => (
          <CurriculumCard
            key={curriculum.id}
            curriculum={curriculum}
            selected={curriculum.id === selectedCurriculumId}
            onSelect={() => setSelectedCurriculumId(curriculum.id)}
          />
        ))}
      </div>

      {selectedCurriculum && (
        <div className="mt-10 animate-[fadeIn_0.25s_ease-out]">
          <h2 className="font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">Choose Your Subject</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {selectedCurriculum.subjects.filter((s) => s.available).map((subject) => (
              <SubjectCard key={subject.id} subject={subject} onSelect={() => navigate(subject.path)} />
            ))}
          </div>
        </div>
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
      className={`flex items-center gap-4 rounded-md border bg-[var(--color-paper-raised)] p-5 text-left shadow-[0_1px_2px_rgba(20,30,80,0.06),0_4px_12px_-4px_rgba(20,30,80,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(20,30,80,0.08),0_10px_20px_-6px_rgba(20,30,80,0.16)] ${
        selected ? "border-[var(--color-indigo)] ring-2 ring-[var(--color-indigo)]/25" : "border-[var(--color-line)]"
      }`}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] bg-white p-2">
        {curriculum.logo ? (
          <img src={curriculum.logo} alt={`${curriculum.name} logo`} className="h-full w-full object-contain" />
        ) : (
          // Deliberate, clearly-labeled placeholder — never a fabricated
          // substitute for the official logo. Swapped out the moment the
          // real asset file lands at curriculum.logo's path.
          <div className="flex flex-col items-center gap-0.5 text-center text-[var(--color-ink-faint)]">
            <ImageOff size={18} />
            <span className="text-[8px] leading-tight">Logo pending</span>
          </div>
        )}
      </div>
      <div>
        <p className="font-semibold text-[var(--color-ink)]">{curriculum.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-indigo)]">Select <ArrowRight size={12} /></p>
      </div>
    </button>
  );
}

function SubjectCard({ subject, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 text-left shadow-[0_1px_2px_rgba(20,30,80,0.06),0_4px_12px_-4px_rgba(20,30,80,0.1)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-indigo)] hover:shadow-[0_2px_4px_rgba(20,30,80,0.08),0_10px_20px_-6px_rgba(20,30,80,0.16)]"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-[var(--color-indigo)]">
        <FlaskConical size={28} className="text-white" />
      </div>
      <div>
        <p className="font-semibold text-[var(--color-ink)]">{subject.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-indigo)]">Enter <ArrowRight size={12} /></p>
      </div>
    </button>
  );
}
