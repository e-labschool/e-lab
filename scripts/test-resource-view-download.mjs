#!/usr/bin/env node
// Tests for the two resource file actions (eye = View in a new tab, download button = Download):
//   node scripts/test-resource-view-download.mjs
// Part 1: src/lib/resourceActions.js (pure + injected window/document/signed-URL function).
// Part 2: the REAL ResourceBrowser / ResourceRow / ResourceCard / AdminResources / AdminSimulations in jsdom against the
//         in-memory fake Supabase of the resource-folders tests (supabaseClient + AuthContext replaced by loader hooks).
// Honest limits: jsdom has no layout, no popup blocker and no real tabs/downloads -- window.open is a recording stub, so the
// real "a new tab opens / a file downloads" behaviour is checked in Chromium by scripts/verify-resource-view-download.mjs.
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
const errors = [];
console.error = (...a) => { errors.push(a.join(" ")); };

register("./resource-folders-loader-hooks.mjs", import.meta.url);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const { createFakeSupabase } = await import("./resource-folders-fake-supabase.mjs");
const A = await import("../src/lib/resourceActions.js");
const { default: ResourceBrowser } = await import("../src/components/resources/ResourceBrowser.jsx");
const { default: ResourceCard } = await import("../src/pages/student/resources/components/ResourceCard.jsx");
const { default: AdminResources } = await import("../src/pages/admin/resources/AdminResources.jsx");
const { default: AdminSimulations } = await import("../src/pages/admin/simulations/AdminSimulations.jsx");
const h = React.createElement;

