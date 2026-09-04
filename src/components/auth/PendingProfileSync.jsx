import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getPendingProfile, clearPendingProfile } from "../../lib/pending-profile.js";

// Mounted once near the root (see Shell.jsx). Purely a background sync —
// no UI. The moment there's a signed-in user with no profile row yet AND
// sign-up fields are waiting in sessionStorage (see pending-profile.js),
// creates the profile. Covers exactly the case AuthPage's
// CreateAccountForm can't handle itself: email confirmation required, so
// no session existed at sign-up time to write the profile under.
export default function PendingProfileSync() {
  const { user, profile, loadingSession, loadingProfile, upsertProfile } = useAuth();

  useEffect(() => {
    if (loadingSession || loadingProfile) return;
    if (!user || profile) return;
    const pending = getPendingProfile();
    if (!pending) return;
    upsertProfile(pending).then(() => clearPendingProfile());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, loadingSession, loadingProfile]);

  return null;
}
