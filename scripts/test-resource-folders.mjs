#!/usr/bin/env node
// Node tests for the resource-folders model + service:  node scripts/test-resource-folders.mjs
//  - src/lib/resourceFolders.js (pure): tree, paths, descendants, depth/cycle/audience validation, ordering,
//    audience filtering, tier inheritance, legacy fallback synthesis + category mapping, form dropdown options,
//    legacy category derivation, search/sort
//  - src/lib/folderService.js against an in-memory fake (NOT Supabase): fallback when the table is missing,
//    create/rename/move/reorder/audience/tier/delete-if-empty, clear errors
//  - src/lib/resourceService.js: folder_id retry when the column is missing; legacy category parity
// Honest limits: the SQL draft itself is NOT exercised here, and no live Supabase is used.
import assert from "node:assert/strict";
import { register } from "node:module";
register("./resource-folders-loader-hooks.mjs", import.meta.url);

const F = await import("../src/lib/resourceFolders.js");
const { createFolderService, FolderError, isMissingFolderSchemaError } = await import("../src/lib/folderService.js");
const RS = await import("../src/lib/resourceService.js");
const { createFakeSupabase } = await import("./resource-folders-fake-supabase.mjs");
const { tierBadge, checkAccess, DEFAULT_ACCESS_CONFIG } = await import("../src/lib/access/accessPolicy.js");

let n = 0;
async function t(name, fn) { try { await fn(); n += 1; console.log(`  ok   ${name}`); } catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; } }
const row = (id, parent_id, name, extra = {}) => ({ id, parent_id, audience: "student", name, slug: F.slugify(name), sort_order: 10, access_tier: "free", ...extra });

const sample = [
  row("sm", null, "Study Materials", { sort_order: 20, slug: "study-materials" }),
  row("ib", null, "IB Documents", { sort_order: 10, slug: "ib-documents" }),
  row("chem", "sm", "Chemistry"),
  row("struct", "chem", "Structure", { sort_order: 20 }),
  row("react", "chem", "Reactivity", { sort_order: 10 }),
  row("maths", "sm", "Maths & skills", { sort_order: 20 }),
  row("t-ib", null, "IB Resources", { audience: "teacher", sort_order: 110, slug: "ib-resources" }),
  row("shared", null, "Shared", { audience: "both", sort_order: 300 }),
];

console.log("resource folders - pure model");

