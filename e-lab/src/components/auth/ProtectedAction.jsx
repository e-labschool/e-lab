import { useAuth } from "../../context/AuthContext.jsx";

// Wraps any personalization action (save progress, mark concept complete,
// record a Check Yourself attempt, ...). Under the current routing model
// every place this is used (e.g. CheckYourself) only renders behind
// ProtectedRoute, so `user` is always set by the time this runs — but the
// guard is kept (rather than assumed away) as defensive protection against
// a race during sign-out, and to fail safely rather than throw if a future
// caller ever uses this from an unprotected context.
export function useProtectedAction() {
  const { user } = useAuth();

  function run(action) {
    if (!user) return;
    action();
  }

  return [run, null];
}
