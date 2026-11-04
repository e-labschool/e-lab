// Shared helper for all "remember where the user was" features —
// namespaced by user id so different accounts on the same browser never
// share state, and scoped to plain navigation/UI state only (route
// paths, page numbers, open/closed editor state) — never secrets, never
// question content, never anything that belongs in Supabase.
function keyFor(userId, key) {
  return `e-lab:${userId}:${key}`;
}

export function saveUserScopedValue(userId, key, value) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId, key), JSON.stringify(value));
  } catch {
    // localStorage can throw (quota, private mode) — non-critical, the
    // feature just silently doesn't resume this time.
  }
}

export function loadUserScopedValue(userId, key, fallback = null) {
  if (!userId || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(keyFor(userId, key));
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function clearUserScopedValue(userId, key) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(userId, key));
  } catch {
    // non-critical
  }
}
