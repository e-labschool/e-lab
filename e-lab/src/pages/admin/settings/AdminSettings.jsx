import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, ShieldAlert, Info } from "lucide-react";
import { getSettingsForAdmin, updateSettings } from "../../../lib/settingsService.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import Button from "../../../components/ui/Button.jsx";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "registration", label: "Registration" },
  { id: "resources", label: "Resources" },
  { id: "maintenance", label: "Maintenance" },
];

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";
const labelClasses = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">{label}</p>
        {description && <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--color-indigo)]" : "bg-[var(--color-line)]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

export default function AdminSettings() {
  const { isConfigured } = useAuth();
  const [section, setSection] = useState("general");
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [pendingMaintenanceOn, setPendingMaintenanceOn] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    getSettingsForAdmin()
      .then(setForm)
      .catch((err) => setError(err.message || "Couldn't load platform settings. Has admin-settings-migration.sql been run yet?"))
      .finally(() => setLoading(false));
  }, [isConfigured]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleMaintenanceToggle(next) {
    if (next) {
      setPendingMaintenanceOn(true); // confirm before turning ON
    } else {
      set("maintenance_mode", false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateSettings(form);
      setForm(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Something went wrong saving settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!isConfigured) {
    return <p className="p-10 text-sm text-[var(--color-ink-soft)]">Settings require Supabase to be connected.</p>;
  }
  if (loading) {
    return <div className="flex justify-center p-16"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>;
  }
  if (!form) {
    return <p className="p-10 text-sm text-[var(--color-coral)]">{error ?? "Settings couldn't be loaded."}</p>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Settings</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Manage e-Lab platform configuration.</p>

      <div className="mt-8 flex flex-col gap-8 md:flex-row">
        {/* Desktop left nav */}
        <nav className="hidden shrink-0 md:block md:w-40">
          <div className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id} type="button" onClick={() => setSection(s.id)}
                className={`rounded-md px-3 py-2 text-left text-sm ${section === s.id ? "bg-[var(--color-ink)] font-medium text-[var(--color-paper)]" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile select */}
        <select
          value={section} onChange={(e) => setSection(e.target.value)}
          className={`${inputClasses} md:hidden`}
          aria-label="Settings section"
        >
          {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <div className="min-w-0 flex-1 space-y-5">
          {section === "general" && (
            <>
              <div>
                <label className={labelClasses} htmlFor="s-name">Platform Name</label>
                <input id="s-name" className={inputClasses} value={form.platform_name} onChange={(e) => set("platform_name", e.target.value)} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="s-tagline">Tagline</label>
                <input id="s-tagline" className={inputClasses} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="s-support">Support Email</label>
                <input id="s-support" type="email" className={inputClasses} value={form.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="s-contact">Contact Email</label>
                <input id="s-contact" type="email" className={inputClasses} value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} />
              </div>
              <p className="flex items-start gap-1.5 rounded-md bg-[var(--color-line)]/20 px-3 py-2 text-xs text-[var(--color-ink-faint)]">
                <Info size={13} className="mt-0.5 shrink-0" />
                Authentication email configuration is managed securely through the authentication provider, not here.
              </p>
            </>
          )}

          {section === "registration" && (
            <div className="divide-y divide-[var(--color-line)]">
              <Toggle
                checked={form.allow_student_registration}
                onChange={(v) => set("allow_student_registration", v)}
                label="Allow Student Registration"
                description="Existing student accounts are never affected by this — it only controls new sign-ups."
              />
              <Toggle
                checked={form.allow_teacher_registration}
                onChange={(v) => set("allow_teacher_registration", v)}
                label="Allow Teacher Registration"
                description="Existing teacher accounts are never affected by this — it only controls new sign-ups."
              />
            </div>
          )}

          {section === "resources" && (
            <>
              <div>
                <label className={labelClasses} htmlFor="s-curriculum">Default Curriculum</label>
                <input id="s-curriculum" className={inputClasses} value={form.default_curriculum} onChange={(e) => set("default_curriculum", e.target.value)} />
              </div>
              <div>
                <span className={labelClasses}>Default Resource Access</span>
                <div className="flex gap-1.5">
                  {["free", "premium"].map((v) => (
                    <button
                      key={v} type="button" onClick={() => set("default_resource_access", v)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${form.default_resource_access === v ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-[var(--color-ink-faint)]">These only set the defaults new resources start with in Admin → Resources → Add Resource — existing resources are never changed.</p>
            </>
          )}

          {section === "maintenance" && (
            <>
              <Toggle
                checked={form.maintenance_mode}
                onChange={handleMaintenanceToggle}
                label="Maintenance Mode"
                description="Student and Teacher areas show the maintenance screen below instead of the app. Admin always stays accessible."
              />
              <div>
                <label className={labelClasses} htmlFor="s-maint-message">Maintenance Message</label>
                <textarea id="s-maint-message" rows={3} className={inputClasses} value={form.maintenance_message} onChange={(e) => set("maintenance_message", e.target.value)} />
              </div>
            </>
          )}

          {error && <p role="alert" className="text-xs text-[var(--color-coral)]">{error}</p>}
          <div className="flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
            {saved && <span className="flex items-center gap-1 text-xs text-[var(--color-teal)]"><CheckCircle2 size={13} /> Saved</span>}
          </div>
        </div>
      </div>

      {pendingMaintenanceOn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingMaintenanceOn(false)}>
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]"><ShieldAlert size={15} className="text-[var(--color-amber)]" /> Turn Maintenance Mode ON?</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
              Every Student and Teacher will immediately see the maintenance screen instead of the app. You (as Admin) will still have full access. Remember to save changes for this to take effect.
            </p>
            <div className="mt-4 flex gap-3">
              <Button variant="danger" onClick={() => { set("maintenance_mode", true); setPendingMaintenanceOn(false); }}>Turn On</Button>
              <Button variant="ghost" onClick={() => setPendingMaintenanceOn(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
