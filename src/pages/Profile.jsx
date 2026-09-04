import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Container from "../components/ui/Container.jsx";
import Button from "../components/ui/Button.jsx";

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

export default function Profile() {
  const { isConfigured, user, profile, loadingSession, loadingProfile, upsertProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function startEditing() {
    setForm(profile);
    setEditing(true);
  }

  if (!isConfigured) {
    return (
      <Container className="max-w-lg py-16 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Profiles aren't available yet — e-Lab isn't connected to an authentication service.
        </p>
      </Container>
    );
  }

  if (loadingSession) {
    return (
      <Container className="flex justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" />
      </Container>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (loadingProfile || !profile) {
    return (
      <Container className="flex justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" />
      </Container>
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await upsertProfile({
        role: form.role,
        full_name: form.full_name,
        school: form.school,
        country: form.country,
        programme: form.programme,
        level: form.level,
        class_grade: form.class_grade,
      });
      setEditing(false);
    } catch (err) {
      setError(err.message || "Something went wrong saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  const levelOptions = form.role === "teacher" ? ["SL", "HL", "Both"] : ["SL", "HL"];

  return (
    <Container className="max-w-lg py-14">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-indigo)] text-lg font-semibold text-white">
          {initialsFor(profile.full_name, user.email)}
        </div>
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            {profile.full_name}
          </h1>
          <p className="text-sm capitalize text-[var(--color-ink-faint)]">{profile.role} · {user.email}</p>
        </div>
      </div>

      {!editing ? (
        <div className="mt-8 space-y-4">
          <dl className="divide-y divide-[var(--color-line)] rounded-lg border border-[var(--color-line)]">
            {[
              ["School", profile.school || "—"],
              ["Country", profile.country || "—"],
              ["Programme", profile.programme],
              [profile.role === "teacher" ? "Level taught" : "Level", profile.level || "—"],
              ...(profile.role === "student" ? [["Class / grade", profile.class_grade || "—"]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-[var(--color-ink-faint)]">{label}</dt>
                <dd className="font-medium text-[var(--color-ink)]">{value}</dd>
              </div>
            ))}
          </dl>
          <Button variant="secondary" onClick={startEditing}>Edit profile</Button>
          <p className="text-xs text-[var(--color-ink-faint)]">
            To change your email address, use the email field in your account settings — it follows Supabase's verification rules rather than updating instantly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-8 space-y-4">
          <div>
            <label className={labelClasses} htmlFor="edit-name">Full name</label>
            <input id="edit-name" required className={inputClasses} value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses} htmlFor="edit-school">School</label>
            <input id="edit-school" className={inputClasses} value={form.school || ""} onChange={(e) => setForm({ ...form, school: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses} htmlFor="edit-country">Country</label>
            <input id="edit-country" className={inputClasses} value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div>
            <span className={labelClasses}>{form.role === "teacher" ? "Level taught" : "Level"}</span>
            <div className="flex gap-2">
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
          {form.role === "student" && (
            <div>
              <label className={labelClasses} htmlFor="edit-grade">Class / grade</label>
              <input id="edit-grade" className={inputClasses} value={form.class_grade || ""} onChange={(e) => setForm({ ...form, class_grade: e.target.value })} />
            </div>
          )}
          {error && <p className="text-xs text-[var(--color-coral)]">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
            <Button type="button" variant="ghost" onClick={() => { setForm(profile); setEditing(false); }}>Cancel</Button>
          </div>
        </form>
      )}
    </Container>
  );
}
