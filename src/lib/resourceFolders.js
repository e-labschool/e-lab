// Pure folder model for Resources (no React, no Supabase, no I/O).
//
// A folder row (table public.resource_folders, see docs/platform-sql/010_*):
//   { id, parent_id|null, audience: 'student'|'teacher'|'both', name, slug,
//     sort_order, access_tier: 'free'|'premium', created_at, updated_at, created_by }
//
// Before the SQL migration is applied there is no table; the app then
// SYNTHESISES the four historical top-level folders from the legacy
// `category` ids (see synthesizeLegacyFolders) so the UI is identical.
//
// TIER RULE (documented decision): a folder's access tier is INHERITED by
// everything under it (sub-folders and resources).  The effective tier is the
// MOST RESTRICTIVE tier on the chain resource -> folder -> ... -> top-level:
// 'premium' anywhere on the chain makes the item premium.  A child can never
// be made "more open" than a premium ancestor, because resources.access_tier
// is a NOT NULL column defaulting to 'free' and so cannot express "inherit";
// treating a stored 'free' as an explicit open override would silently expose
// whole premium folders.  (A future nullable override column can lift this.)
// While everything is free (accessPolicy.showPremiumUi === false) the tier
// has no visible or functional effect.

export const MAX_FOLDER_DEPTH = 3; // top-level = depth 1
export const FOLDER_AUDIENCES = Object.freeze(["student", "teacher", "both"]);
export const FOLDER_TIERS = Object.freeze(["free", "premium"]);
export const PATH_SEPARATOR = " / ";
export const SYNTHETIC_PREFIX = "legacy:";

// ---- legacy categories (the hard-coded scheme this replaces) ----------------

export const LEGACY_CATEGORIES = Object.freeze([
  { id: "ib-documents", label: "IB Documents", audience: "student", sort_order: 10 },
  { id: "study-materials", label: "Study Materials", audience: "student", sort_order: 20 },
  { id: "ib-resources", label: "IB Resources", audience: "teacher", sort_order: 110 },
  { id: "worksheets-other", label: "Worksheets & Other Resources", audience: "teacher", sort_order: 120 },
]);
// Same pairing resourceService.js uses (a test asserts parity).
export const STUDENT_TO_TEACHER_CATEGORY = Object.freeze({ "ib-documents": "ib-resources", "study-materials": "worksheets-other" });
export const TEACHER_TO_STUDENT_CATEGORY = Object.freeze({ "ib-resources": "ib-documents", "worksheets-other": "study-materials" });
const LEGACY_IDS = new Set(LEGACY_CATEGORIES.map((c) => c.id));
const DEFAULT_LEGACY_CATEGORY = Object.freeze({ student: "study-materials", teacher: "worksheets-other", both: "study-materials" });

export const isSyntheticFolderId = (id) => typeof id === "string" && id.startsWith(SYNTHETIC_PREFIX);

export function synthesizeLegacyFolders() {
  return LEGACY_CATEGORIES.map((c) => ({
    id: `${SYNTHETIC_PREFIX}${c.id}`, parent_id: null, audience: c.audience, name: c.label, slug: c.id,
    sort_order: c.sort_order, access_tier: "free", created_at: null, updated_at: null, created_by: null, synthetic: true,
  }));
}

// ---- basics ------------------------------------------------------------------