await t("buildTree: roots sorted by sort_order, children sorted, depth + path strings", () => {
  const tr = F.buildTree(sample);
  assert.deepEqual(tr.roots.map((r) => r.id), ["ib", "sm", "t-ib", "shared"]);
  assert.deepEqual(tr.byId.get("chem").children.map((c) => c.id), ["react", "struct"]);
  assert.equal(tr.byId.get("struct").depth, 3);
  assert.equal(tr.byId.get("struct").pathString, "Study Materials / Chemistry / Structure");
  assert.deepEqual(F.folderPath(tr, "react"), ["Study Materials", "Chemistry", "Reactivity"]);
  assert.equal(F.folderPathString(tr, "maths", " > "), "Study Materials > Maths & skills");
  assert.deepEqual(F.flattenTree(tr).map((x) => x.id), ["ib", "sm", "chem", "react", "struct", "maths", "t-ib", "shared"]);
});
await t("buildTree: same sort_order falls back to name then id (stable)", () => {
  const tr = F.buildTree([row("b", null, "Beta"), row("a", null, "alpha"), row("c", null, "Alpha2")]);
  assert.deepEqual(tr.roots.map((r) => r.id), ["a", "c", "b"]);
});
await t("buildTree: orphan (missing parent) becomes top-level and is flagged; cycles are isolated, never loop", () => {
  const tr = F.buildTree([row("o", "ghost", "Orphan"), row("x", "y", "X"), row("y", "x", "Y"), row("self", "self", "Self"), row("ok", null, "OK")]);
  assert.equal(tr.byId.get("o").orphan, true);
  assert.deepEqual(tr.roots.map((r) => r.id).sort(), ["o", "ok"]);
  assert.deepEqual(tr.invalid.map((r) => r.id).sort(), ["self", "x", "y"]);
  assert.equal(F.flattenTree(tr).length, 2);
});
await t("descendants / ancestry / subtree height", () => {
  const tr = F.buildTree(sample);
  assert.deepEqual(F.getDescendantIds(tr, "sm").sort(), ["chem", "maths", "react", "struct"]);
  assert.deepEqual(F.getDescendantIds(tr, "struct"), []);
  assert.equal(F.isDescendantOf(tr, "struct", "sm"), true);
  assert.equal(F.isDescendantOf(tr, "sm", "struct"), false);
  assert.deepEqual(F.getAncestry(tr, "struct").map((x) => x.id), ["sm", "chem", "struct"]);
  assert.equal(F.subtreeHeight(tr.byId.get("sm")), 3);
  assert.equal(F.subtreeHeight(tr.byId.get("ib")), 1);
});
await t("validateNewFolder: name, audience, depth limit (3), parent audience, duplicate per audience", () => {
  assert.equal(F.validateNewFolder(sample, { name: " ", audience: "student" }).code, "name-required");
  assert.equal(F.validateNewFolder(sample, { name: "a/b", audience: "student" }).code, "name-invalid");
  assert.equal(F.validateNewFolder(sample, { name: "x", audience: "nobody" }).code, "audience-invalid");
  assert.equal(F.validateNewFolder(sample, { name: "Deep", audience: "student", parent_id: "struct" }).code, "too-deep");
  assert.equal(F.validateNewFolder(sample, { name: "Ok", audience: "student", parent_id: "chem" }).ok, true);
  assert.equal(F.validateNewFolder(sample, { name: "Teach", audience: "teacher", parent_id: "sm" }).code, "audience-conflict");
  assert.equal(F.validateNewFolder(sample, { name: "Anyone", audience: "both", parent_id: "sm" }).code, "audience-conflict", "a 'both' child cannot sit under a student-only parent");
  assert.equal(F.validateNewFolder(sample, { name: "Student kid", audience: "student", parent_id: "shared" }).ok, true);
  assert.equal(F.validateNewFolder(sample, { name: "chemistry", audience: "student", parent_id: "sm" }).code, "duplicate-name");
  assert.equal(F.validateNewFolder(sample, { name: "Chemistry", audience: "teacher" }).ok, true, "same name allowed in another audience");
  assert.equal(F.validateNewFolder(sample, { name: "Ghost child", audience: "student", parent_id: "nope" }).code, "parent-missing");
});
await t("validateMove: cycle, self, depth incl. subtree height, audience, duplicate at destination", () => {
  assert.equal(F.validateMove(sample, "sm", "struct").code, "cycle");
  assert.equal(F.validateMove(sample, "chem", "chem").code, "cycle");
  assert.equal(F.validateMove(sample, "chem", "ib").ok, true);
  assert.equal(F.validateMove(sample, "sm", "ib").code, "too-deep", "sm has height 3; under ib it would be depth 4");
  assert.equal(F.validateMove(sample, "maths", "chem").ok, true);
  assert.equal(F.validateMove(sample, "chem", "t-ib").code, "audience-conflict");
  assert.equal(F.validateMove(sample, "struct", null).ok, true);
  const clash = [...sample, row("ib-chem", "ib", "Chemistry")];
  assert.equal(F.validateMove(clash, "chem", "ib").code, "duplicate-name");
  assert.equal(F.validateMove(sample, "nope", null).code, "not-found");
});
await t("validateRename + validateAudienceChange (cascade deepest first, blocking cases)", () => {
  assert.equal(F.validateRename(sample, "react", "Structure").code, "duplicate-name");
  assert.equal(F.validateRename(sample, "react", "Reactivity 2").ok, true);
  const bothTree = [row("b", null, "B", { audience: "both" }), row("b1", "b", "B1", { audience: "both" }), row("b2", "b1", "B2", { audience: "both" })];
  const v = F.validateAudienceChange(bothTree, "b", "student");
  assert.deepEqual(v, { ok: true, cascade: ["b2", "b1"] });
  assert.equal(F.validateAudienceChange([row("p", null, "P", { audience: "both" }), row("c", "p", "C", { audience: "teacher" })], "p", "student").code, "audience-conflict");
  assert.equal(F.validateAudienceChange(sample, "sm", "teacher").code, "audience-conflict", "student<->teacher with sub-folders is refused");
  assert.equal(F.validateAudienceChange(sample, "chem", "both").code, "audience-conflict", "child cannot be wider than its student-only parent");
  assert.deepEqual(F.validateAudienceChange(sample, "sm", "both"), { ok: true, cascade: [] });
  assert.equal(F.validateAudienceChange(sample, "t-ib", "student").ok, true);
});
await t("reorderSiblings: swap, renumber, edges, mixed audiences share one order", () => {
  const ups = F.reorderSiblings(sample, "sm", "up"); // ib=10, sm=20, t-ib=110, shared=300
  const byId = Object.fromEntries(ups.map((u) => [u.id, u.sort_order]));
  assert.equal(byId.sm, 10); assert.equal(byId.ib, 20);
  assert.deepEqual(F.reorderSiblings(sample, "ib", "up"), [], "already first");
  assert.deepEqual(F.reorderSiblings(sample, "shared", "down"), [], "already last");
  assert.deepEqual(F.reorderSiblings(sample, "nope", "up"), []);
  const dupOrder = [row("a", null, "A"), row("b", null, "B"), row("c", null, "C")]; // all sort_order 10
  const d = Object.fromEntries(F.reorderSiblings(dupOrder, "c", "up").map((u) => [u.id, u.sort_order]));
  assert.equal(d.c, 20); assert.equal(d.b, 30, "ties are normalised to 10,20,30");
  assert.equal(F.nextSortOrder(sample, "sm"), 30); assert.equal(F.nextSortOrder(sample, "ib"), 10);
});
await t("slugify / uniqueSlug", () => {
  assert.equal(F.slugify("Maths & skills"), "maths-and-skills");
  assert.equal(F.slugify("  Ünïcode  Nämé!! "), "unicode-name");
  assert.equal(F.slugify("///"), "folder");
  assert.equal(F.uniqueSlug(sample, { parent_id: "sm", audience: "student", name: "Chemistry" }), "chemistry-2");
  assert.equal(F.uniqueSlug(sample, { parent_id: "sm", audience: "teacher", name: "Chemistry" }), "chemistry");
});
await t("audience filtering: role sees own + both; descendants of hidden folders are hidden", () => {
  const stu = F.filterFoldersForRole(sample, "student").map((r) => r.id).sort();
  assert.deepEqual(stu, ["chem", "ib", "maths", "react", "sm", "shared", "struct"].sort());
  assert.deepEqual(F.filterFoldersForRole(sample, "teacher").map((r) => r.id).sort(), ["shared", "t-ib"]);
  assert.equal(F.filterFoldersForRole(sample, "admin").length, sample.length);
  const odd = [row("p", null, "P", { audience: "teacher" }), row("c", "p", "C", { audience: "student" })]; // inconsistent data
  assert.deepEqual(F.filterFoldersForRole(odd, "student"), [], "child of a hidden parent is not shown");
});
await t("tier inheritance: most restrictive wins; premium ancestor cannot be opened up by a child/resource 'free'", () => {
  const rows = sample.map((r) => (r.id === "chem" ? { ...r, access_tier: "premium" } : r));
  const tr = F.buildTree(rows);
  assert.equal(F.effectiveTier(tr, "chem", "free"), "premium");
  assert.equal(F.effectiveTier(tr, "struct", "free"), "premium", "inherited by sub-folders");
  assert.equal(F.effectiveTier(tr, "react", "free"), "premium");
  assert.equal(F.effectiveTier(tr, "maths", "free"), "free", "sibling branch unaffected");
  assert.equal(F.effectiveTier(tr, "sm", "free"), "free", "parents are not affected by children");
  assert.equal(F.effectiveTier(tr, "maths", "premium"), "premium", "a premium resource in a free folder stays premium");
  assert.equal(F.effectiveTier(tr, null, "free"), "free");
  assert.equal(F.inheritsPremium(tr, "struct"), true); assert.equal(F.inheritsPremium(tr, "chem"), false);
});
await t("tier + accessPolicy: invisible and non-blocking while everything is free; shows when Premium is on", () => {
  const item = { tier: "premium" };
  assert.equal(tierBadge(item, DEFAULT_ACCESS_CONFIG), null);
  assert.equal(checkAccess(item, { signedIn: true, role: "student", config: DEFAULT_ACCESS_CONFIG }).allowed, true);
  const on = { premiumEnabled: true };
  assert.equal(tierBadge(item, on), "premium");
  assert.equal(checkAccess(item, { signedIn: true, role: "teacher", config: on }).allowed, false, "teacher role never grants Premium");
});

