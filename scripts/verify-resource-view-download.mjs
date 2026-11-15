// Headless-Chromium check of the resource View (eye) / Download actions.
// Usage: node scripts/verify-resource-view-download.mjs [outDir]
// Builds the app into a temp dir WITH fake Supabase env vars, serves it with `vite preview`, and answers every Supabase call
// (REST, auth AND storage signing + the signed file URL itself) via context.route -- no live Supabase, no real storage.
// Checked at 1366x768 and 390x844, light + dark:
//   student + teacher resources: eye opens a NEW TAB that lands on the signed (inline) URL, opener is null, no Referer reaches the
//   storage host, the tab exists (about:blank) before the signed URL is answered; Download fires a real download event with the
//   right file name and does not open a tab; Office files: the eye explains instead of opening and signs nothing; external link:
//   eye only; error: friendly message and the blank tab is closed; locked: no actions; touch targets >= 44px on 390px;
//   no console errors / horizontal overflow / clipped controls.  Premium ON + "Downloads are Premium-only": lock + prompt,
//   the eye still works.  Admin: View + Download on the resources list, and the new switch on /admin/simulations.
// Honest limits: Chromium only (Playwright launches it with popup blocking disabled, so the popup-blocker behaviour itself is
// NOT exercised; "tab opened before the URL is known" is asserted instead); the storage and signed-URL responses are mocks
// (a real Supabase must send Content-Disposition for ?download=, which is asserted only against the mock); no real PPT/DOC
// rendering; visual quality is judged from the screenshots by a human.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";

