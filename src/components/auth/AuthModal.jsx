import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import Button from "../ui/Button.jsx";

const COUNTRIES_PLACEHOLDER = "e.g. Singapore, United Kingdom, Kenya…";

// One modal, several internal views, rather than separate routed pages —
// keeps auth "minimal" per the brief (it should not dominate the site) and
// avoids adding five new top-level routes for what is fundamentally one
// flow. `initialView` lets the header open straight into sign-in or
// create-account.
export default function AuthModal({ initialView = "sign-in", onClose }) {
  const [view, setView] = useState(initialView);
  const [pendingRole, setPendingRole] = useState(null);

  function handleSwitch(next) {
    if (typeof next === "object") {
      setPendingRole(next.role);
      setView(next.view);
    } else {
      setView(next);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
            {view === "sign-in" && "Sign in"}
            {view === "forgot-password" && "Reset password"}
            {view.startsWith("sign-up") && "Create account"}
            {view === "check-email" && "Check your email"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40 hover:text-[var(--color-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {view === "sign-in" && <SignInView onSwitch={handleSwitch} onClose={onClose} />}
        {view === "forgot-password" && <ForgotPasswordView onSwitch={handleSwitch} />}
        {view === "sign-up-account" && <SignUpAccountView onSwitch={handleSwitch} />}
        {view === "sign-up-role" && <SignUpRoleView onSwitch={handleSwitch} />}
        {view === "sign-up-profile" && <SignUpProfileView onClose={onClose} role={pendingRole} />}
        {view === "check-email" && <CheckEmailView onSwitch={handleSwitch} />}
      </div>
    </div>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-[var(--color-coral)]">{children}</p>;
}

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";
const labelClasses = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

function SignInView({ onSwitch, onClose }) {
  const { signIn, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ email, password });
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong signing in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!isConfigured && (
        <p className="rounded-md bg-[var(--color-amber-soft)] px-3 py-2 text-xs text-[var(--color-amber)]">
          e-Lab isn't connected to an authentication service yet — this form is ready but sign-in won't complete until Supabase is configured.
        </p>
      )}
      <div>
        <label className={labelClasses} htmlFor="signin-email">Email</label>
        <input id="signin-email" type="email" required autoComplete="email" className={inputClasses} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={labelClasses} htmlFor="signin-password">Password</label>
        <input id="signin-password" type="password" required autoComplete="current-password" className={inputClasses} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
      <div className="flex items-center justify-between pt-1 text-xs">
        <button type="button" onClick={() => onSwitch("forgot-password")} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
          Forgot password?
        </button>
        <button type="button" onClick={() => onSwitch("sign-up-account")} className="font-medium text-[var(--color-indigo)] hover:underline">
          Create account
        </button>
      </div>
    </form>
  );
}

function ForgotPasswordView({ onSwitch }) {
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

  if (sent) {
    return (
      <div className="space-y-3 text-sm text-[var(--color-ink-soft)]">
        <p>If an account exists for <strong className="text-[var(--color-ink)]">{email}</strong>, a password reset link is on its way.</p>
        <button type="button" onClick={() => onSwitch("sign-in")} className="text-xs font-medium text-[var(--color-indigo)] hover:underline">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-[var(--color-ink-soft)]">We'll email you a link to reset your password.</p>
      <div>
        <label className={labelClasses} htmlFor="forgot-email">Email</label>
        <input id="forgot-email" type="email" required autoComplete="email" className={inputClasses} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
      </Button>
      <button type="button" onClick={() => onSwitch("sign-in")} className="text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        Back to sign in
      </button>
    </form>
  );
}

// --- Sign-up step 1: email + password ---
function SignUpAccountView({ onSwitch }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
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
      await signUp({ email, password });
      // Email confirmation is required before there's a session to attach a
      // profile to (see AuthContext / Supabase project auth settings), so
      // step 2 (role) and step 3 (profile) run on first sign-in after the
      // user verifies their email, not here.
      onSwitch("check-email");
    } catch (err) {
      setError(err.message || "Something went wrong creating your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <StepIndicator step={1} />
      <div>
        <label className={labelClasses} htmlFor="signup-email">Email</label>
        <input id="signup-email" type="email" required autoComplete="email" className={inputClasses} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={labelClasses} htmlFor="signup-password">Password</label>
        <input id="signup-password" type="password" required autoComplete="new-password" minLength={8} className={inputClasses} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className={labelClasses} htmlFor="signup-confirm">Confirm password</label>
        <input id="signup-confirm" type="password" required autoComplete="new-password" className={inputClasses} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
      </Button>
      <button type="button" onClick={() => onSwitch("sign-in")} className="text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        Already have an account? Sign in
      </button>
    </form>
  );
}

function CheckEmailView({ onSwitch }) {
  return (
    <div className="space-y-3 text-sm text-[var(--color-ink-soft)]">
      <p>We've sent you a verification link. Confirm your email, then sign in to finish setting up your profile.</p>
      <Button className="w-full" onClick={() => onSwitch("sign-in")}>Back to sign in</Button>
    </div>
  );
}

function StepIndicator({ step }) {
  return (
    <div className="mb-1 flex gap-1.5">
      {[1, 2, 3].map((n) => (
        <div key={n} className={`h-1 flex-1 rounded-full ${n <= step ? "bg-[var(--color-indigo)]" : "bg-[var(--color-line)]"}`} />
      ))}
    </div>
  );
}

// Step 2 (role) and Step 3 (profile) run once a verified, signed-in user
// has no profile row yet — RequireProfileSetup (see ProfileGate.jsx) routes
// them here automatically rather than this view being reachable mid
// sign-up before email verification.
function SignUpRoleView({ onSwitch }) {
  const [role, setRole] = useState(null);
  return (
    <div className="space-y-3">
      <StepIndicator step={2} />
      <p className="text-sm text-[var(--color-ink-soft)]">I am a:</p>
      <div className="grid grid-cols-2 gap-3">
        {["student", "teacher"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-md border px-4 py-6 text-sm font-medium capitalize transition-colors ${
              role === r
                ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <Button className="w-full" disabled={!role} onClick={() => onSwitch({ view: "sign-up-profile", role })}>
        Continue
      </Button>
    </div>
  );
}

function SignUpProfileView({ onClose, role: roleProp }) {
  const { upsertProfile } = useAuth();
  const role = roleProp || "student";
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState("");
  const [classGrade, setClassGrade] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const levelOptions = role === "teacher" ? ["SL", "HL", "Both"] : ["SL", "HL"];

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await upsertProfile({
        role,
        full_name: fullName,
        school,
        country,
        programme: "IB Diploma Programme",
        level,
        class_grade: role === "student" ? classGrade : null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong saving your profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <StepIndicator step={3} />
      <div>
        <label className={labelClasses} htmlFor="profile-name">Full name</label>
        <input id="profile-name" required className={inputClasses} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <label className={labelClasses} htmlFor="profile-school">School</label>
        <input id="profile-school" className={inputClasses} value={school} onChange={(e) => setSchool(e.target.value)} />
      </div>
      <div>
        <label className={labelClasses} htmlFor="profile-country">Country</label>
        <input id="profile-country" placeholder={COUNTRIES_PLACEHOLDER} className={inputClasses} value={country} onChange={(e) => setCountry(e.target.value)} />
      </div>
      <div>
        <span className={labelClasses}>{role === "teacher" ? "Level taught" : "Level"}</span>
        <div className="flex gap-2">
          {levelOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setLevel(opt)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                level === opt
                  ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                  : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      {role === "student" && (
        <div>
          <label className={labelClasses} htmlFor="profile-grade">Class / grade</label>
          <input id="profile-grade" className={inputClasses} value={classGrade} onChange={(e) => setClassGrade(e.target.value)} />
        </div>
      )}
      <FieldError>{error}</FieldError>
      <Button type="submit" className="w-full" disabled={loading || !fullName || !level}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish setting up"}
      </Button>
    </form>
  );
}
