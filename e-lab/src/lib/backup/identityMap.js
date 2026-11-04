// Pure identity-map helpers (old user id -> target user id), deliberately
// kept free of any Supabase/browser import so they can be exercised by a
// plain Node test (scripts/test-disaster-recovery.mjs) with no shimming.
// See disasterRestore.js for how these are actually used during a restore.

/** Default identity map: every old user id maps to itself — the correct
 * choice when restoring into the SAME Supabase project (or a project
 * where auth.users rows were preserved/migrated 1:1). */
export function buildIdentityMap(users) {
  const map = {};
  for (const p of users?.profiles || []) map[p.id] = p.id;
  return map;
}

/** Parses an admin-supplied CSV/JSON identity map (old_id,new_id per
 * line, or a JSON object) into the {old: new} shape the RPC expects. */
export function parseIdentityMapText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const map = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const [oldId, newId] = line.split(",").map((s) => s.trim());
    if (oldId && newId) map[oldId] = newId;
  }
  return map;
}