let passed = 0; let failed = 0; let root;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failed += 1; console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 8).join("\n       ")}`); } finally { await unmount(); }
}
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const click = async (el) => { assert.ok(el, "click target missing"); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await wait(); };

// ------------------------------------------------------------------------------------------------ fixtures
const stored = (over = {}) => ({ title: "Notes", needsSignedUrl: true, supabaseFilePath: "student/study-materials/a.pdf", mimeType: "application/pdf", originalFileName: "Notes v2.pdf", fileType: "PDF", downloadable: true, isLocked: false, externalUrl: null, filePath: null, ...over });
const fakeTab = (over = {}) => { const tab = { opener: "parent", closed: false, url: null, location: { replace(u) { tab.url = u; } }, close() { tab.closed = true; }, ...over }; return tab; };
const fakeWin = (tab) => { const calls = []; return { calls, open: (...a) => { calls.push(a); return tab === undefined ? fakeTab() : tab; } }; };
const fakeDoc = () => { const log = []; const doc = { log, body: { appendChild: (a) => log.push(["append", a.href]) }, createElement: (tag) => { const a = { tag, remove: () => log.push(["remove"]), style: {}, click: () => log.push(["click", a.href, a.download, a.rel]) }; return a; } }; return doc; };

console.log("part 1: resourceActions.js");
await test("previewKind: PDF/images/text are viewable; Office types are download-only; links and empty are their own kinds", () => {
  assert.equal(A.previewKind(stored()), "inline");
  for (const m of ["image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"]) assert.equal(A.previewKind(stored({ mimeType: m })), "inline", m);
  for (const m of ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "image/svg+xml", "text/html"]) assert.equal(A.previewKind(stored({ mimeType: m })), "download-only", `${m} must not be opened in the browser`);
  assert.equal(A.previewKind(stored({ mimeType: null, originalFileName: "x.PDF" })), "inline", "falls back to the extension");
  assert.equal(A.previewKind(stored({ mimeType: null, originalFileName: null, supabaseFilePath: "student/x/a.pptx" })), "download-only");
  assert.equal(A.previewKind({ title: "L", externalUrl: "https://example.org/x", needsSignedUrl: false }), "external");
  assert.equal(A.previewKind({ title: "empty" }), "none");
  assert.equal(A.previewKind({ title: "static", filePath: "/resources/a.pdf", needsSignedUrl: false }), "inline");
});
await test("safeExternalUrl: only http(s); javascript:, data:, garbage are refused", () => {
  assert.equal(A.safeExternalUrl("https://example.org/a b"), "https://example.org/a%20b");
  assert.equal(A.safeExternalUrl("http://example.org"), "http://example.org/");
  for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "ftp://x", "not a url", "", null, undefined, "//evil.com"]) assert.equal(A.safeExternalUrl(bad), null, String(bad));
});
await test("downloadFileName: original name (sanitised) else title + extension; never a path", () => {
  assert.equal(A.downloadFileName(stored()), "Notes v2.pdf");
  assert.ok(!/[\\/:*?"<>|]/.test(A.downloadFileName(stored({ originalFileName: "../../etc/pa:ss*wd?.pdf" }))));
  assert.equal(A.downloadFileName(stored({ originalFileName: null, title: "Lewis worksheet", supabaseFilePath: "s/a.docx", mimeType: "x" })), "Lewis worksheet.docx");
  assert.equal(A.downloadFileName(stored({ originalFileName: null, title: "", supabaseFilePath: "s/a" })), "download");
  assert.ok(A.downloadFileName(stored({ originalFileName: `${"a".repeat(300)}.pdf` })).length <= 120);
});
await test("friendlyResourceError: clear sentences, never the raw error text", () => {
  const cases = [
    [new Error("Not connected to Supabase."), /storage isn't available/],
    [{ message: "Object not found", statusCode: "404" }, /couldn't be found/],
    [{ message: "new row violates row-level security policy", statusCode: "403" }, /permission/],
    [new TypeError("Failed to fetch"), /Couldn't reach the file server/],
    [{ message: "SQLSTATE 57014 weird internal thing" }, /Couldn't open this file right now/],
    [undefined, /Couldn't open this file right now/],
  ];
  for (const [err, re] of cases) { const m = A.friendlyResourceError(err, "open"); assert.match(m, re); assert.doesNotMatch(m, /SQLSTATE|row-level|TypeError|Supabase/); }
  assert.match(A.friendlyResourceError(new Error("x"), "download"), /Couldn't download/);
});
await test("viewResource: opens the tab SYNCHRONOUSLY (before the signed URL arrives), cuts the opener, then points it at the URL", async () => {
  const tab = fakeTab(); const win = fakeWin(tab);
  let release; const gate = new Promise((r) => { release = r; });
  const getUrl = async (p, o) => { await gate; getUrl.args = [p, o]; return "https://signed.example/x.pdf"; };
  const pending = A.viewResource(stored(), { win, getUrl });
  assert.deepEqual(win.calls, [["", "_blank"]], "window.open already called, blank, before any await finished");
  assert.equal(tab.opener, null, "noopener: the new tab cannot reach this page");
  assert.equal(tab.url, null, "not navigated yet");
  release(); const res = await pending;
  assert.deepEqual(res, { ok: true, code: "ok", message: "" });
  assert.equal(tab.url, "https://signed.example/x.pdf");
  assert.deepEqual(getUrl.args, ["student/study-materials/a.pdf", undefined], "view asks for a plain (inline) signed URL, never a download one");
});
await test("viewResource: navigates through a rel=noopener noreferrer anchor inside the new tab when it has a document", async () => {
  const doc = fakeDoc(); doc.body.style = {}; doc.title = "";
  const tab = fakeTab({ document: doc });
  const res = await A.viewResource(stored(), { win: fakeWin(tab), getUrl: async () => "https://signed.example/y.pdf" });
  assert.equal(res.ok, true);
  assert.deepEqual(doc.log.find((l) => l[0] === "click"), ["click", "https://signed.example/y.pdf", undefined, "noopener noreferrer"]);
  assert.equal(tab.url, null, "no location.replace needed when the anchor path worked");
});
await test("viewResource: popup blocked / signed-URL error / user closed the tab / locked / no file / bad link", async () => {
  let r = await A.viewResource(stored(), { win: fakeWin(null), getUrl: async () => assert.fail("must not sign without a tab") });
  assert.equal(r.code, "popup-blocked"); assert.match(r.message, /blocked the new tab/);
  const tab = fakeTab(); r = await A.viewResource(stored(), { win: fakeWin(tab), getUrl: async () => { throw { message: "Object not found", statusCode: "404" }; } });
  assert.equal(r.ok, false); assert.match(r.message, /couldn't be found/); assert.equal(tab.closed, true, "the blank tab is closed again on failure");
  const t2 = fakeTab(); r = await A.viewResource(stored(), { win: fakeWin(t2), getUrl: async () => { t2.closed = true; return "https://signed.example/z"; } });
  assert.equal(r.ok, true); assert.equal(t2.url, null, "does not navigate a tab the user already closed");
  const w = fakeWin(fakeTab());
  r = await A.viewResource(stored({ isLocked: true }), { win: w, getUrl: async () => assert.fail("locked resources are never signed") });
  assert.equal(r.code, "locked"); assert.equal(w.calls.length, 0);
  assert.equal((await A.viewResource({ title: "e" }, { win: w })).code, "no-file");
  assert.equal((await A.viewResource({ title: "l", externalUrl: "javascript:alert(1)" }, { win: w })).code, "bad-link");
  assert.equal(w.calls.length, 0, "nothing opened for any of these");
});
await test("viewResource: external link opens with noopener,noreferrer and is never signed; Office types are refused without signing", async () => {
  const w = fakeWin(null);
  let r = await A.viewResource({ title: "L", externalUrl: "https://example.org/s", needsSignedUrl: false }, { win: w, getUrl: async () => assert.fail("links are not signed") });
  assert.equal(r.ok, true); assert.deepEqual(w.calls, [["https://example.org/s", "_blank", "noopener,noreferrer"]]);
  const w2 = fakeWin(fakeTab());
  r = await A.viewResource(stored({ mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }), { win: w2, getUrl: async () => assert.fail("a private URL must never be created just to try a preview") });
  assert.equal(r.code, "not-previewable"); assert.match(r.message, /can't be previewed in the browser — download it instead/); assert.equal(w2.calls.length, 0);
});
await test("downloadResource: signed URL created WITH the download file name, saved through a rel=noopener noreferrer download anchor", async () => {
  const doc = fakeDoc(); let args;
  const r = await A.downloadResource(stored(), { doc, getUrl: async (p, o) => { args = [p, o]; return "https://signed.example/a.pdf?download=Notes%20v2.pdf"; } });
  assert.equal(r.ok, true);
  assert.deepEqual(args, ["student/study-materials/a.pdf", { download: "Notes v2.pdf" }]);
  assert.deepEqual(doc.log.map((l) => l[0]), ["append", "click", "remove"]);
  assert.deepEqual(doc.log[1], ["click", "https://signed.example/a.pdf?download=Notes%20v2.pdf", "Notes v2.pdf", "noopener noreferrer"]);
});
await test("downloadResource: links and locked and missing files have no download; storage errors become a friendly message", async () => {
  const doc = fakeDoc(); const never = async () => assert.fail("no signing");
  assert.equal((await A.downloadResource({ title: "L", externalUrl: "https://example.org", needsSignedUrl: false }, { doc, getUrl: never })).code, "no-download");
  assert.equal((await A.downloadResource(stored({ isLocked: true }), { doc, getUrl: never })).code, "locked");
  assert.equal((await A.downloadResource({ title: "x" }, { doc, getUrl: never })).code, "no-file");
  const r = await A.downloadResource(stored(), { doc, getUrl: async () => { throw new Error("boom internal"); } });
  assert.equal(r.ok, false); assert.match(r.message, /Couldn't download this file/); assert.doesNotMatch(r.message, /boom/);
  assert.equal(doc.log.length, 0, "nothing was clicked");
  const st = await A.downloadResource({ title: "Static", filePath: "/resources/a.pdf", needsSignedUrl: false, downloadable: true, fileType: "PDF" }, { doc, getUrl: never });
  assert.equal(st.ok, true); assert.deepEqual(doc.log[1], ["click", "/resources/a.pdf", "Static.pdf", "noopener noreferrer"]);
});
await test("resourceFromRow: admin rows are never locked and map storage / link fields", () => {
  const f = A.resourceFromRow({ title: "T", file_path: "a/b.pptx", mime_type: "application/x", original_file_name: "T.pptx", is_locked: true, external_url: null });
  assert.equal(f.isLocked, false); assert.equal(f.needsSignedUrl, true); assert.equal(f.supabaseFilePath, "a/b.pptx"); assert.equal(f.originalFileName, "T.pptx");
  assert.equal(A.previewKind(A.resourceFromRow({ title: "L", file_path: null, external_url: "https://e.org" })), "external");
});

// ------------------------------------------------------------------------------------------------ part 2: UI
console.log("part 2: UI");
const opened = []; let nextTab;
const downloads = [];
dom.window.open = (...a) => { opened.push(a); return typeof nextTab === "function" ? nextTab() : nextTab ?? null; };
// jsdom would try (and log) a navigation on anchor clicks: record + cancel download anchors instead
document.addEventListener("click", (e) => { const a = e.target.closest?.("a[download]"); if (a) { downloads.push({ href: a.getAttribute("href"), name: a.getAttribute("download"), rel: a.getAttribute("rel") }); e.preventDefault(); } }, true);
async function mount(element, { fake, auth = { isConfigured: true, profile: { level: "HL" }, user: { id: "u" } } } = {}) {
  globalThis.__rfSupabase = fake ?? createFakeSupabase({}); globalThis.__rfAuth = auth; globalThis.__rfSigned = [];
  errors.length = 0; opened.length = 0; downloads.length = 0; nextTab = undefined;
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root"));
  root.render(h(MemoryRouter, { initialEntries: ["/x"] }, element));
  await wait(60);
  for (let i = 0; i < 100 && (document.querySelector(".animate-spin") || /Loading folders/.test(document.body.textContent)); i += 1) await wait(20);
  await wait(30);
}
async function unmount() { root?.unmount(); root = null; await wait(10); }
const nr = (id, title, over = {}) => ({ id, title, folderId: null, fileType: "PDF", resourceType: "Notes", createdAt: "2026-11-01T00:00:00Z", accessTier: "free", needsSignedUrl: true, supabaseFilePath: `student/study-materials/${id}.pdf`, mimeType: "application/pdf", originalFileName: `${title}.pdf`, downloadable: true, isLocked: false, externalUrl: null, filePath: null, category: "misc", audience: "student", ...over });
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const RES = [
  nr("pdf", "Lewis structures"),
  nr("ppt", "Revision slides", { fileType: "PPTX", mimeType: PPTX, originalFileName: "Revision slides.pptx", supabaseFilePath: "student/study-materials/ppt.pptx" }),
  nr("lnk", "Official syllabus", { fileType: "Link", needsSignedUrl: false, supabaseFilePath: null, externalUrl: "https://example.org/syllabus", mimeType: null, originalFileName: null, downloadable: false }),
  nr("bad", "Broken link", { fileType: "Link", needsSignedUrl: false, supabaseFilePath: null, externalUrl: "javascript:alert(1)", mimeType: null, originalFileName: null, downloadable: false }),
  nr("lck", "Locked notes", { isLocked: true, downloadable: false }),
];
const browser = (config, role = "student", resources = RES) => h(ResourceBrowser, { role, resources, ...(config ? { accessConfig: config } : {}) });
const row = (title) => $$('[data-testid="resource-row"]').find((r) => norm($("p", r).textContent) === title);
const eye = (title) => $('[data-testid="resource-view"]', row(title));
const dlBtn = (title) => $('[data-testid="resource-download"]', row(title));

await test("every file row has TWO distinct actions with accessible names; touch targets are 44px (h-11 w-11) on mobile", async () => {
  await mount(browser());
  const pdfEye = eye("Lewis structures"); const pdfDl = dlBtn("Lewis structures");
  assert.equal(pdfEye.tagName, "BUTTON"); assert.equal(pdfDl.tagName, "BUTTON");
  assert.equal(pdfEye.getAttribute("aria-label"), "View Lewis structures in a new tab");
  assert.equal(pdfDl.getAttribute("aria-label"), "Download Lewis structures");
  assert.ok(pdfEye.title && pdfDl.title && pdfEye.title !== pdfDl.title, "tooltips differ");
  for (const b of [pdfEye, pdfDl]) { assert.match(b.className, /\bh-11\b/); assert.match(b.className, /\bw-11\b/); assert.equal(b.getAttribute("type"), "button"); assert.equal($("svg", b).getAttribute("aria-hidden"), "true"); }
  assert.equal($('[role="group"]', row("Lewis structures")).getAttribute("aria-label"), "Actions for Lewis structures");
  assert.ok(!/Premium|Locked/.test(row("Lewis structures").textContent), "no Premium chrome while everything is free");
  assert.deepEqual(errors, []);
});
await test("EYE: opens a blank tab synchronously, cuts the opener, navigates it to the signed URL; shows a busy state; no download", async () => {
  const fake = createFakeSupabase({}); let release; const gate = new Promise((r) => { release = r; });
  fake.storage = { from: () => ({ createSignedUrl: async (p, ttl, opts) => { (globalThis.__rfSigned ??= []).push({ path: p, opts }); await gate; return { data: { signedUrl: `https://signed.example/${p}` }, error: null }; } }) };
  await mount(browser(), { fake }); const tab = fakeTab(); nextTab = tab;
  const b = eye("Lewis structures");
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.deepEqual(opened, [["", "_blank"]], "window.open ran inside the click, before any await");
  assert.equal(tab.opener, null);
  await wait(20);
  assert.equal(b.getAttribute("aria-busy"), "true", "busy while the signed URL is requested"); assert.equal(b.getAttribute("aria-disabled"), "true");
  assert.ok($(".animate-spin", b), "spinner shown");
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); // double click: ignored
  assert.equal(opened.length, 1);
  release(); await wait(40);
  assert.equal(tab.url, "https://signed.example/student/study-materials/pdf.pdf");
  assert.equal(b.getAttribute("aria-busy"), null); assert.equal($(".animate-spin", b), null);
  assert.deepEqual(globalThis.__rfSigned.map((s) => s.opts), [undefined], "signed WITHOUT a download option -> displayed inline");
  assert.deepEqual(downloads, []);
});
await test("EYE: two clicks in the same tick open one tab", async () => {
  await mount(browser()); nextTab = fakeTab();
  const b = eye("Lewis structures");
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await wait(40); assert.equal(opened.length, 1);
});
await test("DOWNLOAD: separate button; forces a download via the signed URL with the file name; no tab opened", async () => {
  await mount(browser());
  await click(dlBtn("Lewis structures")); await wait(40);
  assert.deepEqual(opened, [], "no tab");
  assert.deepEqual(globalThis.__rfSigned.map((s) => s.opts), [{ download: "Lewis structures.pdf" }]);
  assert.deepEqual(downloads, [{ href: "https://signed.example/student/study-materials/pdf.pdf?download=Lewis%20structures.pdf", name: "Lewis structures.pdf", rel: "noopener noreferrer" }]);
});
await test("PPTX: the eye is honest ('can't be previewed ... download it instead'), signs nothing, opens nothing; Download works from the message", async () => {
  await mount(browser());
  const b = eye("Revision slides");
  assert.match(b.getAttribute("aria-label"), /preview not available for PPTX files, use Download/);
  await click(b);
  const msg = $('[data-testid="resource-action-message"]', row("Revision slides"));
  assert.match(norm(msg.textContent), /This file type can't be previewed in the browser — download it instead\./);
  assert.equal(msg.getAttribute("role"), "status");
  assert.deepEqual(opened, []); assert.deepEqual(globalThis.__rfSigned, [], "no private URL created for a preview that cannot work");
  await click([...msg.querySelectorAll("button")].find((x) => /Download instead/.test(x.textContent))); await wait(40);
  assert.equal(downloads[0].name, "Revision slides.pptx");
  await click([...$$("button", msg)].find((x) => /Dismiss/.test(x.textContent)));
  assert.equal($('[data-testid="resource-action-message"]', row("Revision slides")), null, "dismissable");
});
await test("EXTERNAL LINK: eye is a real link (new tab, noopener noreferrer), no download button; an unsafe javascript: link is not linkable", async () => {
  await mount(browser());
  const a = eye("Official syllabus");
  assert.equal(a.tagName, "A"); assert.equal(a.getAttribute("href"), "https://example.org/syllabus");
  assert.equal(a.getAttribute("target"), "_blank"); assert.match(a.getAttribute("rel"), /noopener/); assert.match(a.getAttribute("rel"), /noreferrer/);
  assert.equal(a.getAttribute("aria-label"), "View Official syllabus in a new tab");
  assert.equal(dlBtn("Official syllabus"), null, "links have nothing to download");
  const bad = eye("Broken link");
  assert.equal(bad.tagName, "BUTTON"); assert.ok(!bad.hasAttribute("href"));
  await click(bad);
  assert.match($('[role="alert"]', row("Broken link")).textContent, /link isn't valid/); assert.deepEqual(opened, []);
});
await test("LOCKED resource: exactly as before (lock indicator, no View, no Download)", async () => {
  await mount(browser());
  const r = row("Locked notes");
  assert.ok(/Locked/.test(r.textContent)); assert.equal($('[data-testid="resource-actions"]', r), null);
});
await test("ERRORS: a missing file / storage failure shows a clear sentence (no raw error) and closes the blank tab; popup blocker is explained", async () => {
  const fake = createFakeSupabase({});
  fake.storage = { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: "Object not found", statusCode: "404", __raw: "SECRET-INTERNAL" } }) }) };
  await mount(browser(), { fake }); const tab = fakeTab(); nextTab = tab;
  await click(eye("Lewis structures")); await wait(40);
  const alert = $('[role="alert"]', row("Lewis structures"));
  assert.match(alert.textContent, /This file couldn't be found/); assert.doesNotMatch(alert.textContent, /Object not found|SECRET|404/);
  assert.equal(tab.closed, true);
  await click(dlBtn("Lewis structures")); await wait(40);
  assert.match($('[role="alert"]', row("Lewis structures")).textContent, /couldn't be found/); assert.deepEqual(downloads, []);
  // popup blocker
  await unmount(); await mount(browser()); nextTab = null;
  await click(eye("Lewis structures")); await wait(40);
  assert.match($('[role="alert"]', row("Lewis structures")).textContent, /blocked the new tab/);
  assert.deepEqual(globalThis.__rfSigned, [], "no URL was created when the tab could not be opened");
});
await test("PREMIUM ON + 'Downloads are Premium-only': download shows a lock and opens the locked prompt; the eye still works; Escape closes and returns focus", async () => {
  const cfg = { premiumEnabled: true, requireLoginForSimulations: false, downloadRequiresPremium: true };
  await mount(browser(cfg));
  const d = dlBtn("Lewis structures");
  assert.equal(d.getAttribute("data-locked"), "true"); assert.equal(d.getAttribute("aria-label"), "Download Lewis structures (Premium)"); assert.equal(d.getAttribute("aria-haspopup"), "dialog");
  assert.ok($("svg.lucide-lock", d), "lock drawn on the button");
  d.focus(); await click(d);
  const dlg = $('[role="dialog"]'); assert.ok(dlg);
  assert.equal(dlg.getAttribute("aria-modal"), "true"); assert.equal(dlg.getAttribute("data-locked-action"), "download");
  assert.match(norm(dlg.textContent), /Downloads are a Premium feature.*view this file in your browser/);
  assert.deepEqual(globalThis.__rfSigned, [], "nothing signed, nothing downloaded"); assert.deepEqual(downloads, []);
  assert.equal(document.activeElement.textContent, "Close", "focus moves into the prompt");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(20);
  assert.equal($('[role="dialog"]'), null); assert.equal(document.activeElement, d, "focus returns to the Download button");
  nextTab = fakeTab(); await click(eye("Lewis structures")); await wait(40);
  assert.equal(opened.length, 1, "view is still free"); assert.ok(nextTab.url);
  assert.ok(eye("Lewis structures").getAttribute("aria-label").startsWith("View "));
});
await test("PREMIUM ON but download switch OFF -> download unlocked; switch ON but Premium OFF -> unlocked (invisible); a teacher is not unlocked", async () => {
  await mount(browser({ premiumEnabled: true, downloadRequiresPremium: false }));
  assert.equal(dlBtn("Lewis structures").getAttribute("data-locked"), null); assert.equal(dlBtn("Lewis structures").getAttribute("aria-label"), "Download Lewis structures");
  await unmount(); await mount(browser({ premiumEnabled: false, downloadRequiresPremium: true }));
  assert.equal(dlBtn("Lewis structures").getAttribute("data-locked"), null); assert.ok(!/Premium/.test(document.body.textContent));
  await unmount(); await mount(browser({ premiumEnabled: true, downloadRequiresPremium: true }, "teacher", RES.map((r) => ({ ...r, audience: "teacher" }))));
  assert.equal(dlBtn("Lewis structures").getAttribute("data-locked"), "true", "teacher role does not grant Premium");
});
await test("PREMIUM ON + locked download + Office file: eye explains it can't be previewed (no 'download instead' offer)", async () => {
  await mount(browser({ premiumEnabled: true, downloadRequiresPremium: true }));
  await click(eye("Revision slides"));
  const msg = $('[data-testid="resource-action-message"]', row("Revision slides"));
  assert.match(msg.textContent, /can't be previewed in the browser\./); assert.doesNotMatch(msg.textContent, /Download instead/);
});
await test("ResourceCard (legacy card) carries the same two actions", async () => {
  await mount(h("div", null, h(ResourceCard, { resource: RES[0] }), h(ResourceCard, { resource: RES[2] })));
  const cards = $$('[data-testid="resource-actions"]');
  assert.equal(cards.length, 2);
  assert.ok($('[data-testid="resource-view"]', cards[0]) && $('[data-testid="resource-download"]', cards[0]));
  assert.ok($('[data-testid="resource-view"]', cards[1]) && !$('[data-testid="resource-download"]', cards[1]));
});
await test("search results use the same rows (both actions present while searching)", async () => {
  await mount(browser());
  const input = $('input[aria-label="Search all resources"]');
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, "lewis");
  input.dispatchEvent(new Event("input", { bubbles: true })); await wait(40);
  assert.ok(eye("Lewis structures") && dlBtn("Lewis structures"));
});

