import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

// Guards a route subtree: unauthenticated -> /auth (keeping the role they
// were heading for as a query param so the auth page opens on the right
// tab); wrong role for this subtree -> their OWN home, never a dead end or
// a 404. Session/profile loading is checked explicitly so a protected page
// never flashes into view before auth is resolved (both a UX and a
// security concern — a signed-out user should never even briefly see
// protected content while Supabase's session check is still in flight).
export default function ProtectedRoute({ role, children }) {
  const { isConfigured, user, profile, loadingSession, loadingProfile } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          e-Lab isn't connected to an authentication service yet, so signed-in areas aren't available.
        </p>
      </div>
    );
  }

  if (loadingSession || (user && loadingProfile)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?role=${role}&next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Signed in but profile not created yet (shouldn't normally happen given
  // AuthPage creates the profile as part of sign-up, but a defensive
  // fallback rather than a crash if it ever does).
  if (!profile) {
    return <Navigate to={`/auth?role=${role}`} replace />;
  }

  if (profile.role !== role) {
    return <Navigate to={`/${profile.role}`} replace />;
  }

  return children;
}
