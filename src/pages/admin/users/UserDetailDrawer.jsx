import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Loader2, ShieldAlert, Lock, Sparkles, ArrowRight } from "lucide-react";
import { updateUserProfile, setUserStatus } from "../../../lib/userService.js";
import { getUserAccess } from "../../../lib/accessService.js";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";
const labelClasses = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

export default function UserDetailDrawer({ targetUser, currentUserId, onClose, onSaved }) {
  const isSelf = targetUser.id === currentUserId;
  const isTargetAdmin = targetUser.role === "admin";
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(targetUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pendingSuspend, setPendingSuspend] = useState(false);
  const [access, setAccess] = useState(null);

  useEffect(() => {
    if (isTargetAdmin) return; // admins don't depend on plan/access at all
    getUserAccess(targetUser.id).then(setAccess).catch(() => setAccess(null));
  }, [targetUser.id, isTargetAdmin]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateUserProfile(targetUser.id, {
        full_name: form.full_name,
        school: form.school,
        country: form.country,
        grade_or_class: form.grade_or_class,
        curriculum: form.curriculum,
        level: form.level,
        // Role is only ever sent as student/teacher — never admin, and
        // never at all when the target is already an admin (the field is
        // simply not rendered in that case, see below).
        ...(isTargetAdmin ? {} : { role: form.role }),
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Something went wrong saving this user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSuspendToggle() {
    setSaving(true);
    setError(null);
    try {
      const nextStatus = targetUser.status === "suspended" ? "active" : "suspended";
      const updated = await setUserStatus(targetUser.id, nextStatus);
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Something went wrong updating this account's status.");
    } finally {
      setSaving(false);
      setPendingSuspend(false);
    }
  }

  const isSuspended = targetUser.status === "suspended";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--color-paper)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--color-ink)]">{editing ? "Edit User" : "User Details"}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!editing ? (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-[var(--color-ink)]">{targetUser.full_name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone={targetUser.role === "admin" ? "neutral" : targetUser.role === "teacher" ? "amber" : "indigo"}>{targetUser.role}</Badge>
                  <Badge tone={isSuspended ? "coral" : "teal"}>{targetUser.status ?? "active"}</Badge>
                </div>
              </div>

              <dl className="divide-y divide-[var(--color-line)] rounded-lg border border-[var(--color-line)]">
                {[
                  ["Email", targetUser.email],
                  ["School", targetUser.school || "\u2014"],
                  ["Country", targetUser.country || "\u2014"],
                  ["Grade / Class", targetUser.grade_or_class || "\u2014"],
                  ["Curriculum", targetUser.curriculum || "\u2014"],
                  ["Level", targetUser.level || "\u2014"],
                  ["Joined", targetUser.created_at ? new Date(targetUser.created_at).toLocaleDateString() : "\u2014"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <dt className="text-[var(--color-ink-faint)]">{label}</dt>
                    <dd className="font-medium text-[var(--color-ink)]">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* Reads from the SAME user_access_overview source Admin ->
                  Access uses — no second, independent access system. */}
              {!isTargetAdmin && (
                <div className="rounded-lg border border-[var(--color-line)] p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
                    <Sparkles size={12} /> Plan &amp; Access
                  </p>
                  {access ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={access.plan === "premium" ? "indigo" : access.plan === "school" ? "teal" : "neutral"}>{access.plan}</Badge>
                      <Badge tone={access.access_status === "expired" ? "coral" : access.access_status === "scheduled" ? "amber" : "teal"}>{access.access_status}</Badge>
                      {access.expires_at && <span className="text-xs text-[var(--color-ink-faint)]">expires {new Date(access.expires_at).toLocaleDateString()}</span>}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">Free (no entitlement record yet).</p>
                  )}
                  <Link
                    to={`/admin/access?user=${targetUser.id}`}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-indigo)] hover:underline"
                  >
                    Manage Access <ArrowRight size={12} />
                  </Link>
                </div>
              )}

              {isTargetAdmin && (
                <p className="flex items-start gap-1.5 rounded-md bg-[var(--color-line)]/20 px-3 py-2 text-xs text-[var(--color-ink-faint)]">
                  <Lock size={13} className="mt-0.5 shrink-0" /> Admin accounts can't be edited or suspended from this screen — admin assignment is a backend-only operation.
                </p>
              )}
              {isSelf && !isTargetAdmin && (
                <p className="flex items-start gap-1.5 rounded-md bg-[var(--color-line)]/20 px-3 py-2 text-xs text-[var(--color-ink-faint)]">
                  <ShieldAlert size={13} className="mt-0.5 shrink-0" /> You're viewing your own account — role and suspension changes are disabled here to prevent accidentally locking yourself out.
                </p>
              )}

              {error && <p role="alert" className="text-xs text-[var(--color-coral)]">{error}</p>}

              {!isTargetAdmin && (
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => { setForm(targetUser); setEditing(true); }} disabled={isSelf}>Edit User</Button>
                  {isSuspended ? (
                    <Button onClick={handleSuspendToggle} disabled={isSelf || saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reactivate User"}
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={() => setPendingSuspend(true)} disabled={isSelf}>Suspend User</Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className={labelClasses} htmlFor="ud-name">Full Name</label>
                <input id="ud-name" required className={inputClasses} value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="ud-school">School</label>
                <input id="ud-school" className={inputClasses} value={form.school || ""} onChange={(e) => set("school", e.target.value)} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="ud-country">Country</label>
                <input id="ud-country" className={inputClasses} value={form.country || ""} onChange={(e) => set("country", e.target.value)} />
              </div>
              {form.role === "student" && (
                <div>
                  <label className={labelClasses} htmlFor="ud-grade">Grade / Class</label>
                  <input id="ud-grade" className={inputClasses} value={form.grade_or_class || ""} onChange={(e) => set("grade_or_class", e.target.value)} />
                </div>
              )}
              <div>
                <span className={labelClasses}>Level</span>
                <div className="flex flex-wrap gap-1.5">
                  {(form.role === "teacher" ? ["SL", "HL", "SL & HL"] : ["SL", "HL"]).map((opt) => (
                    <button
                      key={opt} type="button" onClick={() => set("level", opt)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${form.level === opt ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className={labelClasses}>Role</span>
                {isSelf ? (
                  <p className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-xs text-[var(--color-ink-faint)]">
                    You can't change your own role here.
                  </p>
                ) : (
                  <div className="flex gap-1.5">
                    {["student", "teacher"].map((r) => (
                      <button
                        key={r} type="button" onClick={() => set("role", r)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${form.role === r ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Admin accounts can only be assigned directly in Supabase, never from this form.</p>
              </div>

              {error && <p role="alert" className="text-xs text-[var(--color-coral)]">{error}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {pendingSuspend && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingSuspend(false)}>
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[var(--color-ink)]">Suspend {targetUser.full_name}?</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">They'll be signed out immediately and won't be able to access their account until reactivated.</p>
            <div className="mt-4 flex gap-3">
              <Button variant="danger" onClick={handleSuspendToggle} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suspend"}
              </Button>
              <Button variant="ghost" onClick={() => setPendingSuspend(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
