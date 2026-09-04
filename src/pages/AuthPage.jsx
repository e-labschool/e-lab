import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Container from "../components/ui/Container.jsx";
import Wordmark from "../components/layout/Wordmark.jsx";
import Button from "../components/ui/Button.jsx";

const inputClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";
const labelClasses = "mb-1.5 block text-xs font-medium text-[var(--color-ink-soft)]";

function PasswordInput({ id, value, onChange, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required
        minLength={8}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${inputClasses} pr-9`}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// One authentication page for both roles — the role only changes which
// extra profile fields are collected on sign-up and where a successful
// sign-in lands; the underlying Supabase auth calls are identical (see
// AuthContext), never two parallel auth systems.
export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role = searchParams.get("role") === "teacher" ? "teacher" : "student";
  const next = searchParams.get("next");
  const [tab, setTab] = useState(searchParams.get("tab") === "create-account" ? "create-account" : "sign-in");

  function switchRole(nextRole) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("role", nextRole);
      return params;
    });
  }

  return (
    <Container className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Wordmark />
          <h1 className="mt-5 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            Welcome to e-Lab
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Sign in to continue your learning journey.</p>

          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-indigo-soft)] px-3 py-1 text-xs font-medium text-[var(--color-indigo)]">
            {role === "teacher" ? "Teacher Account" : "Student Account"}
          </span>
          <button
            type="button"
            onClick={() => switchRole(role === "teacher" ? "student" : "teacher")}
            className="mt-1.5 text-xs text-[var(--color-ink-faint)] underline-offset-2 hover:text-[var(--color-ink)] hover:underline"
          >
            {role === "teacher" ? "Signing up as a student instead?" : "Signing up as a teacher instead?"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-md border border-[var(--color-line)] p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("sign-in")}
            className={`rounded py-1.5 font-medium transition-colors ${tab === "sign-in" ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)]"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab("create-account")}
            className={`rounded py-1.5 font-medium transition-colors ${tab === "create-account" ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)]"}`}
          >
            Create Account
          </button>
        </div>

        <div className="mt-6">
          {tab === "sign-in" ? (
            <SignInForm role={role} next={next} onSwitchTab={() => setTab("create-account")} />
          ) : (
            <CreateAccountForm role={role} />
          )}
        </div>
      </div>
    </Container>
  );
}

function SignInForm({ role, next, onSwitchTab }) {
  const { signIn, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await signIn({ email, password });
      // Load the authenticated user's row from public.profiles and read
      // its role to decide where to land — not just the role this page
      // happened to be opened for, which may be wrong (e.g. a teacher
      // opening /auth?role=student by mistake still lands in /teacher).
      const profile = await fetchProfile(user.id);
      const destination = next || `/${profile?.role || role}`;
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong signing in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className={labelClasses} htmlFor="signin-email">Email <span className="text-[var(--color-coral)]">*</span></label>
        <input id="signin-email" type="email" required autoComplete="email" className={inputClasses} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={labelClasses} htmlFor="signin-password">Password <span className="text-[var(--color-coral)]">*</span></label>
        <PasswordInput id="signin-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {error && <p role="alert" className="text-xs text-[var(--color-coral)]">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
      </Button>
      <div className="flex items-center justify-between text-xs">
        <Link to="/forgot-password" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Forgot password?</Link>
        <button type="button" onClick={onSwitchTab} className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
          Don't have an account? <span className="font-medium text-[var(--color-indigo)]">Create Account</span>
        </button>
      </div>
    </form>
  );
}

const LEVEL_OPTIONS = { student: ["SL", "HL"], teacher: ["SL", "HL", "SL & HL"] };

