import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import AccountMenu from "./AccountMenu.jsx";

// The one place Sign In / Create Account live on the public site, per the
// brief — both are plain links into the dedicated /auth page now (not a
// modal), and swap for AccountMenu the instant a session exists.
export default function AuthHeaderControl() {
  const { isConfigured, user, loadingSession } = useAuth();

  if (!isConfigured) return null;
  if (loadingSession) return <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--color-line)]" />;
  if (user) return <AccountMenu />;

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link to="/auth" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        Sign in
      </Link>
      <Link
        to="/auth?tab=create-account"
        className="rounded-md bg-[var(--color-ink)] px-3.5 py-1.5 font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-indigo)]"
      >
        Create account
      </Link>
    </div>
  );
}
