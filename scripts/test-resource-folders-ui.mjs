#!/usr/bin/env node
// jsdom UI tests for the folder-based Resources pages:  node scripts/test-resource-folders-ui.mjs
// Renders the REAL Student/Teacher Resources pages, the Admin Folders page, the Add-resource form and the
// Admin Resources list into jsdom, against an in-memory fake Supabase (scripts/resource-folders-fake-supabase.mjs;
// src/lib/supabaseClient.js and the AuthContext are replaced by the loader hooks).  Each page is run BEFORE the
// migration (folders table missing -> fallback) and AFTER it (real rows).
// Honest limits: jsdom has no layout/CSS (responsive collapse, overflow, theming are checked by
// scripts/verify-resource-folders.mjs in Chromium); the fake is not Supabase (no RLS/PostgREST/Storage).
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLAnchorElement", "Node", "Element", "MouseEvent", "KeyboardEvent", "Event", "MutationObserver", "getComputedStyle", "SVGElement"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
for (const k of ["sessionStorage", "localStorage", "navigator"]) Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true });
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const opened = [];
dom.window.open = (...a) => { opened.push(a); return null; };
const errors = [];
const origErr = console.error; console.error = (...a) => { errors.push(a.join(" ")); };

register("./resource-folders-loader-hooks.mjs", import.meta.url);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route, Outlet, useLocation } = await import("react-router-dom");
const { createFakeSupabase } = await import("./resource-folders-fake-supabase.mjs");
const F = await import("../src/lib/resourceFolders.js");
const { default: ResourcesLanding } = await import("../src/pages/student/resources/ResourcesLanding.jsx");
const { default: CategoryPage } = await import("../src/pages/student/resources/CategoryPage.jsx");
const { default: TeacherResources } = await import("../src/pages/teacher/Resources.jsx");
const { default: AdminFolders } = await import("../src/pages/admin/folders/AdminFolders.jsx");
const { default: AdminResources } = await import("../src/pages/admin/resources/AdminResources.jsx");
const { default: ResourceForm } = await import("../src/pages/admin/resources/ResourceForm.jsx");
const { default: ResourceBrowser } = await import("../src/components/resources/ResourceBrowser.jsx");

const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const click = async (el) => { assert.ok(el, "click target missing"); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await wait(); };
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await wait(20); } };
const key = async (el, k) => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); await wait(10); };
async function setValue(el, value) {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  await wait(10);
}
const byText = (sel, text, root = document) => $$(sel, root).find((e) => norm(e.textContent) === text || norm(e.textContent).startsWith(text));
const treeItems = () => $$('[role="treeitem"]').map((e) => norm(e.querySelector("div")?.textContent ?? e.textContent));
const treeLabel = (name) => $$('[role="treeitem"]').find((e) => norm(e.querySelector(":scope > div span.truncate")?.textContent) === name);
const rowTitles = () => $$('[data-testid="resource-row"]').map((r) => norm(r.querySelector("p")?.textContent));
const folderRows = () => $$('[data-testid="folder-row"]').map((r) => $$("span.block", r).map((x) => norm(x.textContent)).join(" "));
const clickTree = (name) => click(treeLabel(name).querySelector(":scope > div"));
const crumbs = () => $$('nav[aria-label="Breadcrumb"] button').map((b) => norm(b.textContent));

let root, n = 0;
async function mount(element, entry, { fake, auth = { isConfigured: true, profile: { level: "HL" } } } = {}) {
  globalThis.__rfSupabase = fake; globalThis.__rfAuth = auth; errors.length = 0; opened.length = 0;
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root"));
  root.render(React.createElement(MemoryRouter, { initialEntries: [entry] }, element));
  await wait(60);
  // wait until every loader has finished (spinner gone, folder select no longer "Loading") - avoids timing flakiness
  for (let i = 0; i < 150 && (document.querySelector(".animate-spin") || /Loading folders/.test(document.body.textContent)); i += 1) await wait(20);
  await wait(30);
}
const unmount = async () => { root?.unmount(); root = null; await wait(10); };
async function t(name, fn) { try { await fn(); n += 1; console.log(`  ok   ${name}`); } catch (e) { console.log(`  FAIL ${name}\n       ${e.stack?.split("\n").slice(0, 14).join("\n       ")}`); process.exitCode = 1; } finally { await unmount(); } }