const adminRows = () => [
  { id: "1", title: "Slides", audience: "student", category: "study-materials", status: "published", is_locked: true, access_tier: "free", file_path: "student/study-materials/s.pptx", mime_type: PPTX, original_file_name: "Slides.pptx", external_url: null, created_at: "2026-11-01T00:00:00Z" },
  { id: "2", title: "Paper", audience: "student", category: "study-materials", status: "draft", is_locked: false, access_tier: "free", file_path: "student/study-materials/p.pdf", mime_type: "application/pdf", original_file_name: "Paper.pdf", external_url: null, created_at: "2026-11-02T00:00:00Z" },
  { id: "3", title: "Web page", audience: "both", category: "ib-documents", status: "published", is_locked: false, access_tier: "free", file_path: null, mime_type: null, external_url: "https://example.org/w", created_at: "2026-11-03T00:00:00Z" },
];
console.log("admin resources");
await test("ADMIN list: View + Download on every file (incl. locked and draft), View only for links; publish toggle no longer looks like the eye", async () => {
  await mount(h(AdminResources), { fake: createFakeSupabase({ resources: adminRows() }), auth: { isConfigured: true, profile: { role: "admin" }, user: { id: "a" } } });
  const card = (t) => $$(".rounded-lg.border").find((c) => norm($("p", c)?.textContent ?? "").startsWith(t));
  for (const t of ["Slides", "Paper"]) { assert.ok($(`button[aria-label="View ${t} in a new tab"], button[aria-label^="View ${t} —"]`, card(t)), `${t}: view`); assert.ok($(`button[aria-label="Download ${t}"]`, card(t)), `${t}: download`); }
  assert.ok($('a[aria-label="View Web page in a new tab"]', card("Web page"))); assert.equal($('button[aria-label^="Download"]', card("Web page")), null);
  assert.ok($('button[aria-label="Unpublish"]', card("Slides")) && $('button[aria-label="Publish"]', card("Paper")), "publish toggle labels unchanged");
  assert.ok(!$('button[aria-label="Preview"]'), "old single Preview button is gone");
  nextTab = fakeTab(); await click($('button[aria-label="View Paper in a new tab"]')); await wait(40);
  assert.equal(nextTab.url, "https://signed.example/student/study-materials/p.pdf");
  await click($('button[aria-label="Download Slides"]')); await wait(40);
  assert.equal(downloads[0].name, "Slides.pptx", "admin can download a locked/Office file to check the upload");
});
await test("ADMIN list is never locked by the Premium download switch (management tool)", async () => {
  await mount(h(AdminResources), { fake: createFakeSupabase({ resources: adminRows() }), auth: { isConfigured: true, profile: { role: "admin" }, user: { id: "a" } } });
  assert.equal($$('[data-locked="true"]').length, 0);
});

