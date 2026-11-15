import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Button from "../ui/Button.jsx";
import CountrySelect from "../ui/CountrySelect.jsx";
import CurriculumField from "../auth/CurriculumField.jsx";
import CurriculumChips from "./CurriculumChips.jsx";
import TeacherProfileFields from "../auth/TeacherProfileFields.jsx";
import { buildTeacherProfileMetadata, cleanSchoolName, readTeacherProfile, validateTeacherProfile } from "../../data/teacherProfile.js";
import { DEFAULT_CURRICULUM_ID, buildCurriculumMetadata, curriculaForRole, readCurricula } from "../../data/curricula.js";

function initialsFor(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }
  return (email?.[0] ?? "?").toUpperCase();
}

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";
const labelClasses = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

// One reusable profile view/edit card for both roles — role itself is
// never an editable field here (per the brief, role changes aren't a
// normal profile edit), only shown for context. Both roles now show the
// same Country/Class fields. Student profiles also show and can change
// their saved SL/HL course level. Changing level never deletes progress;
// it only changes which course content is visible to that student.
export default function ProfileCard({ role }) {
  const { user, profile, upsertProfile, updateUserMetadata } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [curricula, setCurricula] = useState([DEFAULT_CURRICULUM_ID]);
  const [curriculumOther, setCurriculumOther] = useState("");
  // Teacher-only fields: school name (profiles.school) + professional field (user_metadata only).
  const [profField, setProfField] = useState("");
  const [profOther, setProfOther] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  if (!profile) return null;

  // Chosen curricula: user_metadata.curricula (set at sign-up / saved here), else parsed from profiles.curriculum.
  const chosen = readCurricula({ userMetadata: user?.user_metadata, profileCurriculum: profile.curriculum });

  // Teacher fields as stored: school from profiles.school (fallback user_metadata.school), professional field from user_metadata.
  const teacherInfo = role === "teacher" ? readTeacherProfile({ userMetadata: user?.user_metadata, profileSchool: profile.school }) : null;

  function startEditing() {
    if (teacherInfo) { setProfField(teacherInfo.fieldKnown ? teacherInfo.fieldId : ""); setProfOther(teacherInfo.other); setFieldErrors({}); }
    setCurricula(chosen.ids.length ? chosen.ids : [DEFAULT_CURRICULUM_ID]);
    setCurriculumOther(chosen.other);
    setForm(profile);
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();

    if (role === "student" && profile.level && form.level !== profile.level) {
      const confirmed = window.confirm(
        `Change your course level from ${profile.level} to ${form.level}? Your existing progress will be kept, but the content available to you will change.`
      );
      if (!confirmed) return;
    }

    if (role === "teacher") {
      const errs = validateTeacherProfile({ school: form.school, professionalField: profField });
      setFieldErrors(errs);
      const bad = errs.school ? "pc-school" : errs.professionalField ? "pc-prof-field" : null;
      if (bad) { document.getElementById(bad)?.focus(); return; }
    }

    setSaving(true);
    setError(null);
    try {
      // Curriculum: the stable ids + optional "Other" name go to auth user_metadata (no migration needed); the readable
      // text goes to the existing profiles.curriculum column (already self-editable), so both stay in step.
      const cm = buildCurriculumMetadata(role, curricula, curriculumOther);
      const unchanged = JSON.stringify(curriculaForRole(role, chosen.ids)) === JSON.stringify(cm.curricula) && chosen.other === (cm.curriculum_other ?? "");
      const metaUpdate = {};
      if (!unchanged || !user?.user_metadata?.curricula) {
        metaUpdate.curricula = cm.curricula;
        metaUpdate.curriculum_other = cm.curriculum_other ?? "";
      }
      if (role === "teacher") {
        const t = buildTeacherProfileMetadata({ school: form.school, professionalField: profField, other: profOther });
        const otherText = t.professional_field_other ?? "";
        if (t.professional_field !== teacherInfo.fieldId || otherText !== teacherInfo.other) {
          metaUpdate.professional_field = t.professional_field;
          metaUpdate.professional_field_other = otherText;
        }
      }
      if (Object.keys(metaUpdate).length) await updateUserMetadata(metaUpdate);
      await upsertProfile({
        role,
        full_name: form.full_name,
        school: role === "teacher" ? cleanSchoolName(form.school) : form.school,
        country: form.country,
        curriculum: cm.curriculum,
        grade_or_class: form.grade_or_class,
        ...(role === "student" ? { level: form.level } : {}),
      });
      setEditing(false);
    } catch (err) {
      setError(err.message || "Something went wrong saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-indigo)] text-lg font-semibold text-white">
          {initialsFor(profile.full_name, user?.email)}
        </div>
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{profile.full_name}</h1>
          <p className="text-sm capitalize text-[var(--color-ink-faint)]">{profile.role}</p>
        </div>
      </div>

      {!editing ? (
        <div className="mt-8 space-y-4">
          <dl className="divide-y divide-[var(--color-line)] rounded-lg border border-[var(--color-line)]">
            {[
              ["Email", user?.email],
              ["School", (role === "teacher" ? teacherInfo.school : profile.school) || "\u2014"],
              ...(role === "teacher" ? [["Professional field", teacherInfo.display || <span key="pf" className="text-[var(--color-ink-faint)]">Not provided yet</span>]] : []),
              ["Country", profile.country || "\u2014"],
              ["Curriculum", <CurriculumChips key="cur" ids={chosen.ids} other={chosen.other} legacyText={chosen.legacyText} />],
              ...(role === "student" ? [["Level", profile.level === "HL" ? "Higher Level (HL)" : profile.level === "SL" ? "Standard Level (SL)" : "Not selected"]] : []),
              ["Class", profile.grade_or_class || "\u2014"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <dt className="shrink-0 text-[var(--color-ink-faint)]">{label}</dt>
                <dd className="min-w-0 break-words text-right font-medium text-[var(--color-ink)]">{value}</dd>
              </div>
            ))}
          </dl>
          <Button variant="secondary" onClick={startEditing}>Edit Profile</Button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-8 space-y-4">
          <div>
            <label className={labelClasses} htmlFor="pc-name">Full Name</label>
            <input id="pc-name" required className={inputClasses} value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <p className="text-xs text-[var(--color-ink-faint)]">
            Email: {user?.email} — changing your email uses Supabase's own verification flow, not this form.
          </p>
          {role === "teacher" ? (
            <TeacherProfileFields
              idPrefix="pc" school={form.school || ""} professionalField={profField} other={profOther} errors={fieldErrors}
              labelClass={labelClasses} inputPad="px-3 py-2"
              onSchoolChange={(v) => { setForm({ ...form, school: v }); setFieldErrors((e) => ({ ...e, school: undefined })); }}
              onProfessionalFieldChange={(v) => { setProfField(v); setFieldErrors((e) => ({ ...e, professionalField: undefined })); }}
              onOtherChange={setProfOther}
            />
          ) : (
          <div>
            <label className={labelClasses} htmlFor="pc-school">School</label>
            <input id="pc-school" className={inputClasses} value={form.school || ""} onChange={(e) => setForm({ ...form, school: e.target.value })} />
          </div>
          )}
          <div>
            <label className={labelClasses} htmlFor="pc-country">Country</label>
            <CountrySelect id="pc-country" value={form.country || ""} onChange={(v) => setForm({ ...form, country: v })} />
          </div>
          <div>
            <label className={labelClasses} htmlFor="pc-grade">Class</label>
            <select id="pc-grade" className={inputClasses} value={form.grade_or_class || ""} onChange={(e) => setForm({ ...form, grade_or_class: e.target.value })}>
              <option value="">Select class</option>
              <option value="DP1">DP1</option>
              <option value="DP2">DP2</option>
            </select>
          </div>
          <CurriculumField role={role} idPrefix="pc-curriculum" value={curricula} other={curriculumOther} onChange={setCurricula} onOtherChange={setCurriculumOther} showHelp={false} />
          {role === "student" && (
            <div>
              <label className={labelClasses} htmlFor="pc-level">Course Level</label>
              <select
                id="pc-level"
                required
                className={inputClasses}
                value={form.level || ""}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              >
                <option value="">Select level</option>
                <option value="SL">Standard Level (SL)</option>
                <option value="HL">Higher Level (HL)</option>
              </select>
              <p className="mt-1.5 text-[11px] leading-4 text-[var(--color-ink-faint)]">
                HL includes all shared SL content plus HL-only material. Changing your level changes what you can access, but your existing progress is kept.
              </p>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-[var(--color-coral)]">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