const free = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const cwd = new URL("..", import.meta.url).pathname;
const tmp = process.env.TMPDIR || "/tmp";
const out = process.argv[2] || `${tmp}/resource-actions-shots`;
const dist = `${tmp}/resource-actions-dist-${process.pid}`;
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
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const res = (id, title, extra = {}) => ({ id, title, description: "A short description of this resource that is long enough to wrap on a narrow phone screen.", audience: "student", category: "study-materials", curriculum: "dp-chemistry", topic: null, subtopic: null, level: null, resource_type: "Notes", file_path: `student/study-materials/${id}.pdf`, external_url: null, original_file_name: `${title}.pdf`, mime_type: "application/pdf", file_size: 204800, status: "published", is_locked: false, access_tier: "free", created_by: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...extra });
const RESOURCES = () => [
  res("r-pdf", "Lewis structures worksheet with an intentionally very long title to test wrapping on phones", { created_at: "2026-11-12T00:00:00Z", original_file_name: "Lewis structures worksheet.pdf" }),
  res("r-ppt", "Revision slides", { created_at: "2026-11-11T00:00:00Z", mime_type: PPTX, file_path: "student/study-materials/r-ppt.pptx", original_file_name: "Revision slides.pptx" }),
  res("r-img", "Periodic table image", { created_at: "2026-11-10T00:00:00Z", mime_type: "image/png", file_path: "student/study-materials/r-img.png", original_file_name: "Periodic table.png" }),
  res("r-link", "Official syllabus (link)", { created_at: "2026-11-09T00:00:00Z", file_path: null, external_url: "https://example.org/syllabus", mime_type: null, original_file_name: null }),
  res("r-miss", "Missing file", { created_at: "2026-11-08T00:00:00Z", file_path: "student/study-materials/missing.pdf", original_file_name: "Missing file.pdf" }),
  res("r-lock", "Locked notes", { created_at: "2026-11-07T00:00:00Z", is_locked: true }),
  res("t-pdf", "Teacher planning grid", { audience: "teacher", category: "ib-resources", file_path: "teacher/ib-resources/t-pdf.pdf", original_file_name: "Teacher planning grid.pdf", created_at: "2026-11-04T00:00:00Z" }),
];
const profileFor = (role) => ({ id: "00000000-0000-0000-0000-000000000001", email: "ada@example.com", full_name: "Ada Test", role, status: "active", level: "HL", curriculum: "IB Diploma Programme", school: null, country: null });
const sessionFor = (role) => ({ access_token: "mock-access", refresh_token: "mock-refresh", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: profileFor(role).id, aud: "authenticated", email: "ada@example.com", role: "authenticated", identities: [{ id: "i" }], user_metadata: {}, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

/** Installs the mock on the CONTEXT (so popups opened by the page are mocked too).  Returns recorders. */
async function installMock(ctx, role, { premium = false, downloadPremium = false, signDelayMs = 0 } = {}) {
  const rec = { signRequests: [], fileRequests: [], saved: [], referers: [] };
  const settings = { id: 1, platform_name: "e-Lab", premium_enabled: premium, require_login_for_simulations: false, download_requires_premium: downloadPremium };
  const resources = RESOURCES();
  await ctx.route("https://example.org/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>External</title><h1>External site</h1>" }));
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const m = req.method(); const path = url.pathname;
    const h = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
    const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", headers: h, body: JSON.stringify(b) });
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: h });
    // ---- storage: signing (POST) and the signed file itself (GET) ----
    const sign = path.match(/^\/storage\/v1\/object\/sign\/resources\/(.+)$/);
    if (sign && m === "POST") {
      rec.signRequests.push(decodeURIComponent(sign[1]));
      if (signDelayMs) await new Promise((r) => setTimeout(r, signDelayMs));
      if (/missing\.pdf$/.test(sign[1])) return json({ statusCode: "404", error: "not_found", message: "Object not found" }, 400);
      return json({ signedURL: `/object/sign/resources/${sign[1]}?token=mock-token` });
    }
    if (sign && m === "GET") {
      const name = decodeURIComponent(sign[1]); const dlName = url.searchParams.get("download");
      rec.fileRequests.push({ name, download: dlName, referer: req.headers().referer ?? null });
      const png = /\.png$/.test(name);
      const headers = { "content-type": png ? "image/png" : "application/pdf", "cache-control": "no-store" };
      if (dlName !== null) headers["content-disposition"] = `attachment; filename="${dlName || name.split("/").pop()}"`; // what Supabase Storage does for ?download=
      return route.fulfill({ status: 200, headers, body: png ? PNG : PDF });
    }
    if (path.startsWith("/auth/v1/user")) return json(sessionFor(role).user);
    if (path.startsWith("/auth/v1/")) return json(sessionFor(role));
    const mt = path.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (!mt) return json([]);
    const table = mt[1];
    const single = /pgrst\.object/.test(req.headers().accept ?? "");
    const wrap = (rows) => (single ? (rows[0] ? json(rows[0]) : json({ message: "no rows", code: "PGRST116" }, 406)) : json(rows));
    if (table === "profiles") return wrap([profileFor(role)]);
    if (table === "resource_folders") return json({ code: "PGRST205", message: "Could not find the table 'public.resource_folders' in the schema cache", hint: null, details: null }, 404);
    if (table === "platform_settings_public") return wrap([settings]);
    if (table === "platform_settings") {
      if (m === "PATCH") { const body = req.postDataJSON(); rec.saved.push(body); Object.assign(settings, body); return wrap([settings]); }
      return wrap([settings]);
    }
    if (table === "simulation_access") return json([]);
    if (table === "resources" && m === "GET") return wrap(resources.filter((r) => role === "admin" || (r.status === "published" && (r.audience === "both" || r.audience === role))));
    return json([]);
  });
  return rec;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] });

