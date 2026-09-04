import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthModal from "./AuthModal.jsx";

// Wraps any personalization action (save progress, mark concept complete,
// record a Check Yourself attempt, ...) so a signed-out visitor sees a
// tasteful one-line prompt instead of the action silently failing or the
// whole page being blocked. Public browsing/learning content stays
// available regardless — only the "remember this for me" step is gated.
//
// Usage: const runProtected = useProtectedAction();
//        <button onClick={() => runProtected(() => saveProgress(...))}>
export function useProtectedAction() {
  const { user } = useAuth();
  const [promptOpen, setPromptOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  function run(action) {
    if (user) {
      action();
      return;
    }
    setPromptOpen(true);
  }

  const prompt = promptOpen ? (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-[var(--color-amber-soft)] px-3 py-2 text-xs text-[var(--color-amber)]">
      <span>Sign in to save your learning progress.</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setModalOpen(true)} className="font-medium underline underline-offset-2">
          Sign in
        </button>
        <button type="button" onClick={() => setPromptOpen(false)} aria-label="Dismiss" className="text-[var(--color-amber)]/70 hover:text-[var(--color-amber)]">
          ×
        </button>
      </div>
      {modalOpen && <AuthModal initialView="sign-in" onClose={() => { setModalOpen(false); setPromptOpen(false); }} />}
    </div>
  ) : null;

  return [run, prompt];
}
