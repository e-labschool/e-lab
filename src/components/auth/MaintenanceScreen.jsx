import Wordmark from "../layout/Wordmark.jsx";

// Shown in place of Student/Teacher protected content when maintenance
// mode is on — never shown to Admin (ProtectedRoute skips this check
// entirely for role="admin", so the admin console always stays reachable
// to actually turn maintenance mode back off).
export default function MaintenanceScreen({ message }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Wordmark />
      <p className="mt-2 font-[var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">
        We'll be back shortly.
      </p>
      <p className="max-w-sm text-sm text-[var(--color-ink-soft)]">{message}</p>
    </div>
  );
}