async function geometry(page, tag, { touch }) {
  const g = await page.evaluate(() => {
    const vw = window.innerWidth; const clipped = [];
    const main = document.querySelector("main");
    const scope = main ?? document.body;
    for (const el of scope.querySelectorAll("button, a[href], input, select, textarea")) {
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
  const small = await page.evaluate((needBig) => [...document.querySelectorAll('[data-testid="resource-view"], [data-testid="resource-download"]')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.width < (needBig ? 44 : 32) || r.height < (needBig ? 44 : 32)); }).map((e) => e.getAttribute("aria-label")), touch);
  check(small.length === 0, `${tag}: View/Download targets are >= ${touch ? 44 : 32}px ${small.join(",")}`);
}

async function session(role, { w, h, theme, mock = {} }, name, fn) {
  const tag = `${name}-${theme}-${w}x${h}`;
  if (process.env.RA_ONLY && !tag.includes(process.env.RA_ONLY)) return;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
  await ctx.addInitScript(([t, sess]) => { try { localStorage.setItem("e-lab:theme", t); localStorage.setItem("sb-mock-elab-auth-token", JSON.stringify(sess)); } catch { /* ignore */ } }, [theme, sessionFor(role)]);
  const rec = await installMock(ctx, role, mock);
  const page = await ctx.newPage();
  const errors = [];
  const watch = (p) => { p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); }); };
  watch(page); ctx.on("page", watch);
  console.log(`\n== ${tag} ==`);
  const shot = async (n) => { await page.screenshot({ path: `${out}/${tag}-${n}.png`, fullPage: false }); };
  try { await fn({ page, ctx, rec, tag, shot, touch: w < 600 }); } catch (e) { check(false, `${tag}: scenario threw ${e.message.split("\n")[0]}`); }
  check(errors.length === 0, `${tag}: no console/page errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}
const goto = async (page, path, theme) => { await page.goto(`${base}${path}`); await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme); };
const rowOf = (page, title) => page.locator('[data-testid="resource-row"]', { hasText: title });
const waitRows = async (page) => { await page.waitForSelector('[data-testid="resource-row"]'); await page.waitForFunction(() => !document.querySelector(".animate-spin")); };

/** the shared scenario for student and teacher resource pages */
async function resourceScenario({ page, ctx, rec, tag, shot, touch }, { pdf, openPath, hasOffice }) {
  await waitRows(page);
  const row = rowOf(page, pdf);
  const eye = row.locator('[data-testid="resource-view"]'); const dl = row.locator('[data-testid="resource-download"]');
  check((await eye.count()) === 1 && (await dl.count()) === 1, `${tag}: file row has an eye (View) AND a Download button`);
  check(/^View .+ in a new tab$/.test(await eye.getAttribute("aria-label")), `${tag}: eye accessible name 'View <title> in a new tab'`);
  check(/^Download /.test(await dl.getAttribute("aria-label")), `${tag}: download accessible name 'Download <title>'`);
  check((await page.locator('[data-locked="true"], [role="dialog"]').count()) === 0 && !/Premium/.test(await page.textContent("main")), `${tag}: no lock / Premium chrome while everything is free`);
  await shot("0-list"); await geometry(page, `${tag} list`, { touch });

  // keyboard reachability: tab to the eye, then the download button
  await eye.focus(); await page.keyboard.press("Tab");
  check(await dl.evaluate((e) => e === document.activeElement), `${tag}: Tab moves from the eye to the Download button`);

  // ---- VIEW: new tab, opened before the signed URL is answered ----
  const pagesBefore = ctx.pages().length;
  const popupP = ctx.waitForEvent("page");
  await eye.click();
  const popup = await popupP;
  check(popup.url() === "about:blank" || /\/storage\/v1\/object\/sign\//.test(popup.url()), `${tag}: the new tab exists immediately (url=${popup.url().slice(0, 40)}...)`);
  await popup.waitForURL(/\/storage\/v1\/object\/sign\/resources\//, { timeout: 8000 });
  check(ctx.pages().length === pagesBefore + 1, `${tag}: exactly one new tab opened`);
  const u = new URL(popup.url());
  check(u.pathname.endsWith(openPath) && u.searchParams.get("token") === "mock-token" && !u.searchParams.has("download"), `${tag}: the tab shows the signed URL WITHOUT a download parameter (${u.pathname.slice(-30)})`);
  const req = rec.fileRequests.at(-1);
  check(req && req.download === null && req.referer === null, `${tag}: storage host received no Referer (${req?.referer})`);
  check((await popup.evaluate(() => window.opener)) === null, `${tag}: window.opener is null in the new tab (noopener)`);
  check(page.url().includes("/resources") , `${tag}: the resources page itself did not navigate`);
  await popup.close();

  // ---- DOWNLOAD: real download event, no tab ----
  const tabsBefore = ctx.pages().length;
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), dl.click()]);
  check(download.suggestedFilename() === `${pdf}.pdf`, `${tag}: download event fired with file name '${download.suggestedFilename()}'`);
  check(/download=/.test(download.url()) && /token=mock-token/.test(download.url()), `${tag}: download used the signed URL with a download file name`);
  check(ctx.pages().length === tabsBefore && /\/resources/.test(page.url()), `${tag}: Download opens no tab and stays on the page`);

  if (hasOffice) {
    // ---- Office file: the eye explains, nothing is signed or opened ----
    const o = rowOf(page, "Revision slides"); const signsBefore = rec.signRequests.length; const n = ctx.pages().length;
    await o.locator('[data-testid="resource-view"]').click();
    check(await o.locator('[data-testid="resource-action-message"]').isVisible() && /can't be previewed in the browser — download it instead/.test(await o.locator('[data-testid="resource-action-message"]').textContent()), `${tag}: PPTX eye explains it can't be previewed`);
    check(rec.signRequests.length === signsBefore && ctx.pages().length === n, `${tag}: PPTX preview signed nothing and opened nothing`);
    await shot("1-pptx-message"); await geometry(page, `${tag} pptx-message`, { touch });
    const [d2] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), o.getByRole("button", { name: "Download instead" }).click()]);
    check(d2.suggestedFilename() === "Revision slides.pptx", `${tag}: 'Download instead' downloads ${d2.suggestedFilename()}`);

    // ---- image opens inline in a tab ----
    const im = rowOf(page, "Periodic table image");
    const pp = ctx.waitForEvent("page"); await im.locator('[data-testid="resource-view"]').click(); const ipop = await pp;
    await ipop.waitForURL(/r-img\.png/, { timeout: 8000 });
    check(await ipop.evaluate(() => document.contentType) === "image/png", `${tag}: an image opens in the tab as an image`);
    await ipop.close();

    // ---- external link ----
    const l = rowOf(page, "Official syllabus");
    check((await l.locator('[data-testid="resource-download"]').count()) === 0, `${tag}: external link has no Download button`);
    const lp = ctx.waitForEvent("page"); await l.locator('[data-testid="resource-view"]').click(); const lpop = await lp;
    await lpop.waitForURL("https://example.org/syllabus", { timeout: 8000 });
    check(true, `${tag}: external link eye opens the link in a new tab`);
    await lpop.close();

    // ---- error: missing file ----
    const m = rowOf(page, "Missing file");
    const ep = ctx.waitForEvent("page"); await m.locator('[data-testid="resource-view"]').click(); const epop = await ep;
    await m.locator('[role="alert"]').waitFor({ timeout: 8000 });
    const txt = await m.locator('[role="alert"]').textContent();
    check(/couldn't be found/.test(txt) && !/not_found|Object not found|statusCode|400/.test(txt), `${tag}: signed-URL error shows a clear message ('${txt.trim().slice(0, 60)}')`);
    await epop.waitForEvent("close", { timeout: 3000 }).catch(() => {});
    check(epop.isClosed(), `${tag}: the blank tab is closed again after the error`);
    await shot("2-error"); await geometry(page, `${tag} error`, { touch });

    // ---- locked ----
    const k = rowOf(page, "Locked notes");
    check((await k.locator('[data-testid="resource-actions"]').count()) === 0 && /Locked/.test(await k.textContent()), `${tag}: locked resource shows 'Locked' and no actions`);
  }
}

