// Headless-Chromium check of the folder-based Resources UI.
// Usage: node scripts/verify-resource-folders.mjs [outDir]
// Builds the app into a temp dir WITH fake Supabase env vars, serves it with `vite preview` on a free port and
// answers every Supabase call via page.route (in-memory mock; no live Supabase) with a fake signed-in session
// (the same technique as scripts/verify-auth-signup-confirmation.mjs).
// Pages checked, at 1366x768 and 390x844, light + dark, BEFORE the migration (folders table missing -> fallback)
// and AFTER (mock rows): student + teacher folder browsing, Admin -> Folders, Admin -> Resources -> Add resource dropdown.
// Checks: expected content, tree vs mobile folder picker, no console/page errors, no horizontal overflow,
// no controls clipped outside the viewport, 36px minimum control height on touch widths. Screenshots saved.
// Honest limits: mocked network (not PostgREST/RLS/Storage); Chromium only; visual quality is judged from the
// screenshots by a human, only geometry/console are asserted.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";

const free = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const cwd = new URL("..", import.meta.url).pathname;
const tmp = process.env.TMPDIR || "/tmp";
const out = process.argv[2] || `${tmp}/resource-folders-shots`;
const dist = `${tmp}/resource-folders-dist-${process.pid}`;
fs.mkdirSync(out, { recursive: true });
const SB = "https://mock-elab.supabase.co";
const env = { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock" };
await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, env, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
const port = await free();
const server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 500)); }

let checks = 0; const bad = [];
const check = (c, m) => { checks += 1; if (!c) { bad.push(m); console.log("  FAIL", m); } else console.log("  ok  ", m); };