function CreateAccountForm({ role }) {
  const { signUp, fetchProfile, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
    school: "", country: "", classGrade: "", level: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  function set(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (fields.password.length < 8) return setError("Password must be at least 8 characters.");
    if (fields.password !== fields.confirmPassword) return setError("Passwords don't match.");
    if (!fields.level) return setError(role === "teacher" ? "Please select a teaching level." : "Please select a level.");

    setLoading(true);
    try {
      // Sent as Supabase auth user metadata (options.data) — your database
      // trigger reads this from the new auth.users row and creates the
      // matching profiles row automatically. The client never writes to
      // profiles directly on sign-up.
      const metadata = {
        full_name: fields.fullName,
        role,
        school: fields.school,
        country: fields.country,
        curriculum: "IB Diploma Programme",
        level: fields.level,
        ...(role === "student" ? { grade_or_class: fields.classGrade } : {}),
      };

      const { session, user } = await signUp({ email: fields.email, password: fields.password, metadata });

      if (session) {
        // Email confirmation is off for this project — a session exists
        // immediately, and the trigger has already created the profile
        // row as part of the same signUp transaction.
        await fetchProfile(user.id);
        navigate(`/${role}`, { replace: true });
        return;
      }

      // Email confirmation is required: no session yet, so there's
      // nothing more to do here — the trigger still fires (it's attached
      // to auth.users, not to session creation), so the profile row will
      // already exist by the time this user verifies their email and
      // signs in.
      setCheckEmail(true);
    } catch (err) {
      setError(err.message || "Something went wrong creating your account.");
    } finally {
      setLoading(false);
    }
  }

  if (!isConfigured) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Account creation isn't available yet — e-Lab isn't connected to an authentication service.</p>;
  }

  if (checkEmail) {
    return (
      <div className="space-y-3 text-sm text-[var(--color-ink-soft)]" role="status">
        <p>Account created successfully. Please check your email and confirm your email address before signing in.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className={labelClasses} htmlFor="su-name">Full Name <span className="text-[var(--color-coral)]">*</span></label>
        <input id="su-name" required className={inputClasses} value={fields.fullName} onChange={(e) => set("fullName", e.target.value)} />
      </div>
      <div>
        <label className={labelClasses} htmlFor="su-email">Email <span className="text-[var(--color-coral)]">*</span></label>
        <input id="su-email" type="email" required autoComplete="email" className={inputClasses} value={fields.email} onChange={(e) => set("email", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClasses} htmlFor="su-password">Password <span className="text-[var(--color-coral)]">*</span></label>
          <PasswordInput id="su-password" value={fields.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className={labelClasses} htmlFor="su-confirm">Confirm Password <span className="text-[var(--color-coral)]">*</span></label>
          <PasswordInput id="su-confirm" value={fields.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} autoComplete="new-password" />
        </div>
      </div>

      <div className="border-t border-[var(--color-line)] pt-4">
        <div>
          <label className={labelClasses} htmlFor="su-school">School</label>
          <input id="su-school" className={inputClasses} value={fields.school} onChange={(e) => set("school", e.target.value)} />
        </div>
        <div className="mt-3">
          <label className={labelClasses} htmlFor="su-country">Country</label>
          <input id="su-country" className={inputClasses} value={fields.country} onChange={(e) => set("country", e.target.value)} />
        </div>
        {role === "student" && (
          <div className="mt-3">
            <label className={labelClasses} htmlFor="su-grade">Class / Grade</label>
            <input id="su-grade" className={inputClasses} value={fields.classGrade} onChange={(e) => set("classGrade", e.target.value)} />
          </div>
        )}
        <div className="mt-3">
          <span className={labelClasses}>Curriculum</span>
          <p className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-sm text-[var(--color-ink-soft)]">IB Diploma Programme</p>
        </div>
        <div className="mt-3">
          <span className={labelClasses}>{role === "teacher" ? "Teaching Level" : "Level"} <span className="text-[var(--color-coral)]">*</span></span>
          <div className="flex flex-wrap gap-2">
            {LEVEL_OPTIONS[role].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => set("level", opt)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  fields.level === opt
                    ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                    : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-[var(--color-coral)]">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
      </Button>
    </form>
  );
}
