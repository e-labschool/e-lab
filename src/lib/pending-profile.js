// Tiny sessionStorage helper bridging "fields collected at sign-up time"
// to "the moment this browser actually has an authenticated session for
// that user" — needed because when Supabase email confirmation is
// enabled, signUp() returns no session, so the profile can't be written
// yet (RLS requires auth.uid() = user_id). sessionStorage (not
// localStorage) deliberately: this is scoped to the signup tab/session,
// not meant to persist indefinitely or leak across unrelated sessions.
const KEY = "e-lab:pending-profile";

export function setPendingProfile(fields) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(fields));
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — sign-up still
    // works for the immediate-session case, just not the deferred one.
  }
}

export function getPendingProfile() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingProfile() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