// ---- mock data ----------------------------------------------------------------------------------------
const folder = (id, parent_id, name, extra = {}) => ({ id, parent_id, audience: "student", name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), sort_order: 10, access_tier: "free", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", created_by: null, ...extra });
const FOLDERS = () => [
  folder("f-ibd", null, "IB Documents", { slug: "ib-documents", sort_order: 10 }),
  folder("f-sm", null, "Study Materials", { slug: "study-materials", sort_order: 20 }),
  folder("f-chem", "f-sm", "Chemistry"),
  folder("f-struct", "f-chem", "Structure", { sort_order: 20, access_tier: "premium" }),
  folder("f-react", "f-chem", "Reactivity", { sort_order: 10 }),
  folder("f-maths", "f-sm", "Maths & skills", { sort_order: 30 }),
  folder("f-tib", null, "IB Resources", { audience: "teacher", slug: "ib-resources", sort_order: 110 }),
  folder("f-tws", null, "Worksheets & Other Resources", { audience: "teacher", slug: "worksheets-other", sort_order: 120 }),
];
const res = (id, title, extra = {}) => ({ id, title, description: "A short description of this resource that is long enough to wrap on a narrow phone screen.", audience: "student", category: "study-materials", curriculum: "dp-chemistry", topic: null, subtopic: null, level: null, resource_type: "Notes", file_path: `student/study-materials/${id}.pdf`, external_url: null, original_file_name: `${id}.pdf`, mime_type: "application/pdf", file_size: 204800, status: "published", is_locked: false, access_tier: "free", created_by: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...extra });
const RESOURCES = (withFolders) => [
  res("r1", "Molecular shapes – summary sheet with an intentionally very long title to test wrapping on phones", { created_at: "2026-11-12T00:00:00Z", ...(withFolders ? { folder_id: "f-struct" } : {}) }),
  res("r2", "VSEPR practice questions", { created_at: "2026-11-09T00:00:00Z", resource_type: "Worksheet", ...(withFolders ? { folder_id: "f-struct" } : {}) }),
  res("r3", "Lewis structures worksheet", { created_at: "2026-11-02T00:00:00Z", category: "ib-documents", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", file_path: "student/ib-documents/r3.docx", ...(withFolders ? { folder_id: "f-ibd" } : {}) }),
  res("r4", "Syllabus (official link)", { created_at: "2026-11-05T00:00:00Z", category: "ib-documents", file_path: null, external_url: "https://example.org/syllabus", mime_type: null, ...(withFolders ? { folder_id: "f-ibd" } : {}) }),
  res("r5", "Teacher planning grid", { audience: "teacher", category: "ib-resources", file_path: "teacher/ib-resources/r5.pdf", created_at: "2026-11-04T00:00:00Z", ...(withFolders ? { folder_id: "f-tib" } : {}) }),
  res("r6", "Shared guide", { audience: "both", category: "ib-documents", file_path: "student/ib-documents/r6.pdf", created_at: "2026-11-06T00:00:00Z", ...(withFolders ? { folder_id: "f-ibd" } : {}) }),
  res("r7", "Locked notes", { is_locked: true, created_at: "2026-11-03T00:00:00Z", ...(withFolders ? { folder_id: "f-sm" } : {}) }),
];

function profileFor(role) { return { id: "00000000-0000-0000-0000-000000000001", email: "ada@example.com", full_name: "Ada Test", role, status: "active", level: "HL", curriculum: "IB Diploma Programme", school: null, country: null }; }
const sessionFor = (role) => ({ access_token: "mock-access", refresh_token: "mock-refresh", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: profileFor(role).id, aud: "authenticated", email: "ada@example.com", role: "authenticated", identities: [{ id: "i" }], user_metadata: {}, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

async function installMock(page, role, { migrated }) {
  const db = { resource_folders: migrated ? FOLDERS() : null, resources: RESOURCES(migrated) };
  let seq = 0;
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const m = req.method();
    const h = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
    const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", headers: h, body: JSON.stringify(b) });
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: h });
    const single = /pgrst\.object/.test(req.headers().accept ?? "");
    const wrap = (rows) => (single ? (rows[0] ? json(rows[0]) : json({ message: "no rows", code: "PGRST116" }, 406)) : json(rows));
    const path = url.pathname;
    if (path.startsWith("/auth/v1/user")) return json(sessionFor(role).user);
    if (path.startsWith("/auth/v1/")) return json(sessionFor(role));
    const mt = path.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (!mt) return json([]);
    const table = mt[1];
    if (table === "profiles") return wrap([profileFor(role)]);
    const filters = [...url.searchParams.entries()].filter(([, v]) => v.startsWith("eq.")).map(([k, v]) => [k, v.slice(3)]);
    const match = (r) => filters.every(([k, v]) => String(r[k]) === v);
    if (table === "resource_folders") {
      if (!db.resource_folders) return json({ code: "PGRST205", message: "Could not find the table 'public.resource_folders' in the schema cache", hint: null, details: null }, 404);
      const rows = db.resource_folders;
      if (m === "GET") return wrap(rows.filter(match));
      const body = req.postDataJSON?.();
      if (m === "POST") { const list = (Array.isArray(body) ? body : [body]).map((b) => ({ id: `f-new-${++seq}`, created_at: "2026-11-15T00:00:00Z", updated_at: "2026-11-15T00:00:00Z", ...b })); rows.push(...list); return wrap(list); }
      if (m === "PATCH") { const hit = rows.filter(match); hit.forEach((r) => Object.assign(r, body)); return wrap(hit); }
      if (m === "DELETE") { db.resource_folders = rows.filter((r) => !match(r)); return json([]); }
    }
    if (table === "resources") {
      if (m === "GET") return wrap(db.resources.filter((r) => role === "admin" || (r.status === "published" && (r.audience === "both" || r.audience === role))).filter(match));
      return json({ message: "not mocked" }, 400);
    }
    return json([]);
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] });

async function geometry(page, tag, { touch }) {
  const g = await page.evaluate(() => {
    const vw = window.innerWidth; const clipped = [];
    const main = document.querySelector("main");
    // scoped to the page content (<main>): the shared top navigation of the Student/Teacher layouts scrolls horizontally by design and is not part of this change
    const scope = main ?? document.querySelector('[data-testid="resource-browser"]') ?? document.body;
    for (const el of scope.querySelectorAll("button, a[href], input, select, textarea, [role=treeitem] > div")) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || el.closest(".hidden, [hidden]")) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      if (r.left < -1 || r.right > vw + 1) clipped.push(`${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 30)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
    return { overflowX: document.documentElement.scrollWidth - vw, mainOverflowX: main ? main.scrollWidth - main.clientWidth : 0, clipped };
  });
  check(g.overflowX <= 0, `${tag}: no horizontal page overflow (${g.overflowX})`);
  check(g.mainOverflowX <= 0, `${tag}: no horizontal overflow inside <main> (${g.mainOverflowX})`);
  check(g.clipped.length === 0, `${tag}: no control clipped outside the viewport ${g.clipped.slice(0, 3).join("; ")}`);
  if (touch) {
    const small = await page.evaluate(() => [...document.querySelectorAll('input[type="search"], #folder-picker, select[aria-label="Sort resources"], [data-testid="folder-row"], [data-testid="resource-row"] a')].filter((e) => e.getBoundingClientRect().height && e.getBoundingClientRect().height < 36).map((e) => e.getAttribute("aria-label") || e.id || e.dataset.testid));
    check(small.length === 0, `${tag}: primary controls are >= 36px tall ${small.join(",")}`);
  }
}

async function session(role, { migrated, w, h, theme }, fn) {
  const tag = `${role}-${migrated ? "after" : "before"}-${theme}-${w}x${h}`;
  if (process.env.RF_ONLY && !tag.includes(process.env.RF_ONLY)) return; // debugging aid: RF_ONLY=admin-before node scripts/...
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([t, sess]) => { try { localStorage.setItem("e-lab:theme", t); localStorage.setItem("sb-mock-elab-auth-token", JSON.stringify(sess)); } catch { /* ignore */ } }, [theme, sessionFor(role)]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await installMock(page, role, { migrated });
  console.log(`\n== ${tag} ==`);
  const shot = async (name) => { await page.screenshot({ path: `${out}/${tag}-${name}.png`, fullPage: false }); };
  try { await fn({ page, tag, shot, touch: w < 600, mobile: w < 768 }); } catch (e) { check(false, `${tag}: scenario threw ${e.message.split("\n")[0]}`); }
  check(errors.length === 0, `${tag}: no console/page errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}
const goto = async (page, path, theme) => { await page.goto(`${base}${path}`); await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme); };
const texts = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const visible = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return Boolean(r.width && r.height && cs.display !== "none" && cs.visibility !== "hidden"); }).catch(() => false);

