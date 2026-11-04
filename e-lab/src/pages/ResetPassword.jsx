import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Container from "../components/ui/Container.jsx";
import Button from "../components/ui/Button.jsx";

// Landed on via the link in the "reset password" email (see
// AuthContext.sendPasswordReset's redirectTo). Supabase puts the user into
// a temporary authenticated session for this page only, from which
// updateUser({ password }) is allowed.
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err.message || "Something went wrong updating your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="max-w-sm py-24">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
        Set a new password
      </h1>
      {done ? (
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">Password updated — redirecting you home…</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="new-password">New password</label>
            <input
              id="new-password" type="password" required minLength={8} autoComplete="new-password"
              className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password" type="password" required autoComplete="new-password"
              className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-[var(--color-coral)]">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
      )}
    </Container>
  );
}
