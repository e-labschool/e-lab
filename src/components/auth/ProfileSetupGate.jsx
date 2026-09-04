import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthModal from "./AuthModal.jsx";

// Mounted once near the root (see Shell.jsx). Watches auth state and, the
// moment there's a signed-in user with no profile row yet (their first
// sign-in after email verification), opens the role -> profile steps of
// AuthModal automatically. This is how step 2/3 of registration actually
// gets reached — not by navigating there directly, since a profile can
// only be created for a verified, authenticated user (see AuthContext.upsertProfile).
//
// Dismissible: per the brief, this is progress/profile completion, not a
// hard gate — a signed-in user without a profile can still browse the
// site. Dismissing just means personalization features (progress, resume,
// milestones) stay unavailable until they finish this later from /profile.
export default function ProfileSetupGate() {
  const { isConfigured, user, profile, loadingSession, loadingProfile } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!isConfigured || loadingSession || loadingProfile) return null;
  if (!user || profile || dismissed) return null;

  return <AuthModal initialView="sign-up-role" onClose={() => setDismissed(true)} />;
}
