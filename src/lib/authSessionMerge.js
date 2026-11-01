// Pure helpers for AuthContext (kept separate so they are unit-testable).
export function sameJson(a, b) {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/** Same user, fresh tokens: keep the previous `user` object identity
 * unless something on it genuinely changed (updated_at / metadata). */
export function mergeSameUserSession(prev, next) {
  if (!prev?.user || !next?.user || prev.user.id !== next.user.id) return next;
  const unchanged = prev.user.updated_at === next.user.updated_at
    && sameJson(prev.user.user_metadata, next.user.user_metadata)
    && prev.user.email === next.user.email;
  return unchanged ? { ...next, user: prev.user } : next;
}