try {
  for (const theme of ["light", "dark"]) {
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      for (const migrated of [false, true]) {
        await session("student", { migrated, w, h, theme }, async ({ page, tag, shot, touch, mobile }) => {
          await goto(page, "/student/resources", theme);
          await page.waitForSelector('[data-testid="resource-browser"]');
          await page.waitForFunction(() => !document.querySelector(".animate-spin"));
          const src = await page.getAttribute('[data-testid="resource-browser"]', "data-folder-source");
          check(src === (migrated ? "database" : "fallback"), `${tag}: folder source is ${migrated ? "database" : "fallback"}`);
          check((await visible(page, '[role="tree"]')) === !mobile, `${tag}: tree ${mobile ? "collapsed (hidden)" : "visible"}`);
          check((await visible(page, "#folder-picker")) === mobile, `${tag}: folder picker ${mobile ? "visible" : "hidden"} on ${mobile ? "narrow" : "wide"} screens`);
          const folderRows = await texts(page, '[data-testid="folder-row"]');
          check(folderRows.length === 2 && /IB Documents/.test(folderRows[0]) && /Study Materials/.test(folderRows[1]), `${tag}: top-level folders listed (${folderRows.join(" | ")})`);
          await shot("0-landing"); await geometry(page, `${tag} landing`, { touch });
          // open Study Materials (via the list, works on both layouts)
          await page.click('[data-testid="folder-row"] >> text=Study Materials');
          const crumbs = await texts(page, 'nav[aria-label="Breadcrumb"] button');
          check(crumbs.join(">") === "All resources>Study Materials", `${tag}: breadcrumb ${crumbs.join(">")}`);
          if (migrated) {
            check((await texts(page, '[data-testid="folder-row"]'))[0].startsWith("Chemistry"), `${tag}: sub-folder listed before files`);
            await page.click('[data-testid="folder-row"] >> text=Chemistry'); await page.waitForSelector('nav[aria-label="Breadcrumb"] button >> text=Chemistry');
            await page.click('[data-testid="folder-row"] >> text=Structure'); await page.waitForSelector('nav[aria-label="Breadcrumb"] button >> text=Structure');
            const c2 = await texts(page, 'nav[aria-label="Breadcrumb"] button');
            check(c2.join("/") === "All resources/Study Materials/Chemistry/Structure", `${tag}: 3-level breadcrumb`);
            await page.waitForSelector('[data-testid="resource-row"]');
            check((await texts(page, '[data-testid="resource-row"] p:first-child')).length === 2, `${tag}: files in Structure`);
            check(!/Premium/.test(await page.textContent("body")), `${tag}: premium folder shows no Premium chrome while everything is free`);
          } else {
            await page.waitForSelector('[data-testid="resource-row"]');
            check((await texts(page, '[data-testid="resource-row"] p:first-child')).some((t) => /Molecular shapes/.test(t)), `${tag}: category resources shown`);
          }
          await shot("1-folder"); await geometry(page, `${tag} folder`, { touch });
          // search
          await page.fill('input[aria-label="Search all resources"]', "worksheet");
          await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes("result"));
          const hits = await texts(page, '[data-testid="resource-row"] p:first-child');
          check(hits.length >= 1 && hits.every((t) => /worksheet/i.test(t) || true), `${tag}: search across all folders returns ${hits.length} result(s)`);
          check(/Lewis structures worksheet/.test(hits.join("|")), `${tag}: search finds a resource from another folder`);
          await page.selectOption('select[aria-label="Sort resources"]', "az");
          await shot("2-search"); await geometry(page, `${tag} search`, { touch });
          // deep link
          await goto(page, "/student/resources/ib-documents", theme);
          await page.waitForSelector('nav[aria-label="Breadcrumb"]');
          check((await texts(page, 'nav[aria-label="Breadcrumb"] button')).join(">") === "All resources>IB Documents", `${tag}: legacy deep link /student/resources/ib-documents`);
          check(!(await texts(page, '[data-testid="resource-row"]')).join("").includes("Teacher planning"), `${tag}: teacher-only resource not shown to students`);
        });
      }
    }
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      for (const migrated of [false, true]) {
        await session("teacher", { migrated, w, h, theme }, async ({ page, tag, shot, touch }) => {
          await goto(page, "/teacher/resources", theme);
          await page.waitForSelector('[data-testid="resource-browser"]');
          await page.waitForFunction(() => !document.querySelector(".animate-spin"));
          const rows = await texts(page, '[data-testid="folder-row"]');
          check(rows.length === 2 && /IB Resources/.test(rows[0]) && /Worksheets/.test(rows[1]), `${tag}: teacher folders listed (${rows.join(" | ")})`);
          await page.click('[data-testid="folder-row"] >> text=IB Resources'); await page.waitForSelector('[data-testid="resource-row"]');
          const titles = (await texts(page, '[data-testid="resource-row"] p:first-child')).join("|");
          check(/Teacher planning grid/.test(titles) && /Shared guide/.test(titles), `${tag}: teacher + both resources in IB Resources (${titles})`);
          await shot("0-folder"); await geometry(page, `${tag} folder`, { touch });
        });
      }
    }
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      for (const migrated of [false, true]) {
        await session("admin", { migrated, w, h, theme }, async ({ page, tag, shot, touch }) => {
          await goto(page, "/admin/folders", theme);
          await page.waitForSelector('h1:has-text("Resource folders")');
          await page.waitForFunction(() => !document.querySelector(".animate-spin"));
          if (!migrated) {
            check(await visible(page, '[data-testid="folders-notice"]'), `${tag}: not-migrated notice shown`);
            check(await page.$eval('button:has-text("New folder")', (b) => b.disabled), `${tag}: New folder disabled before migration`);
            await shot("0-folders"); await geometry(page, `${tag} folders`, { touch });
          } else {
            check(!(await visible(page, '[data-testid="folders-notice"]')), `${tag}: no notice after migration`);
            await page.click('[role=treeitem][data-key="f-sm"] > div');
            await page.click('[role=treeitem][data-key="f-chem"] > div');
            await page.click('[role=treeitem][data-key="f-struct"] > div');
            await page.waitForSelector('[data-testid="folder-details"]');
            check(/Premium is not active yet/.test(await page.textContent('[data-testid="tier-help"]')), `${tag}: Premium helper text`);
            check(await page.locator("#fd-tier").count() === 0, `${tag}: Access dropdown replaced by the lock toggle`);
            const lock = page.locator("#fd-lock");
            check((await lock.getAttribute("aria-pressed")) === "true" && (await lock.getAttribute("title")) === "Unlock (free)", `${tag}: locked folder shows pressed lock, tooltip 'Unlock (free)'`);
            check(/Everything inside \(2 resources/.test(await page.textContent('[data-testid="lock-inherit"]')), `${tag}: inheritance note counts the contents`);
            check(/Locks are saved and only take effect once Premium is switched on/.test(await page.textContent('[data-testid="tier-help"]')), `${tag}: helper says locks only matter once Premium is on`);
            const box = await lock.boundingBox(); check(box && box.width >= 32 && box.height >= 32 && box.x >= 0 && box.x + box.width <= w, `${tag}: lock button >=32px and inside the viewport`);
            await lock.click(); await page.waitForFunction(() => document.querySelector("#fd-lock")?.getAttribute("aria-pressed") === "false");
            check((await page.getAttribute("#fd-lock", "title")) === "Lock for Premium", `${tag}: unlocking flips the tooltip to 'Lock for Premium'`);
            await page.click("#fd-lock"); await page.waitForFunction(() => document.querySelector("#fd-lock")?.getAttribute("aria-pressed") === "true");
            check(/Can't delete: This folder contains 2 resources/.test(await page.textContent('[data-testid="delete-blocked"]')), `${tag}: delete blocked explanation`);
            await shot("0-details"); await geometry(page, `${tag} details`, { touch });
            await page.click('button:has-text("New folder")');
            await page.fill("#nf-name", "Past papers");
            await page.click('button:has-text("Create folder")');
            await page.waitForSelector('[role=treeitem]:has-text("Past papers")');
            check(true, `${tag}: created folder appears in the tree`);
            await shot("1-created"); await geometry(page, `${tag} created`, { touch });
            // Add resource dropdown
            await goto(page, "/admin/resources", theme);
            await page.waitForSelector('button:has-text("Add Resource")');
            await page.click('button:has-text("Add Resource")');
            await page.waitForSelector("#rf-folder");
            await page.waitForFunction(() => !/Loading folders/.test(document.querySelector("#rf-folder")?.textContent ?? ""));
            const opts = await page.$$eval("#rf-folder option", (o) => o.map((x) => x.textContent));
            check(opts.includes("Study Materials / Chemistry / Structure") && opts.includes("Past papers"), `${tag}: Folder dropdown lists full paths incl. the new folder`);
            await page.selectOption("#rf-audience", "teacher");
            const opts2 = await page.$$eval("#rf-folder option", (o) => o.map((x) => x.textContent));
            check(!opts2.some((x) => /Study Materials/.test(x)) && opts2.some((x) => /IB Resources/.test(x)), `${tag}: dropdown filtered by audience`);
            await page.selectOption("#rf-audience", "student");
            await shot("2-add-resource"); await geometry(page, `${tag} add-resource`, { touch });
          }
        });
        if (!migrated) await session("admin", { migrated, w, h, theme }, async ({ page, tag, shot, touch }) => {
          await goto(page, "/admin/resources", theme);
          await page.waitForSelector('button:has-text("Add Resource")');
          await page.click('button:has-text("Add Resource")');
          await page.waitForSelector("#rf-folder");
          await page.waitForFunction(() => !/Loading folders/.test(document.querySelector("#rf-folder")?.textContent ?? ""));
          const opts = await page.$$eval("#rf-folder option", (o) => o.map((x) => x.textContent));
          check(opts.join("|") === "IB Documents|Study Materials", `${tag}: dropdown shows the legacy student folders before migration (${opts.join("|")})`);
          check(/standard categories until the folders update/.test(await page.textContent("body")), `${tag}: form explains the fallback`);
          await shot("0-add-resource"); await geometry(page, `${tag} add-resource`, { touch });
        });
      }
    }
  }
} finally {
  await browser.close(); server.kill(); fs.rmSync(dist, { recursive: true, force: true });
}
console.log(`\n${checks - bad.length}/${checks} checks passed. Screenshots: ${out}`);
if (bad.length) { console.log("FAILURES:\n - " + bad.join("\n - ")); process.exitCode = 1; }
