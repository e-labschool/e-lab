import { useState, useEffect } from "react";
import { X, Loader2, ShieldAlert } from "lucide-react";
import { getUserAccess, grantAccess, removeAccess } from "../../../lib/accessService.js";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";

const PLAN_TONE = { free: "neutral", premium: "indigo", school: "teal" };
const STATUS_TONE = { active: "teal", expired: "coral", scheduled: "amber" };

function toDateInputValue(iso) {
  return iso ? iso.slice(0, 10) : "";
}

export default function AccessDetailDrawer({ userId, onClose, onSaved }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState("free");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pendingAction, setPendingAction] = useState(null); // "grant" | "remove"

  useEffect(() => {
    getUserAccess(userId)
      .then((data) => {
        setRecord(data);
        setPlan(data?.plan ?? "free");
        setStartsAt(toDateInputValue(data?.starts_at));
        setExpiresAt(toDateInputValue(data?.expires_at));
      })
      .catch((err) => setError(err.message || "Couldn't load this user's access."))
      .finally(() => setLoading(false));
  }, [userId]);

  async function confirmGrant() {
    setSaving(true);
    setError(null);
    try {
      await grantAccess(userId, {
        plan,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      onSaved();
    } catch (err) {
      setError(err.message || "Something went wrong saving access.");
    } finally {
      setSaving(false);
      setPendingAction(null);
    }
  }

  async function confirmRemove() {
    setSaving(true);
    setError(null);
    try {
      await removeAccess(userId);
      onSaved();
    } catch (err) {
      setError(err.message || "Something went wrong removing access.");
    } finally {
      setSaving(false);
      setPendingAction(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--color-paper)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Manage Access</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-[var(--color-ink)]">{record?.full_name}</p>
                <p className="text-xs text-[var(--color-ink-faint)]">{record?.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={PLAN_TONE[record?.plan] ?? "neutral"}>{record?.plan ?? "free"}</Badge>
                  <Badge tone={STATUS_TONE[record?.access_status] ?? "teal"}>{record?.access_status ?? "active"}</Badge>
                  <Badge tone={record?.account_status === "suspended" ? "coral" : "teal"}>Account: {record?.account_status ?? "active"}</Badge>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--color-line)] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Grant / Change Plan</p>
                <div className="flex gap-1.5">
                  {["free", "premium", "school"].map((p) => (
                    <button
                      key={p} type="button" onClick={() => setPlan(p)}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${plan === p ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {plan !== "free" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="access-start">Start Date</label>
                      <input id="access-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1.5 text-sm text-[var(--color-ink)]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="access-expiry">Expiry Date</label>
                      <input id="access-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1.5 text-sm text-[var(--color-ink)]" />
                    </div>
                    <p className="col-span-2 text-[11px] text-[var(--color-ink-faint)]">Leave expiry empty for indefinite access (e.g. an ongoing school licence).</p>
                  </div>
                )}

                {error && <p role="alert" className="mt-3 text-xs text-[var(--color-coral)]">{error}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setPendingAction("grant")} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : plan === "free" ? "Set to Free" : "Save Access"}
                  </Button>
                  {record?.plan !== "free" && (
                    <Button size="sm" variant="danger" onClick={() => setPendingAction("remove")} disabled={saving}>
                      Remove Premium/School Access
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingAction(null)}>
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]"><ShieldAlert size={15} className="text-[var(--color-amber)]" />
              {pendingAction === "grant" ? `Change ${record?.full_name}'s plan to ${plan}?` : `Remove ${record?.full_name}'s premium/school access?`}
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
              {pendingAction === "grant" ? "This updates what content they're entitled to immediately." : "This reverts them to free access immediately."}
            </p>
            <div className="mt-4 flex gap-3">
              <Button variant="danger" onClick={pendingAction === "grant" ? confirmGrant : confirmRemove} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
              </Button>
              <Button variant="ghost" onClick={() => setPendingAction(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