export function slugify(name) {
  return String(name ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "folder";
}

export function normaliseFolderAudience(a) { return FOLDER_AUDIENCES.includes(a) ? a : "student"; }
export function normaliseFolderTier(t) { return FOLDER_TIERS.includes(t) ? t : "free"; }
const nameKey = (s) => String(s ?? "").trim().toLowerCase();

export function compareFolders(a, b) {
  return (Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    || String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" })
    || String(a.id).localeCompare(String(b.id));
}
export const sortFolders = (rows) => [...rows].sort(compareFolders);

/** Is a folder of `folderAudience` shown to `role` ('student'|'teacher'; 'admin' sees all)? */
export function audienceMatches(folderAudience, role) {
  if (role === "admin" || role == null) return true;
  return folderAudience === role || folderAudience === "both";
}

/** May a child with audience `child` sit under a parent of audience `parent`? (child must be no wider) */
export function audienceFitsUnder(child, parent) {
  return parent === "both" || child === parent;
}

// ---- tree ------------------------------------------------------------------------

/**
 * Build a tree from flat rows.  Returns
 *  { roots, byId, invalid, nodes }
 * node = { ...row, children, depth (1-based), parent (node|null), path (string[]),
 *          pathString, orphan }.
 * Rows whose parent id is unknown are treated as top-level (orphan: true).  Rows that sit
 * in a parent cycle are unreachable and returned in `invalid` (never rendered, never looped).
 */
export function buildTree(rows) {
  const byId = new Map();
  for (const r of rows ?? []) if (r && r.id != null) byId.set(r.id, { ...r, children: [], depth: 0, parent: null, path: [], pathString: "", orphan: false });
  const roots = [];
  for (const n of byId.values()) {
    const p = n.parent_id != null ? byId.get(n.parent_id) : null;
    if (n.parent_id != null && (!p || p === n)) { // missing parent or self-parent
      if (p === n) continue; // self-parent: invalid
      n.orphan = true; roots.push(n);
    } else if (p) { n.parent = p; p.children.push(n); } else roots.push(n);
  }
  const reachable = new Set();
  const walk = (n, depth, trail) => {
    if (reachable.has(n.id)) return;
    reachable.add(n.id);
    n.depth = depth;
    n.path = [...trail, n.name];
    n.pathString = n.path.join(PATH_SEPARATOR);
    n.children.sort(compareFolders);
    for (const c of n.children) walk(c, depth + 1, n.path);
  };
  roots.sort(compareFolders);
  for (const r of roots) walk(r, 1, []);
  const invalid = [...byId.values()].filter((n) => !reachable.has(n.id));
  for (const n of invalid) { n.children = []; }
  for (const n of byId.values()) n.children = n.children.filter((c) => reachable.has(c.id));
  return { roots, byId, invalid, nodes: [...reachable].map((id) => byId.get(id)) };
}

export const treeFromRows = buildTree;

/** Depth-first ordered list of every reachable node. */
export function flattenTree(tree) {
  const out = [];
  const visit = (n) => { out.push(n); n.children.forEach(visit); };
  tree.roots.forEach(visit);
  return out;
}

export function getFolder(tree, id) { return id == null ? null : tree.byId.get(id) ?? null; }

/** Ancestors from top-level down to the folder itself. */
export function getAncestry(tree, id) {
  const out = [];
  let n = getFolder(tree, id);
  const seen = new Set();
  while (n && !seen.has(n.id)) { seen.add(n.id); out.unshift(n); n = n.parent; }
  return out;
}
export function folderPath(tree, id) { return getAncestry(tree, id).map((n) => n.name); }
export function folderPathString(tree, id, sep = PATH_SEPARATOR) { return folderPath(tree, id).join(sep); }

export function getDescendantIds(tree, id) {
  const start = getFolder(tree, id); if (!start) return [];
  const out = [];
  const visit = (n) => n.children.forEach((c) => { out.push(c.id); visit(c); });
  visit(start);
  return out;
}
export function isDescendantOf(tree, id, ancestorId) { return getDescendantIds(tree, ancestorId).includes(id); }

/** Height of a subtree counting the node itself (leaf = 1). */
export function subtreeHeight(node) { return 1 + Math.max(0, ...node.children.map(subtreeHeight)); }

// ---- validation --------------------------------------------------------------------

const ok = () => ({ ok: true });
const fail = (code, error) => ({ ok: false, code, error });

export function validateFolderName(name) {
  const n = String(name ?? "").trim();
  if (!n) return fail("name-required", "Folder name is required.");
  if (n.length > 80) return fail("name-too-long", "Folder name must be 80 characters or fewer.");
  if (/[/\\]/.test(n)) return fail("name-invalid", "Folder names can't contain / or \\ (they separate levels in the path).");
  return ok();
}

function siblingNameTaken(rows, { parent_id, audience, name, excludeId }) {
  return rows.some((r) => r.id !== excludeId && (r.parent_id ?? null) === (parent_id ?? null) && r.audience === audience && nameKey(r.name) === nameKey(name));
}

/** Can a NEW folder be created with these fields? */
export function validateNewFolder(rows, { parent_id = null, name, audience, access_tier }) {
  const nv = validateFolderName(name); if (!nv.ok) return nv;
  if (!FOLDER_AUDIENCES.includes(audience)) return fail("audience-invalid", "Choose who the folder is for: students, teachers or both.");
  if (access_tier != null && !FOLDER_TIERS.includes(access_tier)) return fail("tier-invalid", "Access level must be Free or Premium.");
  const tree = buildTree(rows);
  if (parent_id != null) {
    const parent = tree.byId.get(parent_id);
    if (!parent) return fail("parent-missing", "The parent folder no longer exists.");
    if (parent.depth + 1 > MAX_FOLDER_DEPTH) return fail("too-deep", `Folders can be nested at most ${MAX_FOLDER_DEPTH} levels deep.`);
    if (!audienceFitsUnder(audience, parent.audience)) return fail("audience-conflict", `This folder sits inside a folder for ${parent.audience === "student" ? "students" : "teachers"} only, so it must have the same audience.`);
  }
  if (siblingNameTaken(rows, { parent_id, audience, name })) return fail("duplicate-name", "A folder with this name already exists here for this audience.");
  return ok();
}

export function validateRename(rows, id, name) {
  const nv = validateFolderName(name); if (!nv.ok) return nv;
  const f = rows.find((r) => r.id === id); if (!f) return fail("not-found", "Folder not found.");
  if (siblingNameTaken(rows, { parent_id: f.parent_id, audience: f.audience, name, excludeId: id })) return fail("duplicate-name", "A folder with this name already exists here for this audience.");
  return ok();
}

/** Can `id` be moved under `newParentId` (null = top level)?  Checks cycles, depth, audience, name clash. */
export function validateMove(rows, id, newParentId = null) {
  const tree = buildTree(rows);
  const node = tree.byId.get(id); if (!node) return fail("not-found", "Folder not found.");
  if (newParentId === id) return fail("cycle", "A folder can't be moved into itself.");
  if (newParentId != null) {
    const parent = tree.byId.get(newParentId);
    if (!parent) return fail("parent-missing", "The destination folder no longer exists.");
    if (isDescendantOf(tree, newParentId, id)) return fail("cycle", "A folder can't be moved into one of its own sub-folders.");
    if (parent.depth + subtreeHeight(node) > MAX_FOLDER_DEPTH) return fail("too-deep", `That move would nest folders more than ${MAX_FOLDER_DEPTH} levels deep.`);
    if (!audienceFitsUnder(node.audience, parent.audience)) return fail("audience-conflict", "The destination is for a narrower audience than this folder.");
    const bad = getDescendantIds(tree, id).map((d) => tree.byId.get(d)).find((d) => !audienceFitsUnder(d.audience, parent.audience));
    if (bad) return fail("audience-conflict", "A sub-folder's audience doesn't fit the destination.");
  }
  if (siblingNameTaken(rows, { parent_id: newParentId, audience: node.audience, name: node.name, excludeId: id })) return fail("duplicate-name", "The destination already has a folder with this name for this audience.");
  return ok();
}

/**
 * Changing a folder's audience.  Widening to 'both' is always fine.  Narrowing from 'both' also
 * narrows descendants that were 'both' (returned in `cascade`, deepest first); a descendant for the
 * OTHER audience blocks it.  student<->teacher with sub-folders is refused (would orphan them).
 */
export function validateAudienceChange(rows, id, audience) {
  if (!FOLDER_AUDIENCES.includes(audience)) return fail("audience-invalid", "Choose students, teachers or both.");
  const tree = buildTree(rows);
  const node = tree.byId.get(id); if (!node) return fail("not-found", "Folder not found.");
  if (node.audience === audience) return { ok: true, cascade: [] };
  if (node.parent && !audienceFitsUnder(audience, node.parent.audience)) return fail("audience-conflict", "The parent folder is for a narrower audience, so this folder can't be wider.");
  const desc = getDescendantIds(tree, id).map((d) => tree.byId.get(d));
  const cascade = [];
  if (audience !== "both") {
    for (const d of desc) {
      if (d.audience === audience) continue;
      if (d.audience === "both" && node.audience === "both") cascade.push(d); else return fail("audience-conflict", "Sub-folders are for a different audience. Move or change them first.");
    }
  }
  if (siblingNameTaken(rows, { parent_id: node.parent_id, audience, name: node.name, excludeId: id })) return fail("duplicate-name", "A folder with this name already exists here for that audience.");
  cascade.sort((a, b) => b.depth - a.depth);
  return { ok: true, cascade: cascade.map((c) => c.id) };
}

// ---- ordering ----------------------------------------------------------------------

export function nextSortOrder(rows, parent_id = null) {
  const sibs = rows.filter((r) => (r.parent_id ?? null) === (parent_id ?? null));
  return sibs.length ? Math.max(...sibs.map((r) => Number(r.sort_order ?? 0))) + 10 : 10;
}

/** New sort_order values after moving `id` one step up/down among its siblings (all audiences).
 *  Returns [{id, sort_order}] for every sibling whose value changes, renumbered 10,20,30… */
export function reorderSiblings(rows, id, direction) {
  const f = rows.find((r) => r.id === id); if (!f) return [];
  const sibs = sortFolders(rows.filter((r) => (r.parent_id ?? null) === (f.parent_id ?? null)));
  const i = sibs.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= sibs.length) return [];
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  return sibs.map((s, idx) => ({ id: s.id, sort_order: (idx + 1) * 10 })).filter((u) => Number(rows.find((r) => r.id === u.id).sort_order) !== u.sort_order);
}

export function uniqueSlug(rows, { parent_id = null, audience, name, excludeId }) {
  const base = slugify(name);
  const taken = new Set(rows.filter((r) => r.id !== excludeId && (r.parent_id ?? null) === (parent_id ?? null) && r.audience === audience).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

// ---- audience filtering --------------------------------------------------------------

/** Rows visible to `role`: audience matches AND every ancestor is visible too. */
export function filterFoldersForRole(rows, role) {
  if (role === "admin" || role == null) return [...rows];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const visible = (r, seen = new Set()) => {
    if (!audienceMatches(r.audience, role) || seen.has(r.id)) return false;
    seen.add(r.id);
    const p = r.parent_id != null ? byId.get(r.parent_id) : null;
    return p ? visible(p, seen) : true;
  };
  return rows.filter((r) => visible(r));
}

// ---- tier inheritance ------------------------------------------------------------------

/** Most-restrictive-wins (see header).  `ownTier` is the resource's/folder's own stored tier. */
export function effectiveTier(tree, folderId, ownTier = "free") {
  if (normaliseFolderTier(ownTier) === "premium") return "premium";
  return getAncestry(tree, folderId).some((f) => normaliseFolderTier(f.access_tier) === "premium") ? "premium" : "free";
}
/** Does a premium ancestor (not the folder itself) force this folder to premium? */
export function inheritsPremium(tree, folderId) {
  const a = getAncestry(tree, folderId).slice(0, -1);
  return a.some((f) => normaliseFolderTier(f.access_tier) === "premium");
}

// ---- resources <-> folders ---------------------------------------------------------------

/** Pick the legacy category id a resource is stored with (resource.category or row.category). */
const catOf = (r) => r?.category ?? null;

/** Find the top-level folder for a legacy category id as seen by `role`. */
export function folderIdForLegacyCategory(rows, categoryId, role) {
  const top = rows.filter((f) => f.parent_id == null && f.slug === categoryId);
  let pick = top.find((f) => audienceMatches(f.audience, role) && (role === "admin" || f.audience === role)) ?? top.find((f) => audienceMatches(f.audience, role));
  return pick ? pick.id : null;
}

/** Legacy ids translated across the student/teacher schemes for `role` (the old "both" behaviour). */
export function legacyCategoryForRole(categoryId, role) {
  if (role === "teacher" && categoryId in STUDENT_TO_TEACHER_CATEGORY) return STUDENT_TO_TEACHER_CATEGORY[categoryId];
  if (role === "student" && categoryId in TEACHER_TO_STUDENT_CATEGORY) return TEACHER_TO_STUDENT_CATEGORY[categoryId];
  return categoryId;
}

/**
 * Which folder shows this resource for `role`?  `rows` are the folder rows VISIBLE to that role.
 * 1. resource.folder_id (camel: folderId) when that folder is visible;
 * 2. otherwise the legacy category (translated across schemes for the role) -> top-level folder;
 * 3. otherwise null (shown only in "All resources" / search).
 */
export function resolveResourceFolderId(resource, rows, role) {
  const fid = resource?.folder_id ?? resource?.folderId ?? null;
  if (fid != null && rows.some((f) => f.id === fid)) return fid;
  const cat = catOf(resource);
  if (cat == null) return null;
  const cats = [legacyCategoryForRole(cat, role)];
  if (role === "admin") cats.push(cat, TEACHER_TO_STUDENT_CATEGORY[cat], STUDENT_TO_TEACHER_CATEGORY[cat]);
  for (const c of cats) { if (c == null) continue; const id = folderIdForLegacyCategory(rows, c, role); if (id) return id; }
  return null;
}

/** The legacy `category` to keep writing for a resource saved into `folderId`. */
export function legacyCategoryForFolder(tree, folderId, resourceAudience = "student") {
  const top = getAncestry(tree, folderId)[0];
  if (top && LEGACY_IDS.has(top.slug)) {
    // keep a category from the scheme that matches the resource audience (student/both -> student scheme)
    const c = top.slug;
    if (resourceAudience === "teacher" && c in TEACHER_TO_STUDENT_CATEGORY) return c;
    if (resourceAudience === "teacher") return STUDENT_TO_TEACHER_CATEGORY[c] ?? c;
    if (c in TEACHER_TO_STUDENT_CATEGORY) return TEACHER_TO_STUDENT_CATEGORY[c];
    return c;
  }
  return DEFAULT_LEGACY_CATEGORY[resourceAudience] ?? "study-materials";
}

/** Dropdown options (full paths) for the Add/Edit resource form, in tree order. */
export function folderOptionsForAudience(rows, resourceAudience) {
  const tree = buildTree(rows);
  let list = flattenTree(tree);
  if (resourceAudience === "student" || resourceAudience === "teacher") list = list.filter((n) => audienceMatches(n.audience, resourceAudience) && getAncestry(tree, n.id).every((a) => audienceMatches(a.audience, resourceAudience)));
  const both = resourceAudience === "both";
  return list.map((n) => ({
    id: n.id, depth: n.depth, audience: n.audience, synthetic: Boolean(n.synthetic),
    label: n.pathString + (both && n.audience !== "both" ? ` (${n.audience === "student" ? "Students" : "Teachers"})` : ""),
  }));
}

/** Resource counts per folder: direct and whole-subtree. */
export function countResources(tree, resources, resolve) {
  const direct = new Map(); let unfiled = 0;
  for (const r of resources) { const id = resolve(r); if (id == null || !tree.byId.has(id)) unfiled += 1; else direct.set(id, (direct.get(id) ?? 0) + 1); }
  const total = new Map();
  const sum = (n) => { let t = direct.get(n.id) ?? 0; for (const c of n.children) t += sum(c); total.set(n.id, t); return t; };
  tree.roots.forEach(sum);
  return { direct, total, unfiled };
}

// ---- search / sort -----------------------------------------------------------------------

export function resourceSearchText(resource, folderPath = "") {
  return [resource.title, resource.description, resource.topic, resource.resourceType, resource.fileType, folderPath].filter(Boolean).join(" ").toLowerCase();
}
/** Every whitespace-separated word must appear (title/description/topic/type/folder path). */
export function searchResources(resources, query, pathOf = () => "") {
  const words = String(query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...resources];
  return resources.filter((r) => { const hay = resourceSearchText(r, pathOf(r)); return words.every((w) => hay.includes(w)); });
}
export const SORT_OPTIONS = Object.freeze([{ id: "newest", label: "Newest" }, { id: "az", label: "A–Z" }]);
export function sortResources(resources, mode = "newest") {
  const list = [...resources];
  const ts = (r) => { const t = Date.parse(r.createdAt ?? r.created_at ?? ""); return Number.isNaN(t) ? 0 : t; };
  if (mode === "az") return list.sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base", numeric: true }) || String(a.id).localeCompare(String(b.id)));
  return list.sort((a, b) => ts(b) - ts(a) || String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" }));
}

/** Direct children of a folder (null = top level), already ordered. */
export function childFolders(tree, folderId) { return folderId == null ? tree.roots : (getFolder(tree, folderId)?.children ?? []); }
