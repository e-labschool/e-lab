import { useEffect, useRef, useState } from "react";
import { MailCheck, Loader2 } from "lucide-react";
import Button from "../ui/Button.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { cooldownSecondsLeft, friendlyResendError } from "../../lib/signupFlow.js";

// Shown in place of the sign-in / create-account forms right after a sign-up
// that did NOT return a session (email confirmation required, or the neutral
// "already registered" response - both intentionally render identically so the
// screen never reveals whether an address already has an account).
export default function SignupConfirmation({ email, sentAt, onBackToLogin, onWrongEmail }) {
  const { resendConfirmation } = useAuth();
  const headingRef = useRef(null);
  const [lastSentAt, setLastSentAt] = useState(sentAt);
  const [, setTick] = useState(0);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { kind: "ok" | "error", text }

  // Move keyboard / screen-reader focus to the heading when the screen appears.
  useEffect(() => { headingRef.current?.focus(); }, []);

  // 1 Hz re-render while the cooldown is running; stops itself afterwards.
  const secondsLeft = cooldownSecondsLeft(lastSentAt);
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft > 0, lastSentAt]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResend() {
    if (sending || cooldownSecondsLeft(lastSentAt) > 0) return;
    setSending(true);
    setStatus(null);
    try {
      await resendConfirmation(email);
      setLastSentAt(Date.now());
      setStatus({ kind: "ok", text: "Another email is on its way. It can take a minute to arrive." });
    } catch (err) {
      const { rateLimited, message } = friendlyResendError(err);
      if (rateLimited) setLastSentAt(Date.now());
      setStatus({ kind: "error", text: message });
    } finally {
      setSending(false);
    }
  }

  const waiting = secondsLeft > 0;

  return (
    <div data-testid="signup-confirmation" className="flex flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" aria-hidden="true">
        <MailCheck size={24} />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)] outline-none"
      >
        Check your email
      </h1>
      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
        We've sent a confirmation email to
      </p>
      <p data-testid="confirmation-email" className="mt-1 max-w-full break-all rounded-md bg-[var(--color-paper)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)]">
        {email}
      </p>
      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
        Please confirm your email address, then log in.
      </p>

      <Button type="button" className="mt-6 w-full" onClick={onBackToLogin}>
        Back to login
      </Button>

      <Button
        type="button"
        variant="secondary"
        className={`mt-3 w-full ${waiting ? "cursor-not-allowed opacity-60" : ""}`}
        aria-disabled={waiting || sending}
        onClick={handleResend}
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {sending ? "Sending..." : waiting ? `Resend confirmation email (${secondsLeft}s)` : "Resend confirmation email"}
      </Button>

      <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs">
        {status && (
          <p role={status.kind === "error" ? "alert" : "status"} className={status.kind === "error" ? "text-[var(--color-coral)]" : "text-[var(--color-teal)]"}>
            {status.text}
          </p>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-faint)]">
        Can't see it? The email can take a minute to arrive - check your spam or junk folder too.
        Already have an account with this address? Just log in.
      </p>
      <button
        type="button"
        onClick={onWrongEmail}
        className="mt-3 text-xs text-[var(--color-ink-faint)] underline underline-offset-2 hover:text-[var(--color-ink)]"
      >
        Wrong email address? Start over
      </button>
    </div>
  );
}