console.log("resource folders - legacy fallback and mapping");
await t("synthesizeLegacyFolders: the four historical top-level folders, flagged synthetic, same labels as resourceService", () => {
  const s = F.synthesizeLegacyFolders();
  assert.deepEqual(s.map((x) => x.name), ["IB Documents", "Study Materials", "IB Resources", "Worksheets & Other Resources"]);
  assert.deepEqual(s.map((x) => x.audience), ["student", "student", "teacher", "teacher"]);
  assert.ok(s.every((x) => x.parent_id === null && x.synthetic && F.isSyntheticFolderId(x.id)));
  const fromService = [...RS.STUDENT_CATEGORIES, ...RS.TEACHER_CATEGORIES];
  assert.deepEqual(F.LEGACY_CATEGORIES.map((c) => [c.id, c.label]), fromService.map((c) => [c.id, c.label]), "labels/ids match resourceService");
});
await t("category mapping parity with resourceService.getCategoryForAudience", () => {
  for (const cat of ["ib-documents", "study-materials", "ib-resources", "worksheets-other", "other"]) {
    for (const role of ["student", "teacher"]) assert.equal(F.legacyCategoryForRole(cat, role), RS.getCategoryForAudience({ category: cat }, role), `${cat}/${role}`);
  }
});
await t("legacy category id -> folder (deep links), real and synthetic", () => {
  const syn = F.synthesizeLegacyFolders();
  assert.equal(F.folderIdForLegacyCategory(syn, "ib-documents", "student"), "legacy:ib-documents");
  assert.equal(F.folderIdForLegacyCategory(syn, "ib-documents", "teacher"), null, "student folder not visible to a teacher");
  assert.equal(F.folderIdForLegacyCategory(syn, "worksheets-other", "teacher"), "legacy:worksheets-other");
  assert.equal(F.folderIdForLegacyCategory(sample, "study-materials", "student"), "sm");
  assert.equal(F.folderIdForLegacyCategory(sample, "nonsense", "student"), null);
});
await t("resolveResourceFolderId: folder_id wins; else legacy category; both-audience crosses schemes; unknown -> null", () => {
  const stuRows = F.filterFoldersForRole(sample, "student"), teaRows = F.filterFoldersForRole(sample, "teacher");
  assert.equal(F.resolveResourceFolderId({ folder_id: "struct", category: "ib-documents" }, stuRows, "student"), "struct");
  assert.equal(F.resolveResourceFolderId({ folderId: "chem" }, stuRows, "student"), "chem");
  assert.equal(F.resolveResourceFolderId({ category: "study-materials" }, stuRows, "student"), "sm");
  assert.equal(F.resolveResourceFolderId({ category: "ib-documents", audience: "both" }, teaRows, "teacher"), "t-ib", "both-audience student-scheme resource lands in the teacher equivalent");
  assert.equal(F.resolveResourceFolderId({ folder_id: "struct", category: "ib-documents" }, teaRows, "teacher"), "t-ib", "folder not visible to teacher -> legacy mapping");
  assert.equal(F.resolveResourceFolderId({ category: "teacher" }, teaRows, "teacher"), null);
  assert.equal(F.resolveResourceFolderId({}, stuRows, "student"), null);
  assert.equal(F.resolveResourceFolderId({ category: "ib-resources" }, sample, "admin"), "t-ib");
  assert.equal(F.resolveResourceFolderId({ category: "ib-documents" }, sample, "admin"), "ib");
});
await t("legacyCategoryForFolder: derived from the top-level folder, scheme follows resource audience; custom top-level -> audience default", () => {
  const tr = F.buildTree([...sample, row("custom", null, "Past papers", { slug: "past-papers" }), row("cc", "custom", "2025")]);
  assert.equal(F.legacyCategoryForFolder(tr, "struct", "student"), "study-materials");
  assert.equal(F.legacyCategoryForFolder(tr, "ib", "student"), "ib-documents");
  assert.equal(F.legacyCategoryForFolder(tr, "t-ib", "teacher"), "ib-resources");
  assert.equal(F.legacyCategoryForFolder(tr, "t-ib", "both"), "ib-documents", "a both-audience resource keeps the student-scheme id");
  assert.equal(F.legacyCategoryForFolder(tr, "ib", "teacher"), "ib-resources");
  assert.equal(F.legacyCategoryForFolder(tr, "cc", "student"), "study-materials");
  assert.equal(F.legacyCategoryForFolder(tr, "cc", "teacher"), "worksheets-other");
});
await t("form dropdown options per audience: full paths, in tree order, filtered", () => {
  const stu = F.folderOptionsForAudience(sample, "student").map((o) => o.label);
  assert.deepEqual(stu, ["IB Documents", "Study Materials", "Study Materials / Chemistry", "Study Materials / Chemistry / Reactivity", "Study Materials / Chemistry / Structure", "Study Materials / Maths & skills", "Shared"]);
  assert.deepEqual(F.folderOptionsForAudience(sample, "teacher").map((o) => o.label), ["IB Resources", "Shared"]);
  const both = F.folderOptionsForAudience(sample, "both").map((o) => o.label);
  assert.equal(both.length, sample.length);
  assert.ok(both.includes("IB Resources (Teachers)") && both.includes("IB Documents (Students)") && both.includes("Shared"));
  assert.deepEqual(F.folderOptionsForAudience(F.synthesizeLegacyFolders(), "student").map((o) => o.label), ["IB Documents", "Study Materials"]);
  assert.deepEqual(F.folderOptionsForAudience(F.synthesizeLegacyFolders(), "teacher").map((o) => o.label), ["IB Resources", "Worksheets & Other Resources"]);
});
await t("countResources: direct, subtree totals, unfiled", () => {
  const tr = F.buildTree(sample);
  const res = [{ id: 1, f: "struct" }, { id: 2, f: "struct" }, { id: 3, f: "chem" }, { id: 4, f: "ib" }, { id: 5, f: null }, { id: 6, f: "ghost" }];
  const c = F.countResources(tr, res, (r) => r.f);
  assert.equal(c.direct.get("struct"), 2); assert.equal(c.total.get("chem"), 3); assert.equal(c.total.get("sm"), 3);
  assert.equal(c.total.get("ib"), 1); assert.equal(c.unfiled, 2);
});

