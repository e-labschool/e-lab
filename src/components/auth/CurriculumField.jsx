import { PLATFORM_CURRICULA, CURRICULUM_STATUS, OTHER_CURRICULUM_ID, OTHER_NAME_MAX, curriculaForRole } from "../../data/curricula.js";

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";

/**
 * Curriculum picker shared by the sign-up form and the profile editor.
 *   role === 'student' -> choose ONE (radio group);  role === 'teacher' -> choose ONE OR MORE (checkboxes).
 * Controlled: `value` is an array of curriculum ids, `other` the optional free-text name used with "Other".
 * Never allows an empty selection for teachers (the last checked box cannot be unticked) so nobody is blocked.
 */
export default function CurriculumField({ role, value, other = "", onChange, onOtherChange, idPrefix = "cur", showHelp = true }) {
  const multi = role === "teacher";
  const selected = curriculaForRole(role, value);
  const hasOther = selected.includes(OTHER_CURRICULUM_ID);

  function toggle(id) {
    if (!multi) return onChange([id]);
    if (selected.includes(id)) {
      if (selected.length === 1) return; // keep at least one
      return onChange(selected.filter((x) => x !== id));
    }
    onChange([...selected, id]);
  }

  return (
    <fieldset data-testid="curriculum-field" data-role={role} className="min-w-0">
      <legend className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]">
        Curriculum <span className="text-[var(--color-coral)]" aria-hidden="true">*</span>
        <span className="sr-only"> (required)</span>
        <span className="ml-1 font-normal text-[var(--color-ink-faint)]">{multi ? "choose one or more" : "choose one"}</span>
      </legend>
      <div role={multi ? "group" : "radiogroup"} aria-label="Curriculum" className="space-y-1.5">
        {PLATFORM_CURRICULA.map((c) => {
          const checked = selected.includes(c.id);
          const id = `${idPrefix}-${c.id}`;
          return (
            <label key={c.id} htmlFor={id} className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors ${checked ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-ink)]" : "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/40"}`}>
              <input id={id} type={multi ? "checkbox" : "radio"} name={`${idPrefix}-choice`} value={c.id} checked={checked} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-[#2647C4]" data-curriculum={c.id} />
              <span className="min-w-0 flex-1">{c.label}</span>
              {c.status === CURRICULUM_STATUS.PLANNED && c.id !== OTHER_CURRICULUM_ID && <span className="shrink-0 rounded-full border border-[var(--color-line)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Content planned</span>}
            </label>
          );
        })}
      </div>
      {hasOther && (
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor={`${idPrefix}-other-name`}>Name of the curriculum <span className="font-normal text-[var(--color-ink-faint)]">(optional)</span></label>
          <input id={`${idPrefix}-other-name`} className={inputClasses} maxLength={OTHER_NAME_MAX} value={other} onChange={(e) => onOtherChange?.(e.target.value)} placeholder="e.g. AP, Swiss Matura" />
        </div>
      )}
      {showHelp && (
        <p className="mt-1.5 text-[11px] leading-4 text-[var(--color-ink-faint)]" data-testid="curriculum-help">
          Required. IB Diploma (DP) is preselected so nobody is blocked; change it if it is not yours. Only IB Diploma has lessons today &mdash; the others are planned, and your choice helps us decide what to build next. You can change this later on your profile.
        </p>
      )}
    </fieldset>
  );
}
