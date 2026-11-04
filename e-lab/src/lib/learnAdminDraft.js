// Preserves the Admin's in-progress Learn lesson editing state across a
// temporary trip to another Admin tab — which lesson was open, which
// block was expanded, and any unsaved settings-form edits (title,
// parent topic, etc, since the settings form only saves to Supabase on
// an explicit Save Draft/Publish click, unlike block content which
// already saves per-field). Uses sessionStorage, never Supabase — this
// is UI resume state, not lesson content, and is expected to survive a
// same-tab refresh but not persist forever across devices/sessions.
function draftKey(userId) {
  return `e-lab:${userId}:admin:learn-draft`;
}

export function saveLearnDraft(userId, draft) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {
    // non-critical — the draft just doesn't survive this time
  }
}

export function loadLearnDraft(userId) {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Defensive shape check — if a future schema change makes this not
    // match what LessonEditor expects, discard rather than risk feeding
    // a malformed draft into component state.
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLearnDraft(userId) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(draftKey(userId));
  } catch {
    // non-critical
  }
}