console.log("resource folders - search and sort");
const R = [
  { id: "a", title: "Molecular shapes - summary sheet", description: "VSEPR notes", createdAt: "2026-11-12T10:00:00Z", resourceType: "Notes", fileType: "PDF" },
  { id: "b", title: "VSEPR practice questions", description: "", createdAt: "2026-11-09T10:00:00Z", resourceType: "Worksheet", fileType: "PDF" },
  { id: "c", title: "lewis structures worksheet", description: "Bonding", createdAt: "2026-11-02T10:00:00Z", resourceType: "Worksheet", fileType: "DOCX", topic: "Structure 2" },
  { id: "d", title: "Atomic structure 10 notes", description: "", createdAt: null, resourceType: "Notes", fileType: "PDF" },
  { id: "e", title: "Atomic structure 2 notes", description: "", createdAt: "bad", resourceType: "Notes", fileType: "PDF" },
];
await t("search: title, description, topic, type, folder path; all words required; case-insensitive", () => {
  const path = (r) => ({ a: "Study Materials / Chemistry / Structure", b: "Study Materials / Chemistry / Structure", c: "IB Documents" }[r.id] ?? "");
  const ids = (q) => F.searchResources(R, q, path).map((r) => r.id);
  assert.deepEqual(ids("vsepr"), ["a", "b"]);
  assert.deepEqual(ids("  VSEPR   practice "), ["b"]);
  assert.deepEqual(ids("bonding"), ["c"]);
  assert.deepEqual(ids("chemistry structure"), ["a", "b"], "folder path matches");
  assert.deepEqual(ids("ib documents"), ["c"]);
  assert.deepEqual(ids("worksheet docx"), ["c"], "type + file type");
  assert.deepEqual(ids("structure 2"), ["c", "e"], "topic 'Structure 2' and 'Atomic structure 2 notes'");
  assert.deepEqual(ids("zzz"), []);
  assert.equal(ids("").length, R.length);
});
await t("sort: newest (missing dates last) and A-Z (natural numeric)", () => {
  assert.deepEqual(F.sortResources(R, "newest").map((r) => r.id), ["a", "b", "c", "d", "e"]);
  const az = F.sortResources(R, "az").map((r) => r.title);
  assert.ok(az.indexOf("Atomic structure 2 notes") < az.indexOf("Atomic structure 10 notes"), "numeric-aware");
  assert.equal(az[0], "Atomic structure 2 notes");
  assert.deepEqual(R.map((r) => r.id), ["a", "b", "c", "d", "e"], "input not mutated");
});
await t("childFolders lists sub-folders in order (null = top level)", () => {
  const tr = F.buildTree(sample);
  assert.deepEqual(F.childFolders(tr, null).map((x) => x.id), ["ib", "sm", "t-ib", "shared"]);
  assert.deepEqual(F.childFolders(tr, "chem").map((x) => x.id), ["react", "struct"]);
  assert.deepEqual(F.childFolders(tr, "ghost"), []);
});

