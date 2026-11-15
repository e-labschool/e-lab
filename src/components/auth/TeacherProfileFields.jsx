import { PROFESSIONAL_FIELDS, OTHER_PROFESSIONAL_FIELD_ID, SCHOOL_NAME_MAX, PROFESSIONAL_OTHER_MAX } from "../../data/teacherProfile.js";

const baseInput =
  "w-full rounded-md border bg-[var(--color-paper)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";

/**
 * Teacher-only fields shared by the sign-up form and the profile editor: School name (required text) and
 * Professional field (required dropdown, optional free text for "Other"). Controlled; ids are `${idPrefix}-school`,
 * `${idPrefix}-prof-field`, `${idPrefix}-prof-other`. `errors` = { school?, professionalField? } messages, linked to
 * their inputs with aria-describedby / aria-invalid. Display/preference data only -- never used for access.
 */
export default function TeacherProfileFields({
  idPrefix, school, professionalField, other = "", errors = {},
  onSchoolChange, onProfessionalFieldChange, onOtherChange,
  labelClass = "mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]", inputPad = "px-3 py-2.5",
}) {
  const schoolId = `${idPrefix}-school`, fieldId = `${idPrefix}-prof-field`, otherId = `${idPrefix}-prof-other`;
  const cls = (bad) => `${baseInput} ${inputPad} ${bad ? "border-[var(--color-coral)]" : "border-[var(--color-line)]"}`;
  const star = (<><span className="text-[var(--color-coral)]" aria-hidden="true">*</span><span className="sr-only"> (required)</span></>);
  const err = (id, msg) => msg ? <p id={id} data-testid={id} className="mt-1 text-xs font-medium text-[#A5362A] dark:text-[var(--color-coral)]">{msg}</p> : null;
  return (
    <div data-testid="teacher-profile-fields" className="space-y-3">
      <div>
        <label className={labelClass} htmlFor={schoolId}>School name {star}</label>
        <input
          id={schoolId} name="school" autoComplete="organization" maxLength={SCHOOL_NAME_MAX} aria-required="true"
          aria-invalid={errors.school ? "true" : undefined} aria-describedby={errors.school ? `${schoolId}-error` : undefined}
          className={cls(errors.school)} value={school} onChange={(e) => onSchoolChange(e.target.value)}
        />
        {err(`${schoolId}-error`, errors.school)}
      </div>
      <div>
        <label className={labelClass} htmlFor={fieldId}>Professional field {star}</label>
        <select
          id={fieldId} aria-required="true"
          aria-invalid={errors.professionalField ? "true" : undefined} aria-describedby={errors.professionalField ? `${fieldId}-error` : undefined}
          className={cls(errors.professionalField)} value={professionalField} onChange={(e) => onProfessionalFieldChange(e.target.value)}
        >
          <option value="">Select your role</option>
          {PROFESSIONAL_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        {err(`${fieldId}-error`, errors.professionalField)}
      </div>
      {professionalField === OTHER_PROFESSIONAL_FIELD_ID && (
        <div>
          <label className={labelClass} htmlFor={otherId}>Describe your role <span className="font-normal text-[var(--color-ink-faint)]">(optional)</span></label>
          <input id={otherId} maxLength={PROFESSIONAL_OTHER_MAX} className={cls(false)} value={other} onChange={(e) => onOtherChange(e.target.value)} placeholder="e.g. Examiner, Curriculum developer" />
        </div>
      )}
    </div>
  );
}
