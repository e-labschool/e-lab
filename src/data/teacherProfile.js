// ---------------------------------------------------------------------------
// Teacher profile fields collected at TEACHER sign-up and shown / edited on the teacher profile page.
//
//   School name         REQUIRED, free text (trimmed, whitespace collapsed, SCHOOL_NAME_MIN..SCHOOL_NAME_MAX chars).
//                       Stored in the EXISTING `school` metadata key, which the existing profiles trigger already
//                       copies into profiles.school (same column the student form and the profile page use).
//   Professional field  REQUIRED dropdown, one entry of PROFESSIONAL_FIELDS below. "Other" reveals an OPTIONAL
//                       free-text description (PROFESSIONAL_OTHER_MAX chars).
//                       Stored ONLY in auth user_metadata (`professional_field` = stable id,
//                       `professional_field_other` = free text); there is no profiles column and no migration.
//
// THE LIST BELOW IS A PROPOSAL -- the owner has to confirm it. To change it, edit PROFESSIONAL_FIELDS only:
//   * `id` is what gets stored: keep it stable, lowercase-kebab; never reuse an id for a different meaning.
//   * `label` is what people read: free to reword. Order here = order in the dropdown (keep "other" last).
//   * Removing an entry is safe: accounts that stored it still show the stored id as plain text on their profile.
//
// UI / DISPLAY ONLY. user_metadata is editable by the signed-in user, so none of this may ever be used for access,
// roles, Premium or entitlement decisions (see docs/TEACHER_SIGNUP_FIELDS.md).
// ---------------------------------------------------------------------------

export const SCHOOL_NAME_MIN = 2;
export const SCHOOL_NAME_MAX = 120;
export const PROFESSIONAL_OTHER_MAX = 60;
export const OTHER_PROFESSIONAL_FIELD_ID = "other";

export const PROFESSIONAL_FIELDS = Object.freeze([
  Object.freeze({ id: "chemistry-teacher", label: "Chemistry teacher" }),
  Object.freeze({ id: "science-teacher", label: "Science teacher" }),
  Object.freeze({ id: "ib-dp-coordinator", label: "IB DP Coordinator" }),
  Object.freeze({ id: "head-of-department", label: "Head of Department / Faculty" }),
  Object.freeze({ id: "lab-technician", label: "Lab technician" }),
  Object.freeze({ id: "teaching-assistant", label: "Teaching assistant" }),
  Object.freeze({ id: "tutor", label: "Tutor / private educator" }),
  Object.freeze({ id: "student-teacher", label: "Student teacher / trainee" }),
  Object.freeze({ id: OTHER_PROFESSIONAL_FIELD_ID, label: "Other", allowsFreeText: true }),
]);

const BY_ID = new Map(PROFESSIONAL_FIELDS.map((f) => [f.id, f]));
export const getProfessionalField = (id) => BY_ID.get(id) ?? null;

export const MESSAGES = Object.freeze({
  schoolRequired: "Enter your school name.",
  schoolTooShort: `School name must be at least ${SCHOOL_NAME_MIN} characters.`,
  schoolTooLong: `School name must be ${SCHOOL_NAME_MAX} characters or fewer.`,
  fieldRequired: "Choose your professional field.",
});

const squash = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
export const cleanSchoolName = (text) => squash(text);
export const cleanProfessionalOther = (text) => squash(text).slice(0, PROFESSIONAL_OTHER_MAX);

/** -> { school?: message, professionalField?: message }; empty object = valid. Never throws. */
export function validateTeacherProfile({ school = "", professionalField = "" } = {}) {
  const errors = {};
  const name = cleanSchoolName(school);
  if (!name) errors.school = MESSAGES.schoolRequired;
  else if (name.length < SCHOOL_NAME_MIN) errors.school = MESSAGES.schoolTooShort;
  else if (name.length > SCHOOL_NAME_MAX) errors.school = MESSAGES.schoolTooLong;
  if (!BY_ID.has(professionalField)) errors.professionalField = MESSAGES.fieldRequired;
  return errors;
}

/**
 * Metadata for supabase.auth.signUp options.data (teacher only).
 *   school                   -> copied into profiles.school by the existing trigger
 *   professional_field       -> stable id (user_metadata only)
 *   professional_field_other -> only with "other" and a non-blank description
 */
export function buildTeacherProfileMetadata({ school, professionalField, other = "" }) {
  const meta = { school: cleanSchoolName(school), professional_field: professionalField };
  const text = professionalField === OTHER_PROFESSIONAL_FIELD_ID ? cleanProfessionalOther(other) : "";
  if (text) meta.professional_field_other = text;
  return meta;
}

/** Display text: "Chemistry teacher", "Other (Examiner)", or the raw stored value for an id no longer in the list. */
export function professionalFieldDisplay(id, other = "") {
  if (!id) return "";
  const f = BY_ID.get(id);
  if (!f) return String(id);
  const text = id === OTHER_PROFESSIONAL_FIELD_ID ? cleanProfessionalOther(other) : "";
  return text ? `${f.label} (${text})` : f.label;
}

/**
 * Read both fields back for display / editing.
 * School: profiles.school (what the profile page has always shown) first, then user_metadata.school.
 * Professional field: user_metadata only (no column). `fieldKnown` is false when the stored id is no longer in the list.
 */
export function readTeacherProfile({ userMetadata = null, profileSchool = "" } = {}) {
  const school = cleanSchoolName(profileSchool) || cleanSchoolName(userMetadata?.school);
  const stored = typeof userMetadata?.professional_field === "string" ? userMetadata.professional_field : "";
  const other = cleanProfessionalOther(userMetadata?.professional_field_other);
  return { school, fieldId: stored, fieldKnown: BY_ID.has(stored), other, display: professionalFieldDisplay(stored, other) };
}