console.log("admin simulations: the new switch");
function settingsClient({ columns = true, downloadColumn = true, row = {} } = {}) {
  const saved = [];
  const data = () => ({ id: 1, premium_enabled: false, require_login_for_simulations: false, ...(downloadColumn ? { download_requires_premium: false } : {}), ...row });
  const q = (result) => { const b = { select: () => b, eq: () => b, maybeSingle: async () => result(), single: async () => result(), then: (res, rej) => Promise.resolve(result()).then(res, rej) }; return b; };
  return {
    saved,
    from(name) {
      if (name === "platform_settings") {
        if (!columns) return q(() => ({ data: { id: 1 }, error: null }));
        const b = q(() => ({ data: data(), error: null }));
        b.update = (fields) => { saved.push(fields); Object.assign(row, fields); return q(() => ({ data: data(), error: null })); };
        return b;
      }
      return q(() => ({ data: name === "simulation_access" ? [] : null, error: null }));
    },
  };
}
const admin = { isConfigured: true, profile: { role: "admin" }, user: { id: "a" } };
await test("labelled 'Downloads are Premium-only' switch with helper text (needs Premium; everything free now); off by default; persists via the access config service", async () => {
  const client = settingsClient(); await mount(h(AdminSimulations), { fake: client, auth: admin }); await wait(60);
  const sw = $('[data-switch="download-requires-premium"]');
  assert.ok(sw, "switch present"); assert.equal(sw.getAttribute("role"), "switch"); assert.equal(sw.getAttribute("aria-checked"), "false"); assert.equal(sw.disabled, false);
  assert.equal(norm(document.getElementById("download-requires-premium-label").textContent), "Downloads are Premium-only");
  const help = norm(document.getElementById("download-requires-premium-desc").textContent);
  assert.match(help, /Only takes effect when Premium .* is ON/); assert.match(help, /right now everything is free/); assert.match(help, /viewing a file in the browser stays free/); assert.match(help, /still be saved from the browser's own toolbar/);
  assert.equal($$('[role="switch"]').length, 3, "alongside the two existing switches");
  await click(sw); await wait(60);
  assert.deepEqual(client.saved, [{ download_requires_premium: true }]);
  assert.equal($('[data-switch="download-requires-premium"]').getAttribute("aria-checked"), "true");
  assert.match(norm(document.getElementById("download-requires-premium-desc").textContent), /Saved; no effect while Premium is off/);
  assert.ok($("[data-banner='all-free']"), "page still says everything is free");
});
await test("before the 011 SQL: the download switch is disabled with a notice, the other two switches still work", async () => {
  const client = settingsClient({ downloadColumn: false }); await mount(h(AdminSimulations), { fake: client, auth: admin }); await wait(60);
  assert.equal($('[data-switch="download-requires-premium"]').disabled, true);
  assert.match(norm($('[data-notice="download-switch-missing"]').textContent), /011_download_requires_premium\.sql/);
  assert.equal($('[data-switch="premium-enabled"]').disabled, false); assert.equal($('[data-switch="require-login"]').disabled, false);
});
await test("before any access SQL (001): all three switches disabled, no download notice duplicated", async () => {
  const client = settingsClient({ columns: false }); await mount(h(AdminSimulations), { fake: client, auth: admin }); await wait(60);
  for (const id of ["premium-enabled", "require-login", "download-requires-premium"]) assert.equal($(`[data-switch="${id}"]`).disabled, true, id);
  assert.equal($('[data-notice="download-switch-missing"]'), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
const unexpected = errors.filter((e) => !/not wrapped in act|Not implemented/.test(e));
if (unexpected.length) console.log("console.error output:\n  " + unexpected.slice(0, 5).join("\n  "));
process.exit(failed ? 1 : 0);