try {
  for (const theme of ["light", "dark"]) {
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      await session("student", { w, h, theme }, "student", async (s) => {
        await goto(s.page, "/student/resources/study-materials", theme);
        await resourceScenario(s, { pdf: "Lewis structures worksheet", openPath: "r-pdf.pdf", hasOffice: true });
      });
      await session("student", { w, h, theme, mock: { premium: true, downloadPremium: true } }, "student-premium-downloads", async ({ page, ctx, tag, shot, touch }) => {
        await goto(page, "/student/resources/study-materials", theme);
        await waitRows(page);
        const row = rowOf(page, "Lewis structures worksheet");
        const dl = row.locator('[data-testid="resource-download"]');
        check((await dl.getAttribute("data-locked")) === "true" && /\(Premium\)/.test(await dl.getAttribute("aria-label")), `${tag}: Download shows a lock and '(Premium)' name`);
        await shot("0-locked-list"); await geometry(page, `${tag} list`, { touch });
        await dl.click();
        const dlg = page.getByRole("dialog");
        check(await dlg.isVisible() && /Downloads are a Premium feature/.test(await dlg.textContent()), `${tag}: locked prompt opens`);
        const box = await dlg.boundingBox();
        check(box && box.x >= 0 && box.x + box.width <= w && box.y >= 0 && box.y + box.height <= h, `${tag}: prompt fits the viewport`);
        await shot("1-prompt");
        await page.keyboard.press("Escape");
        check((await page.getByRole("dialog").count()) === 0 && (await dl.evaluate((e) => e === document.activeElement)), `${tag}: Escape closes the prompt and focus returns to Download`);
        const popupP = ctx.waitForEvent("page"); await row.locator('[data-testid="resource-view"]').click();
        const popup = await popupP; await popup.waitForURL(/r-pdf\.pdf/, { timeout: 8000 });
        check(true, `${tag}: the eye still opens the file while Download is Premium-only`);
        await popup.close();
      });
    }
  }
  for (const [theme, w, h] of [["light", 1366, 768], ["dark", 390, 844]]) {
    await session("teacher", { w, h, theme }, "teacher", async (s) => {
      await goto(s.page, "/teacher/resources", theme);
      await s.page.waitForSelector('[data-testid="resource-browser"]'); await s.page.waitForFunction(() => !document.querySelector(".animate-spin"));
      await s.page.click('[data-testid="folder-row"] >> text=IB Resources');
      await resourceScenario(s, { pdf: "Teacher planning grid", openPath: "t-pdf.pdf", hasOffice: false });
    });
    await session("admin", { w, h, theme }, "admin", async ({ page, ctx, tag, shot, touch }) => {
      await goto(page, "/admin/resources", theme);
      await page.waitForSelector('button[aria-label^="View Locked notes"]'); await page.waitForFunction(() => !document.querySelector(".animate-spin"));
      const n = await page.locator('[data-testid="resource-view"]').count();
      check(n === 7 && (await page.locator('[data-testid="resource-download"]').count()) === 6, `${tag}: admin list: View on all ${n} rows, Download on the 6 stored PDF/PPTX/PNG files (links excluded)`);
      check((await page.locator('button[aria-label="Preview"]').count()) === 0, `${tag}: old single Preview button replaced`);
      await shot("0-admin-list"); await geometry(page, `${tag} admin`, { touch });
      const popupP = ctx.waitForEvent("page"); await page.locator('button[aria-label="View Locked notes in a new tab"]').click();
      const popup = await popupP; await popup.waitForURL(/r-lock\.pdf/, { timeout: 8000 });
      check(true, `${tag}: admin can open a LOCKED resource's file to check the upload`);
      await popup.close();
      const [d] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), page.locator('button[aria-label="Download Revision slides"]').click()]);
      check(d.suggestedFilename() === "Revision slides.pptx", `${tag}: admin Download works for an Office file (${d.suggestedFilename()})`);
    });
    await session("admin", { w, h, theme }, "admin-switches", async ({ page, rec, tag, shot, touch }) => {
      await goto(page, "/admin/simulations", theme);
      await page.waitForSelector('[data-switch="download-requires-premium"]');
      const sw = page.locator('[data-switch="download-requires-premium"]');
      check(!(await sw.isDisabled()) && (await sw.getAttribute("aria-checked")) === "false", `${tag}: 'Downloads are Premium-only' switch present, off, enabled`);
      const label = await page.textContent("#download-requires-premium-label"); const help = await page.textContent("#download-requires-premium-desc");
      check(label === "Downloads are Premium-only" && /Only takes effect when Premium/.test(help) && /right now everything is free/.test(help), `${tag}: label and helper text`);
      const box = await sw.boundingBox(); check(box && box.x >= 0 && box.x + box.width <= w, `${tag}: switch inside the viewport`);
      await shot("0-switches"); await geometry(page, `${tag} switches`, { touch });
      await sw.click(); await page.waitForFunction(() => document.querySelector('[data-switch="download-requires-premium"]')?.getAttribute("aria-checked") === "true");
      check(JSON.stringify(rec.saved) === JSON.stringify([{ download_requires_premium: true }]), `${tag}: saving sends only download_requires_premium (${JSON.stringify(rec.saved)})`);
      check(/Saved; no effect while Premium is off/.test(await page.textContent("#download-requires-premium-desc")) && (await page.locator("[data-banner='all-free']").count()) === 1, `${tag}: still says everything is free while Premium is off`);
      await shot("1-switch-on");
    });
  }
} finally {
  await browser.close(); server.kill(); fs.rmSync(dist, { recursive: true, force: true });
}
console.log(`\n${checks - bad.length}/${checks} checks passed. Screenshots: ${out}`);
if (bad.length) { console.log("FAILURES:\n - " + bad.join("\n - ")); process.exitCode = 1; }