// ---- fixtures -----------------------------------------------------------------------------------------
const res = (id, extra) => ({ id, title: id, description: "", audience: "student", category: "study-materials", resource_type: "Notes", status: "published", is_locked: false, access_tier: "free", mime_type: "application/pdf", file_path: `student/study-materials/${id}.pdf`, external_url: null, file_size: 2048, created_at: "2026-11-01T00:00:00Z", level: null, topic: null, subtopic: null, ...extra });
const resources = () => [
  res("Molecular shapes", { created_at: "2026-11-12T00:00:00Z", description: "VSEPR summary" }),
  res("Lewis worksheet", { created_at: "2026-11-02T00:00:00Z", category: "ib-documents", file_path: "student/ib-documents/l.pdf", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
  res("Syllabus link", { created_at: "2026-11-05T00:00:00Z", category: "ib-documents", file_path: null, external_url: "https://example.org/syllabus", mime_type: null }),
  res("Locked notes", { created_at: "2026-11-03T00:00:00Z", is_locked: true }),
  res("Teacher plan", { audience: "teacher", category: "ib-resources", file_path: "teacher/ib-resources/p.pdf", created_at: "2026-11-04T00:00:00Z" }),
  res("Shared guide", { audience: "both", category: "ib-documents", file_path: "student/ib-documents/g.pdf", created_at: "2026-11-06T00:00:00Z" }),
  res("Weird category", { audience: "student", category: "other-thing", created_at: "2026-11-07T00:00:00Z" }),
];
const f = (id, parent_id, name, extra = {}) => ({ id, parent_id, audience: "student", name, slug: F.slugify(name), sort_order: 10, access_tier: "free", created_at: "2026-11-01T00:00:00Z", ...extra });
const realFolders = () => [
  f("ibd", null, "IB Documents", { slug: "ib-documents", sort_order: 10 }),
  f("sm", null, "Study Materials", { slug: "study-materials", sort_order: 20 }),
  f("chem", "sm", "Chemistry"),
  f("struct", "chem", "Structure", { sort_order: 20, access_tier: "premium" }),
  f("react", "chem", "Reactivity", { sort_order: 10 }),
  f("tib", null, "IB Resources", { audience: "teacher", slug: "ib-resources", sort_order: 110 }),
  f("tws", null, "Worksheets & Other Resources", { audience: "teacher", slug: "worksheets-other", sort_order: 120 }),
  f("shared", null, "Shared", { audience: "both", sort_order: 300 }),
];
const realResources = () => resources().map((r) => (r.id === "Molecular shapes" ? { ...r, folder_id: "struct" } : r.id === "Lewis worksheet" ? { ...r, folder_id: "ibd" } : r));
const pre = () => createFakeSupabase({ foldersTableMissing: true, folderIdColumnMissing: true, resources: resources().filter(() => true) });
const post = () => createFakeSupabase({ folders: realFolders(), resources: realResources() });

const studentApp = (initial) => React.createElement(Routes, null,
  React.createElement(Route, { path: "/student/resources", element: React.createElement(ResourcesLanding) }),
  React.createElement(Route, { path: "/student/resources/:categoryId", element: React.createElement(CategoryPage) }));
const Where = () => React.createElement("span", { "data-testid": "where" }, useLocation().pathname + useLocation().search);
const withWhere = (el) => React.createElement(React.Fragment, null, el, React.createElement(Where));

console.log("student resources - BEFORE the migration (folders table missing -> fallback)");
await t("falls back to the two legacy student folders; teacher-only resources and teacher folders are hidden", async () => {
  await mount(withWhere(studentApp()), "/student/resources", { fake: pre() });
  assert.equal($('[data-testid="resource-browser"]').dataset.folderSource, "fallback");
  assert.deepEqual($$('[role="treeitem"] span.truncate').map((e) => norm(e.textContent)), ["All resources", "IB Documents", "Study Materials"]);
  assert.deepEqual(folderRows(), ["IB Documents Folder · 3 items", "Study Materials Folder · 2 items"]);
  assert.ok(!rowTitles().includes("Teacher plan"));
  assert.deepEqual(rowTitles(), ["Weird category"], "resource with an unknown category is shown under All resources, not lost");
  assert.deepEqual(errors, []);
});
await t("open a folder: breadcrumb, files sorted newest first, View/Open actions, no tier chips", async () => {
  await mount(withWhere(studentApp()), "/student/resources", { fake: pre() });
  await click(byText('[data-testid="folder-row"]', "IB Documents"));
  assert.deepEqual(crumbs(), ["All resources", "IB Documents"]);
  assert.deepEqual(rowTitles(), ["Shared guide", "Syllabus link", "Lewis worksheet"]);
  assert.equal($('a[aria-label="View Syllabus link in a new tab"]').getAttribute("href"), "https://example.org/syllabus");
  assert.ok(!byText('[data-testid="resource-row"]', "Syllabus link").querySelector('[data-testid="resource-download"]'), "external link: eye only, no download button");
  assert.ok(!/Premium|Free/.test(document.body.textContent.replace(/Free/g, "") ) || !/Premium/.test(document.body.textContent), "no Premium chrome while everything is free");
  assert.match($('[data-testid="where"]').textContent, /folder=legacy%3Aib-documents|folder=legacy:ib-documents/);
});
await t("deep links: legacy category ids open that folder; other-scheme id maps; unknown id redirects", async () => {
  await mount(withWhere(studentApp()), "/student/resources/study-materials", { fake: pre() });
  assert.deepEqual(crumbs(), ["All resources", "Study Materials"]);
  assert.deepEqual(rowTitles(), ["Molecular shapes", "Locked notes"]);
  await unmount();
  await mount(withWhere(studentApp()), "/student/resources/ib-documents", { fake: pre() });
  assert.deepEqual(crumbs(), ["All resources", "IB Documents"]);
  await unmount();
  await mount(withWhere(studentApp()), "/student/resources/ib-resources", { fake: pre() });
  assert.deepEqual(crumbs(), ["All resources", "IB Documents"], "teacher-scheme id maps to its student equivalent");
  await unmount();
  await mount(withWhere(studentApp()), "/student/resources/nonsense", { fake: pre() });
  assert.equal($('[data-testid="where"]').textContent, "/student/resources", "unknown category redirects to the landing page");
});
await t("View (eye) uses the signed-URL logic in a new tab; locked resources have no actions; external opens in a new tab", async () => {
  await mount(withWhere(studentApp()), "/student/resources/study-materials", { fake: pre() });
  const view = $('button[aria-label="View Molecular shapes in a new tab"]');
  const tab = { opener: "set", closed: false, location: { replace(u) { tab.url = u; } }, close() { tab.closed = true; } };
  dom.window.open = (...a) => { opened.push(a); return tab; };
  await click(view); await wait(30);
  assert.deepEqual(opened[0], ["", "_blank"], "the tab is opened synchronously and blank (no URL yet)");
  assert.equal(tab.opener, null, "opener cut so the new page cannot reach this one");
  assert.equal(tab.url, "https://signed.example/student/study-materials/Molecular shapes.pdf");
  dom.window.open = (...a) => { opened.push(a); return null; };
  const locked = byText('[data-testid="resource-row"]', "Locked notes");
  assert.ok(locked.textContent.includes("Locked") && !locked.querySelector("a"), "locked resource: lock indicator, no link");
});
await t("search across all folders (title/description/folder path), clear, sort A-Z", async () => {
  await mount(withWhere(studentApp()), "/student/resources/study-materials", { fake: pre() });
  const input = $('input[aria-label="Search all resources"]');
  await setValue(input, "vsepr");
  assert.deepEqual(rowTitles(), ["Molecular shapes"], "matches description");
  assert.match(norm($('[role="status"]').textContent), /1 result for .vsepr. in all folders/);
  await setValue(input, "ib documents");
  assert.deepEqual(rowTitles(), ["Shared guide", "Syllabus link", "Lewis worksheet"], "matches folder path, across folders");
  assert.ok(byText('[data-testid="resource-row"]', "Lewis worksheet").textContent.includes("IB Documents"), "row shows its folder path while searching");
  await setValue(input, "zzzz");
  assert.match(document.body.textContent, /No resources match your search/);
  await setValue(input, "");
  assert.deepEqual(crumbs(), ["All resources", "Study Materials"], "search cleared -> folder view");
  await click(byText('[data-testid="folder-row"]', "x") ?? $('button[aria-label="Clear search"]') ?? document.body);
  await setValue($('select[aria-label="Sort resources"]'), "az");
  assert.deepEqual(rowTitles(), ["Locked notes", "Molecular shapes"]);
});
console.log("student resources - AFTER the migration (real folder rows)");
await t("nested tree with treeitem semantics; subfolders listed before files; counts; premium folder shows no chip", async () => {
  await mount(withWhere(studentApp()), "/student/resources", { fake: post() });
  assert.equal($('[data-testid="resource-browser"]').dataset.folderSource, "database");
  const tree = $('[role="tree"]'); assert.ok(tree);
  assert.ok($$('[role="treeitem"]').every((i) => i.hasAttribute("aria-selected")));
  assert.equal(treeLabel("IB Documents").getAttribute("aria-level"), "1");
  await clickTree("Study Materials");
  assert.equal(treeLabel("Study Materials").getAttribute("aria-expanded"), "true");
  assert.equal(treeLabel("Chemistry").getAttribute("aria-level"), "2");
  await clickTree("Chemistry");
  assert.equal(treeLabel("Structure").getAttribute("aria-level"), "3");
  assert.deepEqual(folderRows(), ["Reactivity Folder · 0 items", "Structure Folder · 1 item"], "sub-folders in sort order, with item counts");
  await clickTree("Structure");
  assert.deepEqual(crumbs(), ["All resources", "Study Materials", "Chemistry", "Structure"]);
  assert.deepEqual(rowTitles(), ["Molecular shapes"]);
  assert.ok(!/Premium/.test(document.body.textContent), "premium folder: no badge/lock while everything is free");
  assert.ok($('button[aria-label="View Molecular shapes in a new tab"]'), "and nothing is blocked");
  assert.ok($('button[aria-label="Download Molecular shapes"]'), "download is available too");
  // sub-folders come before files in the same list
  await click($('nav[aria-label="Breadcrumb"] button:nth-of-type(1)'));
  await click(byText('[data-testid="folder-row"]', "Study Materials"));
  const items = $$('ul.mt-3 > li').map((li) => (li.querySelector('[data-testid="folder-row"]') ? "folder" : "file"));
  assert.deepEqual(items, ["folder", "file"], "the Chemistry sub-folder comes first, then the folder's own file (Locked notes)");
});
await t("keyboard: roving tabindex, Arrow Down/Up, Right expands/enters, Left collapses/goes to parent, Home/End, Enter selects", async () => {
  await mount(withWhere(studentApp()), "/student/resources", { fake: post() });
  const items = () => $$('[role="treeitem"]');
  assert.equal(items().filter((i) => i.tabIndex === 0).length, 1, "single tab stop");
  items()[0].focus();
  await key(items()[0], "ArrowDown");
  assert.equal(document.activeElement.querySelector("span.truncate").textContent, "IB Documents");
  await key(document.activeElement, "ArrowDown");
  const sm = document.activeElement; assert.equal(norm(sm.querySelector("span.truncate").textContent), "Study Materials");
  assert.equal(sm.getAttribute("aria-expanded"), "false");
  await key(sm, "ArrowRight"); assert.equal(sm.getAttribute("aria-expanded"), "true");
  await key(sm, "ArrowRight"); assert.equal(norm(document.activeElement.querySelector("span.truncate").textContent), "Chemistry");
  await key(document.activeElement, "ArrowLeft"); assert.equal(norm(document.activeElement.querySelector("span.truncate").textContent), "Study Materials", "Left on a leaf/closed item goes to the parent");
  await key(document.activeElement, "ArrowLeft"); assert.equal(treeLabel("Study Materials").getAttribute("aria-expanded"), "false");
  await key(document.activeElement, "End"); assert.equal(norm(document.activeElement.querySelector("span.truncate").textContent), "Shared", "End = last visible item");
  await key(document.activeElement, "Home"); assert.equal(norm(document.activeElement.querySelector("span.truncate").textContent), "All resources");
  await key(document.activeElement, "ArrowDown"); await key(document.activeElement, "ArrowDown"); await key(document.activeElement, "Enter");
  assert.deepEqual(crumbs(), ["All resources", "Study Materials"]);
  assert.equal(treeLabel("Study Materials").getAttribute("aria-selected"), "true");
});
await t("narrow-screen folder picker lists full paths and selects a folder", async () => {
  await mount(withWhere(studentApp()), "/student/resources", { fake: post() });
  const picker = $("#folder-picker");
  assert.deepEqual([...picker.options].map((o) => o.textContent), ["All resources", "IB Documents", "Study Materials", "Study Materials / Chemistry", "Study Materials / Chemistry / Reactivity", "Study Materials / Chemistry / Structure", "Shared"]);
  await setValue(picker, "struct");
  assert.deepEqual(crumbs(), ["All resources", "Study Materials", "Chemistry", "Structure"]);
  assert.equal(picker.value, "struct");
});
await t("deep link by legacy id still works with real folders; resource whose folder_id is set is shown there, others by category", async () => {
  await mount(withWhere(studentApp()), "/student/resources/ib-documents", { fake: post() });
  assert.deepEqual(crumbs(), ["All resources", "IB Documents"]);
  assert.deepEqual(rowTitles(), ["Shared guide", "Syllabus link", "Lewis worksheet"]);
});
await t("a 'both' resource appears for students and for teachers (category mapped across schemes)", async () => {
  await mount(withWhere(studentApp()), "/student/resources/ib-documents", { fake: post() });
  assert.ok(rowTitles().includes("Shared guide"));
  await unmount();
  const Outlet2 = () => React.createElement(Outlet, { context: { subject: { label: "IB Chemistry" } } });
  const app = React.createElement(Routes, null, React.createElement(Route, { element: React.createElement(Outlet2) }, React.createElement(Route, { path: "/teacher/resources", element: React.createElement(TeacherResources) })));
  await mount(app, "/teacher/resources", { fake: post(), auth: { isConfigured: true, profile: {} } });
  assert.deepEqual($$('[role="treeitem"] span.truncate').map((e) => norm(e.textContent)), ["All resources", "IB Resources", "Worksheets & Other Resources", "Shared"]);
  await click(byText('[data-testid="folder-row"]', "IB Resources"));
  assert.deepEqual(rowTitles().sort(), ["Shared guide", "Teacher plan"].sort());
  assert.match(document.body.textContent, /IB Chemistry supporting material/);
});
await t("teacher page BEFORE the migration: two legacy teacher folders, same resources as before", async () => {
  const Outlet2 = () => React.createElement(Outlet, { context: { subject: { label: "IB Chemistry" } } });
  const app = React.createElement(Routes, null, React.createElement(Route, { element: React.createElement(Outlet2) }, React.createElement(Route, { path: "/teacher/resources", element: React.createElement(TeacherResources) })));
  await mount(app, "/teacher/resources", { fake: pre(), auth: { isConfigured: true, profile: {} } });
  assert.deepEqual($$('[role="treeitem"] span.truncate').map((e) => norm(e.textContent)), ["All resources", "IB Resources", "Worksheets & Other Resources"]);
  await click(byText('[data-testid="folder-row"]', "IB Resources"));
  assert.deepEqual(rowTitles().sort(), ["Shared guide", "Teacher plan"].sort());
  assert.deepEqual(errors, []);
});
await t("when Premium is switched on (config), the tier chip and lock appear only through accessPolicy", async () => {
  const fake = createFakeSupabase({ folders: realFolders(), resources: realResources() });
  const mk = (cfg) => React.createElement(Routes, null, React.createElement(Route, { path: "/x", element: React.createElement(ResourceBrowser, { role: "student", accessConfig: cfg, resources: [{ id: "m", title: "Molecular shapes", folderId: "struct", fileType: "PDF", needsSignedUrl: true, supabaseFilePath: "p.pdf", accessTier: "free" }] }) }));
  await mount(mk({ premiumEnabled: true }), "/x?folder=struct", { fake });
  const row = $('[data-testid="resource-row"]');
  assert.ok(/Premium/.test(row.textContent), "premium folder -> chip shown when switch is on");
  assert.ok(!row.querySelector("a"), "no View for a student without entitlement once Premium is on");
});

console.log("admin folders page");
await t("BEFORE the migration: clear notice, standard folders shown read-only, write controls disabled, no crash", async () => {
  await mount(React.createElement(AdminFolders), "/admin/folders", { fake: pre() });
  assert.match(norm($('[data-testid="folders-notice"]').textContent), /folders table has not been created yet/);
  assert.deepEqual($$('[role="treeitem"] span.truncate').map((e) => norm(e.textContent)), ["IB Documents", "Study Materials", "IB Resources", "Worksheets & Other Resources"]);
  assert.equal(byText("button", "New folder").disabled, true);
  await click(treeLabel("Study Materials").querySelector("div"));
  const d = $('[data-testid="folder-details"]');
  assert.ok(d);
  for (const el of $$("input, select", d)) assert.equal(el.disabled, true, `${el.id} disabled`);
  for (const b of $$("button", d)) assert.equal(b.disabled, true, `${norm(b.textContent)} disabled`);
  assert.deepEqual(errors, []);
});
await t("AFTER: tree with counts/audience chips; create top-level and sub-folder; duplicate/depth errors are explained", async () => {
  const fake = post(); await mount(React.createElement(AdminFolders), "/admin/folders", { fake });
  assert.equal($('[data-testid="folders-notice"]'), null);
  assert.ok(treeLabel("Shared").textContent.includes("Both"));
  assert.ok(treeLabel("IB Resources").textContent.includes("Teachers"));
  assert.ok(treeLabel("Structure") == null, "collapsed until expanded");
  await click(byText("button", "New folder"));
  await setValue($("#nf-name"), "Past papers");
  await click(byText("button", "Create folder")); await until(() => $('[data-testid="folder-details"]'));
  assert.ok(fake.db.resource_folders.some((r) => r.name === "Past papers" && r.parent_id === null && r.slug === "past-papers"));
  assert.ok(treeLabel("Past papers"), "new folder appears in the tree");
  assert.match(norm($('[data-testid="folder-details"]').textContent), /Folder: Past papers/);
  await click(byText("button", "Add sub-folder"));
  await setValue($("#nf-name"), "2025");
  await click(byText("button", "Create folder")); await until(() => $('[data-testid="folder-details"]'));
  assert.ok(fake.db.resource_folders.some((r) => r.name === "2025"));
  // duplicate
  await clickTree("Past papers");
  await click(byText("button", "Add sub-folder"));
  await setValue($("#nf-name"), "2025");
  await click(byText("button", "Create folder"));
  assert.match($('[role="alert"]').textContent, /already exists/, "duplicate name is explained");
  // depth limit: Study Materials / Chemistry / Structure is level 3 -> Add sub-folder is disabled there
  await clickTree("Study Materials"); await clickTree("Chemistry"); await clickTree("Structure");
  assert.equal(byText("button", "Add sub-folder").disabled, true);
});
await t("AFTER: lock toggle - a locked folder's contents show 'locked via folder'; a child cannot be opened up by unlocking it alone", async () => {
  const fake = createFakeSupabase({ folders: [f("p", null, "Premium pack", { access_tier: "premium" }), f("c", "p", "Week 1")], resources: [] });
  await mount(React.createElement(AdminFolders), "/admin/folders", { fake });
  assert.equal($$('[data-testid="locked-via-folder"]').length, 0, "child hidden in the collapsed tree until expanded");
  await clickTree("Premium pack");
  assert.equal($("#fd-lock").getAttribute("aria-pressed"), "true");
  assert.equal($("#fd-lock").getAttribute("aria-label"), "Premium lock for Premium pack");
  assert.equal(norm($('[data-testid="lock-state"]').textContent), "Locked for Premium");
  assert.match(norm($('[data-testid="lock-inherit"]').textContent), /Everything inside .* inherits this lock/);
  await clickTree("Week 1");
  assert.equal($("#fd-lock").getAttribute("aria-pressed"), "false", "the child's own toggle is unlocked");
  assert.ok($('[data-testid="locked-via-folder"]'), "tree row says locked via folder");
  assert.match(norm($('[data-testid="lock-inherit"]').textContent), /Locked via folder "Premium pack"/);
  await click($("#fd-lock")); await wait(60);
  assert.equal(fake.db.resource_folders.find((r) => r.id === "c").access_tier, "premium", "payload is the unchanged 'premium' tier value");
  await click($("#fd-lock")); await wait(60);
  assert.equal(fake.db.resource_folders.find((r) => r.id === "c").access_tier, "free");
});
await t("BEFORE migration: the lock toggle is disabled (folders table missing)", async () => {
  await mount(React.createElement(AdminFolders), "/admin/folders", { fake: pre() });
  await clickTree("IB Documents");
  assert.equal($("#fd-lock").disabled, true);
});
await t("AFTER: rename, audience, access level (helper text says Premium is not active), reorder, move", async () => {
  const fake = post(); await mount(React.createElement(AdminFolders), "/admin/folders", { fake });
  await click(treeLabel("IB Documents").querySelector("div"));
  await setValue($("#fd-name"), "IB Official"); await click(byText("button", "Rename"));
  assert.equal(fake.db.resource_folders.find((r) => r.id === "ibd").name, "IB Official");
  assert.equal(fake.db.resource_folders.find((r) => r.id === "ibd").slug, "ib-documents", "slug is stable");
  assert.match(norm($('[data-testid="tier-help"]').textContent), /Premium is not active yet/);
  assert.equal($("#fd-tier"), null, "the Access dropdown is gone");
  const lockBtn = () => $("#fd-lock");
  assert.equal(lockBtn().getAttribute("aria-pressed"), "false"); assert.equal(lockBtn().getAttribute("title"), "Lock for Premium");
  await click(lockBtn()); await wait(60);
  assert.equal(fake.db.resource_folders.find((r) => r.id === "ibd").access_tier, "premium");
  assert.equal(lockBtn().getAttribute("aria-pressed"), "true"); assert.equal(lockBtn().getAttribute("title"), "Unlock (free)");
  assert.ok(treeLabel("IB Official").textContent.includes("Premium"), "admin sees the saved tier");
  await setValue($("#fd-audience"), "both"); await wait(60);
  assert.equal(fake.db.resource_folders.find((r) => r.id === "ibd").audience, "both");
  const moveOpts = [...$("#fd-move").options].map((o) => o.textContent);
  assert.ok(moveOpts.includes("Shared") && !moveOpts.includes("Study Materials"), "a 'both' folder can only go under a 'both' parent");
  await setValue($("#fd-audience"), "student"); await wait(60);
  await click($('button[aria-label="Move IB Official down"]'));
  const order = fake.db.resource_folders.filter((r) => !r.parent_id).sort((a, b) => a.sort_order - b.sort_order).map((r) => r.id);
  assert.equal(order[0], "sm"); assert.equal(order[1], "ibd");
  const opts = [...$("#fd-move").options].map((o) => o.textContent);
  assert.ok(opts.includes("Study Materials / Chemistry") && !opts.includes("IB Official"), "valid destinations only");
  await setValue($("#fd-move"), "sm"); await click(byText("button", "Move"));
  assert.equal(fake.db.resource_folders.find((r) => r.id === "ibd").parent_id, "sm");
});
await t("AFTER: delete only when empty, with a clear explanation; empty folder deletes after confirmation", async () => {
  const fake = post(); await mount(React.createElement(AdminFolders), "/admin/folders", { fake });
  await click(treeLabel("Study Materials").querySelector("div"));
  assert.match(norm($('[data-testid="delete-blocked"]').textContent), /Can't delete: This folder has 1 sub-folder/);
  assert.ok(!byText("button", "Delete folder"));
  await click(treeLabel("IB Documents").querySelector("div"));
  assert.match(norm($('[data-testid="delete-blocked"]').textContent), /contains 2 resources|contains 3 resources/, "legacy-category resources count too");
  await click(byText("button", "New folder")); await setValue($("#nf-name"), "Empty one"); await click(byText("button", "Create folder"));
  await until(() => byText("button", "Delete folder"));
  await click(byText("button", "Delete folder")); await click(byText("button", "Delete folder")); await until(() => !fake.db.resource_folders.some((r) => r.name === "Empty one"));
  assert.ok(!fake.db.resource_folders.some((r) => r.name === "Empty one"));
});
await t("AFTER but empty table: explains and offers the four standard folders", async () => {
  const fake = createFakeSupabase({ folders: [], resources: resources() }); await mount(React.createElement(AdminFolders), "/admin/folders", { fake });
  assert.match(document.body.textContent, /folders table is empty/);
  await click(byText("button", "Create the four standard folders"));
  assert.equal(fake.db.resource_folders.length, 4);
});

console.log("add-resource form + admin resources list");
await t("form: Folder dropdown (full paths) filtered by audience; saves folder_id + derived legacy category; storage path scheme unchanged", async () => {
  const fake = post(); let saved = null;
  await mount(React.createElement(ResourceForm, { resource: null, onClose() {}, onSaved: (r) => { saved = r; } }), "/", { fake });
  assert.ok(!$("#rf-category"), "the old Category select is gone");
  const labels = () => [...$("#rf-folder").options].map((o) => o.textContent);
  assert.deepEqual(labels(), ["IB Documents", "Study Materials", "Study Materials / Chemistry", "Study Materials / Chemistry / Reactivity", "Study Materials / Chemistry / Structure", "Shared"]);
  await setValue($("#rf-audience"), "teacher");
  assert.deepEqual(labels(), ["IB Resources", "Worksheets & Other Resources", "Shared"]);
  await setValue($("#rf-audience"), "both");
  assert.ok(labels().includes("IB Resources (Teachers)") && labels().includes("Study Materials / Chemistry / Structure (Students)"));
  await setValue($("#rf-audience"), "student");
  await setValue($("#rf-folder"), "struct");
  await setValue($("#rf-title"), "New sheet"); await setValue($('input[type="url"]'), "https://example.org/x");
  await click(byText("button", "Add Resource"));
  assert.ok(saved, `saved (error: ${$('[role="alert"]')?.textContent})`);
  assert.equal(saved.folder_id, "struct"); assert.equal(saved.category, "study-materials");
});
await t("form: file upload goes to <audience>/<legacy category>/<uuid>.ext (no folder in the path)", async () => {
  const fake = post(); const uploads = [];
  fake.storage = { from: () => ({ upload: async (p) => { uploads.push(p); return { error: null }; }, createSignedUrl: async () => ({ data: { signedUrl: "u" }, error: null }) }) };
  await mount(React.createElement(ResourceForm, { resource: null, onClose() {}, onSaved() {} }), "/", { fake });
  await setValue($("#rf-folder"), "react"); await setValue($("#rf-title"), "Upload me");
  const input = $('input[type="file"]');
  const file = new dom.window.File(["x"], "My Notes.pdf", { type: "application/pdf" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true })); await wait();
  await click(byText("button", "Add Resource"));
  assert.match(uploads[0] ?? "none", /^student\/study-materials\/[0-9a-f-]{36}\.pdf$/);
});
await t("form BEFORE the migration: synthesised folders, no folder_id sent, legacy category written, no error", async () => {
  const fake = pre(); let saved = null;
  await mount(React.createElement(ResourceForm, { resource: null, onClose() {}, onSaved: (r) => { saved = r; } }), "/", { fake });
  assert.deepEqual([...$("#rf-folder").options].map((o) => o.textContent), ["IB Documents", "Study Materials"]);
  assert.match(document.body.textContent, /standard categories until the folders update is applied/);
  await setValue($("#rf-audience"), "teacher"); await setValue($("#rf-folder"), "legacy:worksheets-other");
  await setValue($("#rf-title"), "T"); await setValue($('input[type="url"]'), "https://example.org/x");
  await click(byText("button", "Add Resource"));
  assert.ok(saved, `saved (${$('[role="alert"]')?.textContent})`);
  assert.equal(saved.category, "worksheets-other"); assert.ok(!("folder_id" in saved));
  assert.ok(!fake.log.some((l) => l.table === "resources" && l.op === "insert" && l.payload && "folder_id" in l.payload), "folder_id never sent before migration");
});
await t("form edit: unrelated edit keeps the stored category; unresolvable legacy category is preserved", async () => {
  const fake = post(); let saved = null;
  const existing = { ...realResources().find((r) => r.id === "Shared guide") }; fake.db.resources.push(existing);
  await mount(React.createElement(ResourceForm, { resource: existing, onClose() {}, onSaved: (r) => { saved = r; } }), "/", { fake });
  assert.equal($("#rf-folder").value, "ibd", "category ib-documents resolves to the IB Documents folder");
  await setValue($("#rf-title"), "Shared guide v2"); await click(byText("button", "Save changes"));
  assert.equal(saved.category, "ib-documents", "category untouched on an unrelated edit");
  await unmount();
  const weird = realResources().find((r) => r.id === "Weird category"); fake.db.resources.push(weird);
  saved = null;
  await mount(React.createElement(ResourceForm, { resource: weird, onClose() {}, onSaved: (r) => { saved = r; } }), "/", { fake });
  assert.equal($("#rf-folder").value, ""); assert.match($("#rf-folder").options[0].textContent, /Keep current category \(other-thing\)/);
  await click(byText("button", "Save changes"));
  assert.equal(saved.category, "other-thing");
});
await t("admin resources list: Folder filter (incl. sub-folders) replaces Category; category fallback", async () => {
  const fake = post();
  await mount(React.createElement(AdminResources), "/admin/resources", { fake });
  assert.ok(!$('select[aria-label="Category"]'));
  const sel = $('select[aria-label="Folder"]');
  const opts = [...sel.options].map((o) => o.textContent);
  assert.equal(opts[0], "Folder: All"); assert.ok(opts.includes("Study Materials / Chemistry / Structure (Students)"));
  assert.ok(opts.includes("other-thing (no folder)"), "legacy category with no folder stays filterable");
  const titles = () => $$("p.truncate").map((e) => norm(e.textContent));
  await setValue(sel, "chem"); assert.deepEqual(titles(), ["Molecular shapes"], "folder filter includes sub-folders");
  await setValue(sel, "other-thing"); assert.deepEqual(titles(), ["Weird category"]);
  await unmount();
  await mount(React.createElement(AdminResources), "/admin/resources", { fake: pre() });
  assert.ok([...$('select[aria-label="Folder"]').options].some((o) => o.textContent === "IB Documents (Students)"), "before the migration the filter lists the legacy categories as folders");
});

console.error = origErr;
console.log(`\n${n} UI checks run${process.exitCode ? " - FAILURES above" : " - all passed"}`);
process.exit(process.exitCode ?? 0);