console.log("folderService (in-memory fake, not Supabase)");
const seedRows = () => F.synthesizeLegacyFolders().map(({ synthetic, ...r }, i) => ({ ...r, id: `db-${r.slug}`, created_at: "2026-11-01T00:00:00Z" }));
await t("isMissingFolderSchemaError recognises PostgREST/Postgres missing table/column errors only", () => {
  assert.equal(isMissingFolderSchemaError({ code: "PGRST205", message: "Could not find the table 'public.resource_folders' in the schema cache" }), true);
  assert.equal(isMissingFolderSchemaError({ code: "42P01", message: 'relation "resource_folders" does not exist' }), true);
  assert.equal(isMissingFolderSchemaError({ code: "PGRST204", message: "Could not find the 'folder_id' column of 'resources'" }), true);
  assert.equal(isMissingFolderSchemaError({ code: "42501", message: "permission denied for table resource_folders" }), false);
  assert.equal(isMissingFolderSchemaError(null), false);
});
await t("loadFolders: table missing -> synthesised fallback (never throws); empty -> fallback; error -> fallback", async () => {
  let svc = createFolderService(createFakeSupabase({ foldersTableMissing: true }));
  let r = await svc.loadFolders();
  assert.equal(r.source, "fallback"); assert.equal(r.reason, "not-migrated"); assert.equal(r.folders.length, 4);
  svc = createFolderService(createFakeSupabase({ folders: [] }));
  r = await svc.loadFolders(); assert.equal(r.source, "fallback"); assert.equal(r.reason, "empty");
  r = await svc.loadFoldersForAdmin(); assert.equal(r.source, "database"); assert.deepEqual(r.folders, []); assert.equal(r.reason, "empty");
  svc = createFolderService(createFakeSupabase({ foldersError: { code: "XX000", message: "boom" } }));
  r = await svc.loadFolders(); assert.equal(r.source, "fallback"); assert.equal(r.reason, "error");
  svc = createFolderService(null);
  r = await svc.loadFolders(); assert.equal(r.reason, "not-connected"); assert.equal(r.folders.length, 4);
  svc = createFolderService(createFakeSupabase({ folders: seedRows() }));
  r = await svc.loadFolders(); assert.equal(r.source, "database"); assert.equal(r.folders.length, 4);
});
await t("writes before the migration throw a clear 'not-migrated' FolderError (no crash)", async () => {
  const svc = createFolderService(createFakeSupabase({ foldersTableMissing: true }));
  for (const call of [() => svc.createFolder({ name: "X", audience: "student" }), () => svc.renameFolder("a", "b"), () => svc.deleteFolder("a"), () => svc.reorderFolder("a", "up")]) {
    await assert.rejects(call, (e) => e instanceof FolderError && e.code === "not-migrated" && /has not been created yet/.test(e.message));
  }
});
await t("createFolder: validates, slugs, orders, stamps created_by; rejects duplicates / too deep", async () => {
  const fake = createFakeSupabase({ folders: seedRows() });
  const svc = createFolderService(fake);
  const chem = await svc.createFolder({ parent_id: "db-study-materials", name: "Chemistry", audience: "student" });
  assert.equal(chem.slug, "chemistry"); assert.equal(chem.sort_order, 10); assert.equal(chem.created_by, "admin-1"); assert.equal(chem.access_tier, "free");
  const s2 = await svc.createFolder({ parent_id: chem.id, name: "Structure", audience: "student", access_tier: "premium" });
  assert.equal(s2.access_tier, "premium");
  await assert.rejects(() => svc.createFolder({ parent_id: s2.id, name: "Too deep", audience: "student" }), (e) => e.code === "too-deep");
  await assert.rejects(() => svc.createFolder({ parent_id: "db-study-materials", name: "chemistry", audience: "student" }), (e) => e.code === "duplicate-name");
  await assert.rejects(() => svc.createFolder({ name: "", audience: "student" }), (e) => e.code === "name-required");
  const second = await svc.createFolder({ parent_id: chem.id, name: "Reactivity", audience: "student" });
  assert.equal(second.sort_order, s2.sort_order + 10);
});
await t("rename keeps the slug (stable legacy deep-link key); move updates parent and rejects cycles/depth", async () => {
  const fake = createFakeSupabase({ folders: seedRows() });
  const svc = createFolderService(fake);
  const r = await svc.renameFolder("db-ib-documents", "IB Official Documents");
  assert.equal(r.name, "IB Official Documents"); assert.equal(r.slug, "ib-documents");
  await assert.rejects(() => svc.renameFolder("db-ib-documents", "study materials"), (e) => e.code === "duplicate-name");
  const a = await svc.createFolder({ parent_id: "db-study-materials", name: "A", audience: "student" });
  const b = await svc.createFolder({ parent_id: a.id, name: "B", audience: "student" });
  await assert.rejects(() => svc.moveFolder(a.id, b.id), (e) => e.code === "cycle");
  await assert.rejects(() => svc.moveFolder("db-study-materials", b.id), (e) => e.code === "cycle");
  const moved = await svc.moveFolder(b.id, "db-ib-documents");
  assert.equal(moved.parent_id, "db-ib-documents");
  const top = await svc.moveFolder(b.id, null);
  assert.equal(top.parent_id, null);
  await assert.rejects(() => svc.moveFolder(b.id, "db-ib-resources"), (e) => e.code === "audience-conflict");
});
await t("reorderFolder swaps siblings; first/last are no-ops", async () => {
  const fake = createFakeSupabase({ folders: seedRows() });
  const svc = createFolderService(fake);
  await svc.reorderFolder("db-study-materials", "up");
  const order = (await svc.loadFoldersForAdmin()).folders.filter((f) => !f.parent_id).sort((x, y) => x.sort_order - y.sort_order).map((f) => f.slug);
  assert.deepEqual(order.slice(0, 2), ["study-materials", "ib-documents"]);
  assert.deepEqual(await svc.reorderFolder("db-study-materials", "up"), []);
});
await t("setFolderAudience cascades 'both' descendants deepest-first; blocks conflicts; setFolderTier validates", async () => {
  const fake = createFakeSupabase({ folders: seedRows() });
  const svc = createFolderService(fake);
  const p = await svc.createFolder({ name: "Shared", audience: "both" });
  const c = await svc.createFolder({ parent_id: p.id, name: "Kid", audience: "both" });
  const g = await svc.createFolder({ parent_id: c.id, name: "Grandkid", audience: "both" });
  fake.log.length = 0;
  await svc.setFolderAudience(p.id, "teacher");
  const rows = fake.db.resource_folders;
  assert.ok([p, c, g].every((x) => rows.find((r) => r.id === x.id).audience === "teacher"));
  const updates = fake.log.filter((l) => l.op === "update").map((l) => l.filters[0][1]);
  assert.deepEqual(updates, [g.id, c.id, p.id], "deepest first so every step is valid");
  await assert.rejects(() => svc.setFolderAudience("db-study-materials", "bogus"), (e) => e.code === "audience-invalid");
  assert.equal((await svc.setFolderTier("db-study-materials", "premium")).access_tier, "premium");
  await assert.rejects(() => svc.setFolderTier("db-study-materials", "gold"), (e) => e.code === "tier-invalid");
});
await t("deleteFolder: only empty; explains sub-folders / resources (incl. legacy-category resources with no folder_id)", async () => {
  const fake = createFakeSupabase({ folders: seedRows(), resources: [
    { id: "r1", category: "ib-documents", audience: "student", folder_id: null },
    { id: "r2", category: "x", audience: "student", folder_id: undefined },
  ] });
  const svc = createFolderService(fake);
  await assert.rejects(() => svc.deleteFolder("db-ib-documents"), (e) => e.code === "not-empty" && /1 resource/.test(e.message));
  const sub = await svc.createFolder({ parent_id: "db-study-materials", name: "Sub", audience: "student" });
  await assert.rejects(() => svc.deleteFolder("db-study-materials"), (e) => e.code === "not-empty" && /1 sub-folder/.test(e.message));
  fake.db.resources.push({ id: "r3", category: "study-materials", audience: "student", folder_id: sub.id });
  await assert.rejects(() => svc.deleteFolder(sub.id), (e) => e.code === "not-empty" && /1 resource/.test(e.message));
  fake.db.resources = fake.db.resources.filter((r) => r.id !== "r3");
  await svc.deleteFolder(sub.id);
  assert.ok(!fake.db.resource_folders.some((f) => f.id === sub.id));
  await assert.rejects(() => svc.deleteFolder("ghost"), (e) => e.code === "not-found");
});
await t("seedLegacyFolders is idempotent", async () => {
  const fake = createFakeSupabase({ folders: [] });
  const svc = createFolderService(fake);
  assert.equal((await svc.seedLegacyFolders()).length, 4);
  assert.equal((await svc.seedLegacyFolders()).length, 0);
  assert.equal(fake.db.resource_folders.length, 4);
});

