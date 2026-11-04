import { useQBuilder } from "../context/QBuilderContext.jsx";

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-md border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]";

export default function PaperDetailsForm() {
  const { draft, draftTotalMarks, updateDraftDetails } = useQBuilder();
  const { details } = draft;

  function set(patch) {
    updateDraftDetails(patch);
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="School Name">
        <input type="text" value={details.schoolName} onChange={(e) => set({ schoolName: e.target.value })} className={inputClass} placeholder="e.g. Riverside International School" />
      </Field>
      <Field label="Assessment Title">
        <input type="text" value={details.assessmentTitle} onChange={(e) => set({ assessmentTitle: e.target.value })} className={inputClass} placeholder="e.g. Term 1 Assessment" />
      </Field>
      <Field label="Subject">
        <input type="text" value={details.subject} onChange={(e) => set({ subject: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Class / Grade">
        <input type="text" value={details.classGrade} onChange={(e) => set({ classGrade: e.target.value })} className={inputClass} placeholder="e.g. Grade 12" />
      </Field>
      <Field label="Date">
        <input type="date" value={details.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Duration">
        <input type="text" value={details.duration} onChange={(e) => set({ duration: e.target.value })} className={inputClass} placeholder="e.g. 60 minutes" />
      </Field>
      <Field label="Maximum Marks">
        <input
          type="number"
          value={details.maxMarks === "" ? draftTotalMarks : details.maxMarks}
          onChange={(e) => set({ maxMarks: e.target.value })}
          className={inputClass}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Instructions">
          <textarea
            value={details.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            rows={4}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}
