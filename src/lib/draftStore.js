// Safe local drafts for admin editing (Rich Text blocks). Drafts live in
// localStorage (survives reload / browser restart), never in Supabase, and
// are NEVER applied over newer saved content: every draft remembers a hash of
// the server value it was based on, and is only auto-restored when the server
// value still hashes the same. See docs/STATE_PERSISTENCE.md.

const PREFIX = "e-lab:draft:";

/** FNV-1a 32-bit, hex. Fast and good enough to detect "server value changed". */
export function hashString(str) {
  let h = 0x811c9dc5;
  const s = String(str ?? "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function getStorage(storage) {
  if (storage) return storage;
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

export function saveDraft(scope, draft, storage) {
  const s = getStorage(storage);
  if (!s || !scope) return false;
  try { s.setItem(PREFIX + scope, JSON.stringify({ ...draft, v: 1 })); return true; } catch { return false; }
}

export function loadDraft(scope, storage) {
  const s = getStorage(storage);
  if (!s || !scope) return null;
  try {
    const raw = s.getItem(PREFIX + scope);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === "object" && typeof d.html === "string" ? d : null;
  } catch { return null; }
}

export function clearDraft(scope, storage) {
  const s = getStorage(storage);
  if (!s || !scope) return;
  try { s.removeItem(PREFIX + scope); } catch { /* storage unavailable */ }
}

/**
 * Decides what to do with a stored draft given the CURRENT saved (server) html.
 *  - "none":     no draft, or the draft equals what is already saved (stale -> caller clears it)
 *  - "restore":  the saved value is unchanged since the draft began -> safe to restore automatically
 *  - "conflict": the saved value changed since the draft began -> do NOT apply; offer an explicit choice
 */
export function decideDraft(draft, serverHtml) {
  if (!draft) return "none";
  if (draft.html === serverHtml) return "none";
  if (draft.baseHash === hashString(serverHtml)) return "restore";
  return "conflict";
}