console.log("resourceService - folder_id compatibility");
await t("createResource/updateResource retry without folder_id when the column is missing; send it when present", async () => {
  let fake = createFakeSupabase({ folderIdColumnMissing: true });
  globalThis.__rfSupabase = fake;
  const base = { title: "T", audience: "student", category: "study-materials", resource_type: "Notes", status: "draft" };
  const made = await RS.createResource({ ...base, folder_id: "f1" });
  assert.equal(made.title, "T"); assert.ok(!("folder_id" in made), "retried without folder_id");
  const upd = await RS.updateResource(made.id, { title: "T2", folder_id: "f1" });
  assert.equal(upd.title, "T2");
  fake = createFakeSupabase({}); globalThis.__rfSupabase = fake;
  const made2 = await RS.createResource({ ...base, folder_id: "f1" });
  assert.equal(made2.folder_id, "f1"); assert.equal(made2.created_by, "admin-1");
  const bad = createFakeSupabase({}); bad.from = () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: "42501", message: "denied" } }) }) }) });
  globalThis.__rfSupabase = bad;
  await assert.rejects(() => RS.createResource({ ...base, folder_id: "f1" }), (e) => e.code === "42501", "other errors are surfaced, not swallowed");
});
await t("storage path scheme is unchanged: <audience>/<category>/<uuid><ext>", async () => {
  const uploads = [];
  globalThis.__rfSupabase = { storage: { from: () => ({ upload: async (path) => { uploads.push(path); return { error: null }; } }) } };
  const file = { name: "Notes v2.PDF", size: 100, type: "application/pdf" };
  const out = await RS.uploadResourceFile(file, { audience: "teacher", category: "ib-resources" });
  assert.match(out.filePath, /^teacher\/ib-resources\/[0-9a-f-]{36}\.PDF$/);
  assert.equal(uploads[0], out.filePath);
});

console.log(`\n${n} checks run${process.exitCode ? " - FAILURES above" : " - all passed"}`);
