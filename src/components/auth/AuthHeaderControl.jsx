import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import AccountMenu from "./AccountMenu.jsx";
import AuthModal from "./AuthModal.jsx";

// The one place Sign In / Create Account live, per the brief — swapped for
// AccountMenu the moment a session exists. Deliberately tiny: two ghost/
// text-weight actions, not a bar of buttons competing with the logo.
export default function AuthHeaderControl() {
  const { isConfigured, user, loadingSession } = useAuth();
  const [modalView, setModalView] = useState(null);

  if (!isConfigured) return null;
  if (loadingSession) return <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--color-line)]" />;

  if (user) return <AccountMenu />;

  return (
    <div className="flex items-center gap-3 text-sm">
      <button type="button" onClick={() => setModalView("sign-in")} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        Sign in
      </button>
      <button
        type="button"
        onClick={() => setModalView("sign-up-account")}
        className="rounded-md bg-[var(--color-ink)] px-3.5 py-1.5 font-medium text-[var(--color-paper)] transition-colors hover:bg-[var(--color-indigo)]"
      >
        Create account
      </button>
      {modalView && <AuthModal initialView={modalView} onClose={() => setModalView(null)} />}
    </div>
  );
}
