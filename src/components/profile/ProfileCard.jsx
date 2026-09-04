import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Button from "../ui/Button.jsx";

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
// normal profile edit), only shown for context. `levelOptions` and
// `levelLabel` are the one real difference between the two roles' forms.
export default function ProfileCard({ role, levelLabel, levelOptions, showClassGrade }) {
  const { user, profile, upsertProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!profile) return null;

  function startEditing() {
    setForm(profile);
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await upsertProfile({
        role,
        full_name: form.full_name,
        school: form.school,
        country: form.country,
        curriculum: form.curriculum,
        level: form.level,
        grade_or_class: showClassGrade ? form.grade_or_class : null,
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
              ["School", profile.school || "\u2014"],
              ["Country", profile.country || "\u2014"],
              ["Curriculum", profile.curriculum],
              [levelLabel, profile.level || "\u2014"],
              ...(showClassGrade ? [["Class / Grade", profile.grade_or_class || "\u2014"]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-[var(--color-ink-faint)]">{label}</dt>
                <dd className="font-medium text-[var(--color-ink)]">{value}</dd>
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
          <div>
            <label className={labelClasses} htmlFor="pc-school">School</label>
            <input id="pc-school" className={inputClasses} value={form.school || ""} onChange={(e) => setForm({ ...form, school: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses} htmlFor="pc-country">Country</label>
            <input id="pc-country" className={inputClasses} value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          {showClassGrade && (
            <div>
              <label className={labelClasses} htmlFor="pc-grade">Class / Grade</label>
              <input id="pc-grade" className={inputClasses} value={form.grade_or_class || ""} onChange={(e) => setForm({ ...form, grade_or_class: e.target.value })} />
            </div>
          )}
          <div>
            <span className={labelClasses}>Curriculum</span>
            <p className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">IB Diploma Programme</p>
          </div>
          <div>
            <span className={labelClasses}>{levelLabel}</span>
            <div className="flex flex-wrap gap-2">
              {levelOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm({ ...form, level: opt })}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.level === opt
                      ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                      : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
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
