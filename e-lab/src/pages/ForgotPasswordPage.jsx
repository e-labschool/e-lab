import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Container from "../components/ui/Container.jsx";
import Wordmark from "../components/layout/Wordmark.jsx";
import Button from "../components/ui/Button.jsx";

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong sending the reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Wordmark />
          <h1 className="mt-5 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">We'll email you a link to reset it.</p>
        </div>

        {sent ? (
          <div className="mt-6 space-y-3 text-center text-sm text-[var(--color-ink-soft)]">
            <p role="status">
              If an account exists for <strong className="text-[var(--color-ink)]">{email}</strong>, a password reset link is on its way.
            </p>
            <Link to="/auth" className="inline-block text-xs font-medium text-[var(--color-indigo)] hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="forgot-email">
                Email <span className="text-[var(--color-coral)]">*</span>
              </label>
              <input
                id="forgot-email" type="email" required autoComplete="email"
                className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p role="alert" className="text-xs text-[var(--color-coral)]">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
            </Button>
            <Link to="/auth" className="block text-center text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </Container>
  );
}
