import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import ELabLoader from "../ui/ELabLoader.jsx";
import MaintenanceScreen from "./MaintenanceScreen.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";

// Guards a route subtree: unauthenticated -> /auth (keeping the role they
// were heading for as a query param so the auth page opens on the right
// tab); wrong role for this subtree -> their OWN home, never a dead end or
// a 404. Session/profile loading is checked explicitly so a protected page
// never flashes into view before auth is resolved (both a UX and a
// security concern — a signed-out user should never even briefly see
// protected content while Supabase's session check is still in flight).
export default function ProtectedRoute({ role, children }) {
  const { isConfigured, user, profile, loadingSession, loadingProfile, authError, signOut } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();

  // Real enforcement, not a cosmetic label: a suspended account is signed
  // out the moment its profile loads anywhere in a protected area — this
  // runs on every ProtectedRoute (student, teacher, admin alike), so
  // suspension takes effect on the very next navigation/refresh, not only
  // where an admin happens to be looking.
  const isSuspended = profile?.status === "suspended";
  useEffect(() => {
    if (isSuspended) signOut();
  }, [isSuspended, signOut]);

  if (!isConfigured) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          e-Lab isn't connected to an authentication service yet, so signed-in areas aren't available.
        </p>
      </div>
    );
  }

  // Treat "signed in, no profile yet, no error" as still loading rather
  // than "no profile" — covers the brief window right after `user`
  // becomes truthy but before fetchProfile's own loading flag has flipped
  // on, so a real user is never bounced back to /auth by a race condition.
  const stillResolvingProfile = Boolean(user) && !profile && !authError;

  if (loadingSession || (user && loadingProfile) || stillResolvingProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <ELabLoader />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?role=${role}&next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Signed in, profile genuinely failed to load (an error was recorded,
  // not just "still fetching") — a recoverable error state, not a crash.
  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          We couldn't load your profile{authError ? `: ${authError}` : "."} Try refreshing the page.
        </p>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          This account has been suspended. If you believe this is a mistake, please contact e-Lab support.
        </p>
      </div>
    );
  }

  if (profile.role !== role) {
    return <Navigate to={`/${profile.role}`} replace />;
  }

  // Never checked for role="admin" — the admin console must always stay
  // reachable to actually turn maintenance mode back off.
  if (role !== "admin" && settings.maintenance_mode) {
    return <MaintenanceScreen message={settings.maintenance_message} />;
  }

  return children;
}
