import { supabase as defaultClient } from "./supabaseClient.js";
import {
  buildTree, synthesizeLegacyFolders, validateNewFolder, validateRename, validateMove, validateAudienceChange,
  uniqueSlug, nextSortOrder, reorderSiblings, filterFoldersForRole, resolveResourceFolderId,
  LEGACY_CATEGORIES, normaliseFolderTier, FOLDER_TIERS,
} from "./resourceFolders.js";

// All resource_folders DB calls live here (mirrors resourceService.js: nothing
// else in the app calls supabase.from("resource_folders")).
//
// BEFORE the SQL migration (docs/platform-sql/010_resource_folders.sql) the table
// does not exist.  Reads then fall back to folders synthesised from the legacy
// categories (`source: "fallback"`) and every write throws a FolderError with
// code "not-migrated" instead of crashing.

const TABLE = "resource_folders";

export class FolderError extends Error {
  constructor(code, message, cause) { super(message); this.name = "FolderError"; this.code = code; if (cause) this.cause = cause; }
}

/** True when a PostgREST/Postgres error means the folders table or resources.folder_id does not exist (yet). */
export function isMissingFolderSchemaError(err) {
  if (!err) return false;
  const msg = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`.toLowerCase();
  if (["PGRST205", "42P01", "42703", "PGRST204", "PGRST200"].includes(err.code)) return /resource_folders|folder_id/.test(msg) || err.code === "42P01" || err.code === "PGRST205";
  return /(resource_folders|folder_id)/.test(msg) && /(does not exist|schema cache|could not find|not find)/.test(msg);
}

function wrap(err, fallbackMessage) {
  if (err instanceof FolderError) return err;
  if (isMissingFolderSchemaError(err)) return new FolderError("not-migrated", "The folders table has not been created yet. Apply the resource-folders SQL first (see docs/RESOURCE_FOLDERS.md).", err);
  if (err?.code === "23503") return new FolderError("not-empty", "This folder still has sub-folders or resources, so it can't be deleted.", err);
  if (err?.code === "23505") return new FolderError("duplicate-name", "A folder with this name already exists here for this audience.", err);
  if (err?.code === "42501") return new FolderError("forbidden", "You don't have permission to change folders.", err);
  return new FolderError("db-error", err?.message || fallbackMessage, err);
}
const fromValidation = (v) => new FolderError(v.code, v.error);

export function createFolderService(client = defaultClient) {
  const db = () => { if (!client) throw new FolderError("not-connected", "Not connected to Supabase."); return client; };

  /** { folders, source: 'database'|'fallback', reason } — NEVER throws.  `folders` are all rows (admin view). */
  async function loadFolders() {
    if (!client) return { folders: synthesizeLegacyFolders(), source: "fallback", reason: "not-connected" };
    try {
      const { data, error } = await client.from(TABLE).select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return { folders: synthesizeLegacyFolders(), source: "fallback", reason: "empty" };
      return { folders: data, source: "database", reason: null };
    } catch (err) {
      return { folders: synthesizeLegacyFolders(), source: "fallback", reason: isMissingFolderSchemaError(err) ? "not-migrated" : "error", error: err?.message };
    }
  }

  /** Strict read for the admin manager: distinguishes missing table / empty table / error. */
  async function loadFoldersForAdmin() {
    if (!client) return { folders: synthesizeLegacyFolders(), source: "fallback", reason: "not-connected" };
    try {
      const { data, error } = await client.from(TABLE).select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return { folders: data ?? [], source: "database", reason: (data ?? []).length ? null : "empty" };
    } catch (err) {
      return { folders: synthesizeLegacyFolders(), source: "fallback", reason: isMissingFolderSchemaError(err) ? "not-migrated" : "error", error: err?.message };
    }
  }

  async function currentRows() {
    const { data, error } = await db().from(TABLE).select("*");
    if (error) throw wrap(error);
    return data ?? [];
  }

  async function createFolder({ parent_id = null, name, audience, access_tier = "free" }) {
    try {
      const rows = await currentRows();
      const fields = { parent_id, name: String(name ?? "").trim(), audience, access_tier };
      const v = validateNewFolder(rows, fields); if (!v.ok) throw fromValidation(v);
      const { data: userData } = (await db().auth?.getUser?.()) ?? {};
      const row = {
        ...fields, slug: uniqueSlug(rows, { parent_id, audience, name: fields.name }),
        sort_order: nextSortOrder(rows, parent_id), created_by: userData?.user?.id ?? null,
      };
      const { data, error } = await db().from(TABLE).insert(row).select().single();
      if (error) throw error;
      return data;
    } catch (err) { throw wrap(err, "Couldn't create the folder."); }
  }

  async function renameFolder(id, name) {
    try {
      const rows = await currentRows();
      const v = validateRename(rows, id, name); if (!v.ok) throw fromValidation(v);
      // slug is intentionally NOT changed on rename: it is the stable key for legacy
      // category deep links (/student/resources/ib-documents).
      const { data, error } = await db().from(TABLE).update({ name: String(name).trim() }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    } catch (err) { throw wrap(err, "Couldn't rename the folder."); }
  }

  async function moveFolder(id, newParentId = null) {
    try {
      const rows = await currentRows();
      const v = validateMove(rows, id, newParentId); if (!v.ok) throw fromValidation(v);
      const slug = uniqueSlug(rows, { parent_id: newParentId, audience: rows.find((r) => r.id === id).audience, name: rows.find((r) => r.id === id).name, excludeId: id });
      const current = rows.find((r) => r.id === id);
      const patch = { parent_id: newParentId, sort_order: nextSortOrder(rows.filter((r) => r.id !== id), newParentId) };
      if (current.slug !== slug && newParentId != null) patch.slug = slug; // top-level slugs (legacy keys) never rewritten here
      const { data, error } = await db().from(TABLE).update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    } catch (err) { throw wrap(err, "Couldn't move the folder."); }
  }

  /** direction: 'up' | 'down' among siblings.  Returns the updated sibling rows (possibly empty). */
  async function reorderFolder(id, direction) {
    try {
      const rows = await currentRows();
      const updates = reorderSiblings(rows, id, direction);
      for (const u of updates) {
        const { error } = await db().from(TABLE).update({ sort_order: u.sort_order }).eq("id", u.id);
        if (error) throw error;
      }
      return updates;
    } catch (err) { throw wrap(err, "Couldn't reorder the folder."); }
  }

  async function setFolderAudience(id, audience) {
    try {
      const rows = await currentRows();
      const v = validateAudienceChange(rows, id, audience); if (!v.ok) throw fromValidation(v);
      for (const cid of v.cascade) { // deepest first so every step stays valid
        const { error } = await db().from(TABLE).update({ audience }).eq("id", cid);
        if (error) throw error;
      }
      const { data, error } = await db().from(TABLE).update({ audience }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    } catch (err) { throw wrap(err, "Couldn't change the audience."); }
  }

  async function setFolderTier(id, access_tier) {
    try {
      if (!FOLDER_TIERS.includes(access_tier)) throw new FolderError("tier-invalid", "Access level must be Free or Premium.");
      const { data, error } = await db().from(TABLE).update({ access_tier: normaliseFolderTier(access_tier) }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    } catch (err) { throw wrap(err, "Couldn't change the access level."); }
  }

  /** Resources that live in `id` (folder_id, or legacy category for un-migrated rows). */
  async function countResourcesInFolder(id, rows) {
    const all = rows ?? await currentRows();
    const visibleAll = all;
    const { data, error } = await db().from("resources").select("*");
    if (error) {
      if (isMissingFolderSchemaError(error)) return 0;
      throw error;
    }
    return (data ?? []).filter((r) => resolveResourceFolderId(r, visibleAll, "admin") === id).length;
  }

  async function deleteFolder(id) {
    try {
      const rows = await currentRows();
      const tree = buildTree(rows);
      const node = tree.byId.get(id); if (!node) throw new FolderError("not-found", "Folder not found.");
      const kids = node.children.length;
      if (kids) throw new FolderError("not-empty", `This folder has ${kids} sub-folder${kids === 1 ? "" : "s"}. Move or delete ${kids === 1 ? "it" : "them"} first.`);
      const n = await countResourcesInFolder(id, rows);
      if (n) throw new FolderError("not-empty", `This folder contains ${n} resource${n === 1 ? "" : "s"}. Move ${n === 1 ? "it" : "them"} to another folder (Resources → Edit) first.`);
      const { error } = await db().from(TABLE).delete().eq("id", id);
      if (error) throw error;
    } catch (err) { throw wrap(err, "Couldn't delete the folder."); }
  }

  /** Create the four standard top-level folders if the table is empty (same as the SQL backfill; idempotent by slug). */
  async function seedLegacyFolders() {
    try {
      const rows = await currentRows();
      const { data: userData } = (await db().auth?.getUser?.()) ?? {};
      const missing = LEGACY_CATEGORIES.filter((c) => !rows.some((r) => r.parent_id == null && r.slug === c.id));
      if (!missing.length) return [];
      const { data, error } = await db().from(TABLE).insert(missing.map((c) => ({
        parent_id: null, audience: c.audience, name: c.label, slug: c.id, sort_order: c.sort_order, access_tier: "free", created_by: userData?.user?.id ?? null,
      }))).select();
      if (error) throw error;
      return data ?? [];
    } catch (err) { throw wrap(err, "Couldn't create the standard folders."); }
  }

  return {
    loadFolders, loadFoldersForAdmin, createFolder, renameFolder, moveFolder, reorderFolder,
    setFolderAudience, setFolderTier, deleteFolder, seedLegacyFolders, countResourcesInFolder,
  };
}

const service = createFolderService();
export const {
  loadFolders, loadFoldersForAdmin, createFolder, renameFolder, moveFolder, reorderFolder,
  setFolderAudience, setFolderTier, deleteFolder, seedLegacyFolders, countResourcesInFolder,
} = service;

/** Convenience: folders visible to a role (student/teacher/admin), with fallback. */
export async function loadFoldersForRole(role) {
  const res = await loadFolders();
  return { ...res, folders: filterFoldersForRole(res.folders, role) };
}
