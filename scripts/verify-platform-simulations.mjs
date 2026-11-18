#!/usr/bin/env node
// Headless-Chromium verification of the platform restructure: landing page, student + teacher simulation library, opening a
// simulation inside the role layout (Fullscreen / New Tab), the locked screen when the config is flipped, and
// /admin/simulations -- against a REAL production build whose Supabase calls are answered by page.route() mocks.
//   node scripts/verify-platform-simulations.mjs [outDir]      (npm run verify:platform)
//   env: QUICK=1 only the 1366x768 light pass   CHROMIUM=/path/to/chrome   BASE_URL=http://host:port (reuse a server that was built with the fake
//        Supabase env below; otherwise this script builds to a temp dir and runs `vite preview`)
// HOW THE MOCK WORKS: the app is built with VITE_SUPABASE_URL=http://127.0.0.1:54399 (nothing listens there).  Every request
// to that origin is fulfilled by page.route(): /auth/v1/* (session is seeded into localStorage), and /rest/v1/<table> from an
// in-memory `db` (profiles, platform_settings(_public), simulation_access; any other table answers empty).  So the app's REAL
// services (accessConfigService, AuthContext ...) run unmodified; only the network is faked.
// Per page it checks: no console errors / page errors, no horizontal page overflow, no controls clipped off the viewport edge.
// NOT proven: a real Supabase project / RLS, real GPU (SwiftShader only), touch, Safari / Firefox, real screen readers.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] || "/tmp/platform-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const SB = "http://127.0.0.1:54399";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = []; let checks = 0;
function check(cond, msg) { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } else console.log("  ok  ", msg); }

// ---------------------------------------------------------------- server
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
let server = null; let tmp = null; let base = process.env.BASE_URL;
if (!base) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "elab-verify-"));
  console.log("building to", tmp);
  await new Promise((resolve, reject) => {
    const c = spawn("npx", ["vite", "build", "--outDir", tmp, "--emptyOutDir"], { cwd: root, stdio: "ignore", env: { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key" } });
    c.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build failed"))));
  });
  const port = await freePort();
  server = spawn("npx", ["vite", "preview", "--outDir", tmp, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* starting */ } await sleep(200); }
}

// ---------------------------------------------------------------- mock Supabase
const USERS = {
  student: { id: "u-student", email: "student@example.com", role: "student", level: "HL", full_name: "Test Student" },
  teacher: { id: "u-teacher", email: "teacher@example.com", role: "teacher", level: "HL", full_name: "Test Teacher" },
  admin: { id: "u-admin", email: "admin@example.com", role: "admin", level: "HL", full_name: "Test Admin" },
};
function freshDb(opts = {}) {
  return {
    flags: { premium_enabled: false, require_login_for_simulations: false },
    flagColumns: opts.flagColumns !== false,          // false => the 001 columns do not exist yet
    simAccess: opts.simTable === false ? null : [],   // null => the 002 table does not exist yet
    log: [],                                          // every write the app made: { table, method, body }
  };
}
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-expose-headers": "*" };
const json = (route, status, body) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });

async function installMock(context, getDb, roleOf) {
  await context.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const db = getDb(); const role = roleOf();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname.startsWith("/auth/v1/")) {
      if (role && USERS[role]) return json(route, 200, { id: USERS[role].id, aud: "authenticated", email: USERS[role].email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
      return json(route, 401, { message: "no session" });
    }
    const m = url.pathname.match(/^\/rest\/v1\/([^/]+)/);
    if (!m) return json(route, 404, {});
    const table = m[1]; const wantObject = /pgrst\.object/.test(req.headers().accept || "");
    const answer = (rows) => (wantObject ? (rows.length === 1 ? json(route, 200, rows[0]) : json(route, 406, { code: "PGRST116", message: "no rows" })) : json(route, 200, rows));
    let body = null; try { body = req.postDataJSON(); } catch { /* no body */ }
    if (req.method() !== "GET") db.log.push({ table, method: req.method(), body });
    if (table === "profiles") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      const u = Object.values(USERS).find((x) => x.id === id) ?? USERS[role];
      return answer(u ? [{ id: u.id, role: u.role, status: "active", level: u.level, full_name: u.full_name, email: u.email }] : []);
    }
    if (table === "platform_settings_public") {
      if (!db.flagColumns) return json(route, 400, { code: "42703", message: "column premium_enabled does not exist" });
      return answer([{ platform_name: "e-Lab", tagline: "Making Science Interactive.", allow_student_registration: true, allow_teacher_registration: true, maintenance_mode: false, maintenance_message: "", ...db.flags }]);
    }
    if (table === "platform_settings") {
      const row = { id: 1, platform_name: "e-Lab", tagline: "Making Science Interactive.", support_email: null, contact_email: null, allow_student_registration: true, allow_teacher_registration: true, default_curriculum: "IB DP Chemistry", default_resource_access: "free", maintenance_mode: false, maintenance_message: "", ...(db.flagColumns ? db.flags : {}) };
      if (req.method() === "PATCH") {
        if (!db.flagColumns) return json(route, 400, { code: "42703", message: "column does not exist" });
        Object.assign(db.flags, body);
        return answer([{ ...row, ...db.flags }]);
      }
      return answer([row]);
    }
    if (table === "simulation_access") {
      if (db.simAccess === null) return json(route, 404, { code: "42P01", message: 'relation "public.simulation_access" does not exist' });
      if (req.method() === "POST") {
        for (const r of [].concat(body)) { const i = db.simAccess.findIndex((x) => x.sim_id === r.sim_id); if (i >= 0) db.simAccess[i] = { ...db.simAccess[i], ...r }; else db.simAccess.push({ tier: "free", featured: false, ...r }); }
        return route.fulfill({ status: 201, headers: CORS, body: "" });
      }
      return answer(db.simAccess);
    }
    return answer([]); // every other table: empty
  });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
}

// ---------------------------------------------------------------- browser helpers
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const IGNORE = [/THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ReadPixels/, /Download the React DevTools/, /net::ERR_FAILED.*fonts/, /Failed to load resource.*(fonts|ERR_FAILED)/, /Supabase is not configured/];
const SIZES = process.env.QUICK ? [[1366, 768]] : [[1366, 768], [390, 844]];
const THEMES = process.env.QUICK ? ["light"] : ["light", "dark"];

async function session({ role, theme = "light", size = [1366, 768], db = freshDb(), reducedMotion = "no-preference" }) {
  let currentRole = role;
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] }, reducedMotion });
  await installMock(context, () => db, () => currentRole);
  await context.addInitScript(({ role: r, theme: t, user, url }) => {
    try {
      localStorage.setItem("e-lab:theme", t);
      if (r && user) {
        const now = Math.floor(Date.now() / 1000);
        localStorage.setItem(`sb-${new URL(url).hostname.split(".")[0]}-auth-token`, JSON.stringify({ access_token: "tok", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user: { id: user.id, aud: "authenticated", email: user.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
      }
    } catch { /* ignore */ }
    window.__gl = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) { if (/webgl/i.test(String(type))) window.__gl += 1; return orig.call(this, type, ...a); };
  }, { role, theme, user: USERS[role], url: SB });
  const page = await context.newPage();
  const errors = []; const chunkRequests = [];
  page.on("console", (m) => { if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("request", (r) => { if (/\/assets\/.*\.js/.test(r.url())) chunkRequests.push(r.url()); });
  return { page, context, db, errors, chunkRequests, setRole: (r) => { currentRole = r; } };
}

/** Generic health checks for the page currently loaded. */
async function health(S, label) {
  const { page, errors } = S;
  await sleep(250);
  const r = await page.evaluate(() => {
    const doc = document.documentElement; const vw = window.innerWidth;
    const scrollable = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return true; } return false; };
    const clipped = [];
    for (const el of document.querySelectorAll("button, a[href], input, select, textarea, [role=button], [role=switch]")) {
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
      const b = el.getBoundingClientRect(); if (b.width === 0 || b.height === 0) continue;
      if ((b.right > vw + 1 || b.left < -1) && !scrollable(el)) clipped.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(b.left)}..${Math.round(b.right)}`);
    }
    return { overflow: doc.scrollWidth - doc.clientWidth, clipped: clipped.slice(0, 5), h1: document.querySelectorAll("h1").length, bodyOverflowX: getComputedStyle(document.body).overflowX };
  });
  check(r.overflow <= 0, `${label}: no horizontal page overflow (${r.overflow}px)`);
  check(r.clipped.length === 0, `${label}: no controls clipped at the viewport edge ${r.clipped.join("; ")}`);
  const real = errors.filter((e) => !(S.expectMissingTables && /Failed to load resource: the server responded with a status of (400|404)/.test(e)));
  check(real.length === 0, `${label}: no console / page errors ${real.slice(0, 2).join(" | ")}`);
  return r;
}
const shot = (S, name) => S.page.screenshot({ path: path.join(out, `${name}.png`) }).catch(() => {});
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const NO_PREMIUM = /premium|notify|upgrade|pricing|\bplans\b/i;
const tag = (size, theme) => `${size[0]}x${size[1]} ${theme}`;

// ================================================================ 1. landing page
console.log("\n== Landing page (signed out, everything free) ==");
for (const size of SIZES) for (const theme of THEMES) {
  const S = await session({ role: null, theme, size });
  const { page } = S; const t = tag(size, theme);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForSelector("h1"); await sleep(1200);
  const h = await health(S, `landing ${t}`);
  check(h.h1 === 1, `landing ${t}: exactly one h1`);
  const text = await bodyText(page);
  check(!NO_PREMIUM.test(text), `landing ${t}: no Premium / plans / Notify / upgrade wording`);
  check(await page.evaluate(() => window.__gl) === 0, `landing ${t}: no WebGL context created on first load`);
  check(!S.chunkRequests.some((u) => /(BuildAtom|VSEPR|PhaseChange|ElectronConfiguration|SimulationDashboard)/.test(u)), `landing ${t}: no simulation engine chunk fetched before the demo is requested`);
  check(await page.locator("[data-live-demo][data-running=false]").count() === 1, `landing ${t}: demo shows the static screenshot until requested`);
  check(/IB Chemistry you can\s+see, move\s+and test\./.test(await page.locator("h1").innerText()), `landing ${t}: headline`);
  check(await page.locator("#simulations li").count() === 3, `landing ${t}: showcase has 3 featured simulations (VSEPR, Heating Curve, Hybridisation)`);
  check((await page.locator("[data-browse-all]").getAttribute("href")).startsWith("/auth?role=student&next="), `landing ${t}: Browse all -> log in first when signed out`);
  check((await page.title()).includes("IB Chemistry"), `landing ${t}: page title`);
  if (size[0] === 1366 && theme === "light") {
    await shot(S, "landing-1366-light-top");
    // head metadata
    const meta = await page.evaluate(() => ({ desc: document.querySelector('meta[name=description]')?.content, og: document.querySelector('meta[property="og:title"]')?.content, tw: document.querySelector('meta[name="twitter:card"]')?.content, imgs: [...document.images].filter((i) => !i.alt && i.getAttribute("alt") === null).length }));
    check(meta.desc?.length > 50 && meta.og && meta.tw, "landing: description + Open Graph + Twitter tags present");
    check(meta.imgs === 0, "landing: every image has an alt attribute");
    // Role strip keeps its routing: signed out -> /auth?role=...
    await page.locator("[data-role-card=teacher]").click(); await page.waitForURL(/\/auth\?role=teacher/);
    check(true, "landing: 'I'm a Teacher' routes to /auth?role=teacher");
    await page.goto(`${base}/`); await page.waitForSelector("h1");
    // FAQ accordion
    const q = page.locator("#faq button[aria-expanded]").first();
    await q.scrollIntoViewIfNeeded(); await q.focus(); await page.keyboard.press("Enter");
    check(await q.getAttribute("aria-expanded") === "true" && await page.locator("#faq [role=region]:visible").count() === 1, "landing: FAQ opens from the keyboard (Enter) and exposes the answer region");
    await page.keyboard.press("Space"); // space toggles a button too
    check(await q.getAttribute("aria-expanded") === "false", "landing: FAQ closes again");
    // demo: request it
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("[data-try-simulation]").click();
    await page.waitForFunction(() => document.querySelector("[data-live-demo]")?.getAttribute("data-running") === "true");
    await page.waitForSelector("[data-demo-stage] .elab-sim, [data-demo-stage] .sd-frame", { timeout: 20000 });
    await sleep(2500);
    check(true, "landing: 'Try a simulation' mounts the live demo (VSEPR Explorer 3D)");
    const stage = await page.evaluate(() => {
      const st = document.querySelector("[data-demo-stage]").getBoundingClientRect();
      const bad = [];
      const inScroller = (el) => { for (let n = el.parentElement; n && n.id !== "demo"; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight + 1) return true; } return false; };
      for (const el of document.querySelectorAll("[data-demo-stage] button")) { if (inScroller(el)) continue; const b = el.getBoundingClientRect(); if (b.width && (b.right > st.right + 1 || b.left < st.left - 1 || b.top < st.top - 1 || b.bottom > st.bottom + 1)) bad.push((el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 25)); }
      return { w: st.width, h: st.height, bad: bad.slice(0, 5), title: document.querySelector("[data-live-demo] p")?.textContent };
    });
    check(stage.bad.length === 0, `landing: demo controls all inside the demo panel ${stage.bad.join(", ")}`);
    await shot(S, "landing-1366-light-demo");
    await page.locator("#demo [aria-pressed]").nth(1).click(); await sleep(3000);
    check((await page.locator("[data-live-demo] p").first().innerText()).length > 0 && await page.locator("[data-demo-stage] .elab-sim, [data-demo-stage] .sd-frame").count() >= 1, "landing: demo chip switches to another featured simulation");
    check((await page.evaluate(() => window.__gl)) >= 1, `landing: WebGL only after the 3D demo was chosen (contexts: ${await page.evaluate(() => window.__gl)})`);
    check(S.errors.length === 0, `landing: no errors while running the demos ${S.errors.slice(0, 2).join(" | ")}`);
  }
  if (size[0] === 390) {
    await page.goto(`${base}/`); await page.waitForSelector("h1");
    await page.locator("button[aria-label='Open menu']").click();
    check(await page.locator("#public-mobile-menu a").count() >= 4 && await page.locator("#public-mobile-menu a", { hasText: "Log in" }).count() === 1, `landing ${t}: mobile menu lists the nav links and Log in`);
    await health(S, `landing ${t} (menu open)`);
    if (theme === "light") await shot(S, "landing-390-light-menu");
  }
  if (size[0] === 390) { await page.goto(`${base}/`); await sleep(500); await page.screenshot({ path: path.join(out, `landing-390-${theme}-full.png`), fullPage: true }).catch(() => {}); }
  else if (theme === "dark") await page.screenshot({ path: path.join(out, "landing-1366-dark-full.png"), fullPage: true }).catch(() => {});
  else await page.screenshot({ path: path.join(out, "landing-1366-light-full.png"), fullPage: true }).catch(() => {});
  await S.context.close();
}
{ // reduced motion: the in-page nav link and the hero button still work
  const S = await session({ role: null, reducedMotion: "reduce" }); const { page } = S;
  await page.goto(`${base}/`); await page.waitForSelector("h1");
  await page.locator("nav[aria-label=Main] a", { hasText: "For teachers" }).click(); await sleep(400);
  check(await page.evaluate(() => document.getElementById("teachers").getBoundingClientRect().top < 120), "landing (reduced motion): nav link scrolls to the section immediately");
  check(S.errors.length === 0, "landing (reduced motion): no errors");
  await S.context.close();
}

// ================================================================ 2. signed-in landing ("continue where you left off")
console.log("\n== Landing page signed in ==");
{
  const S = await session({ role: "student" }); const { page } = S;
  await page.goto(`${base}/`); await page.waitForSelector("[data-continue-card]"); await sleep(800);
  check(/Continue where you left off/.test(await page.locator("[data-continue-card]").innerText()), "landing (student): 'Continue where you left off'");
  check((await page.locator("[data-browse-all]").getAttribute("href")) === "/student/simulations", "landing (student): Browse all -> /student/simulations");
  await page.locator("[data-role-card=student]").click(); await page.waitForURL(/\/student/);
  check(true, "landing (student): 'I'm a Student' goes straight into /student");
  await S.context.close();
}

// ================================================================ 3. libraries
for (const role of ["student", "teacher"]) {
  console.log(`\n== ${role} simulation library (everything free) ==`);
  for (const size of SIZES) for (const theme of THEMES) {
    const S = await session({ role, theme, size }); const { page } = S; const t = tag(size, theme);
    await page.goto(`${base}/${role}/simulations`, { waitUntil: "load" });
    await page.waitForSelector("[data-sim-grid] article", { timeout: 20000 }); await sleep(800);
    await health(S, `${role} library ${t}`);
    check(await page.locator("[data-sim-grid] article").count() === 27, `${role} library ${t}: 27 live simulations listed`);
    check(!NO_PREMIUM.test(await bodyText(page)), `${role} library ${t}: no Premium chrome`);
    check(await page.locator("[data-chip^='tier'], [data-tier-badge], [data-lock-chip]").count() === 0, `${role} library ${t}: no tier chips / badges / locks`);
    const navLabels = await page.locator("nav a").allInnerTexts();
    const expected = role === "student" ? ["Learn", "Simulations", "Assess", "Resources", "Progress"] : ["Teach", "Class Planner", "Simulations", "Question Builder", "Resources"];
    check(JSON.stringify(navLabels.filter((l) => expected.includes(l.trim())).map((l) => l.trim())) === JSON.stringify(expected), `${role} library ${t}: nav = ${expected.join(" | ")}`);
    check(await page.locator("nav a[aria-current=page]").innerText().then((s) => s.trim()) === "Simulations", `${role} library ${t}: Simulations tab is the active one`);
    if (size[0] === 1366) {
      const tabs = await page.evaluate(() => { const n = document.querySelector("nav"); return { sw: n.scrollWidth, cw: n.clientWidth }; });
      check(tabs.sw <= tabs.cw, `${role} library ${t}: all tabs fit without scrolling the nav (${tabs.sw}/${tabs.cw})`);
    }
    if (theme === "light" && size[0] === 1366) {
      await shot(S, `${role}-library-1366-light`);
      const actionWord = role === "teacher" ? "Present" : "Open";
      check((await page.locator("[data-sim-grid] article").first().innerText()).includes(actionWord), `${role} library: card action says "${actionWord}"`);
      await page.locator("main input[placeholder^='Search simulations']").fill("S2.2"); await sleep(150);
      check(await page.locator("[data-sim-grid] article").count() === 6, `${role} library: search "S2.2" finds the 6 S2.2 simulations`);
      await page.locator("main input[placeholder^='Search simulations']").fill("");
      await page.locator("main select").selectOption("za"); await sleep(150);
      const first = await page.locator("[data-sim-grid] article h2").first().innerText();
      check(first.startsWith("Wave") || first.startsWith("VSEPR"), `${role} library: Z->A puts "${first}" first`);
      await page.locator("main select").selectOption("az");
      await page.locator("[data-chip='topic:Kinetics']").click();
      check(await page.locator("[data-sim-grid] article").count() === 2, `${role} library: Kinetics chip filters`);
      await page.locator("[data-chip='all']").click();
      await page.locator("article[data-sim-id='build-an-atom'] button[aria-pressed]").click();
      await page.locator("[data-chip='favourites']").click();
      check(await page.locator("[data-sim-grid] article").count() === 1, `${role} library: favourite star + Favourites chip`);
      await page.reload(); await page.waitForSelector("[data-sim-grid] article");
      await page.locator("[data-chip='favourites']").click();
      check(await page.locator("[data-sim-grid] article").count() === 1, `${role} library: favourite survives a reload (localStorage)`);
      await page.locator("[data-chip='all']").click();
      await page.locator("main input[type=checkbox]").check();
      check(await page.locator("article[data-live=false]").count() >= 10 && await page.locator("article[data-live=false] a").count() === 0, `${role} library: coming-soon items shown but not openable`);
      await page.locator("main input[type=checkbox]").uncheck();

      // ---- open one inside the layout
      await page.locator("article[data-sim-id='build-an-atom'] h2 a").click();
      await page.waitForURL(new RegExp(`/${role}/simulations/build-an-atom$`));
      await page.waitForSelector(".elab-sim, .sd-frame", { timeout: 20000 }); await sleep(1500);
      check(await page.locator("nav a", { hasText: "Simulations" }).first().getAttribute("aria-current") === "page", `${role} viewer: Simulations tab stays active`);
      check(await page.locator("[data-testid=sim-fullscreen]").count() === 1 && await page.locator("[data-testid=sim-new-tab]").count() === 1, `${role} viewer: exactly one Fullscreen and one Open-in-New-Tab button (no duplicates)`);
      check(await page.locator("h1").count() === 1, `${role} viewer: one h1`);
      await health(S, `${role} viewer`);
      await shot(S, `${role}-viewer-1366-light`);
      await page.locator("[data-testid=sim-fullscreen]").click(); await sleep(700);
      const fsOn = await page.evaluate(() => { const el = document.querySelector("[data-elab-fullscreen]"); return el ? el.getAttribute("data-elab-fullscreen") : null; });
      check(fsOn === "native" || fsOn === "css", `${role} viewer: Fullscreen works (${fsOn})`);
      await page.keyboard.press("Escape"); await sleep(500);
      if (await page.evaluate(() => Boolean(document.querySelector("[data-elab-fullscreen]")))) { await page.locator("[data-testid=sim-fullscreen]").first().click().catch(() => {}); await sleep(400); }
      check(await page.evaluate(() => !document.querySelector("[data-elab-fullscreen]")), `${role} viewer: leaves fullscreen`);
      const [popup] = await Promise.all([page.context().waitForEvent("page", { timeout: 8000 }).catch(() => null), page.locator("[data-testid=sim-new-tab]").click()]);
      check(popup && /\/simulation\/build-an-atom$/.test(popup.url()), `${role} viewer: Open in New Tab opens /simulation/build-an-atom (${popup?.url()})`);
      if (popup) await popup.close();
      await page.locator("a", { hasText: "Simulations" }).filter({ has: page.locator("svg") }).first().click(); await page.waitForSelector("[data-sim-grid]");
      await page.locator("[data-chip='recent']").click();
      check(await page.locator("[data-sim-grid] article").count() === 1, `${role} library: opened simulation appears under Recently used`);
    }
    if (size[0] === 390) {
      await page.goto(`${base}/${role}/simulations/vsepr-explorer-3d`); await page.waitForSelector(".elab-sim, .sd-frame", { timeout: 20000 }); await sleep(2000);
      await health(S, `${role} viewer ${t}`);
      if (theme === "light") await shot(S, `${role}-viewer-390-light`);
    }
    if (size[0] === 390 && theme === "light") await shot(S, `${role}-library-390-light`);
    await S.context.close();
  }
}

// ================================================================ 4. flipping the config shows the locked prompt
console.log("\n== Premium switched ON (draft tables present): chrome and locked screen appear ==");
{
  const db = freshDb(); db.flags.premium_enabled = true; db.simAccess.push({ sim_id: "wave-explorer", tier: "premium", featured: false });
  const S = await session({ role: "student", db }); const { page } = S;
  await page.goto(`${base}/student/simulations`); await page.waitForSelector("[data-sim-grid] article"); await sleep(1000);
  check(await page.locator("[data-chip='tier:free']").count() === 1 && await page.locator("[data-chip='tier:premium']").count() === 1, "premium on: Free / Premium chips appear");
  check(await page.locator("[data-tier-badge]").count() >= 20 && await page.locator("[data-lock-chip]").count() === 1, "premium on: tier badges and exactly one lock chip");
  await shot(S, "student-library-premium-on");
  await page.locator("article[data-sim-id='wave-explorer'] h2 a").click(); await page.waitForSelector("[data-locked-content]");
  check(/This is a Premium simulation/.test(await bodyText(page)) && !/notify/i.test(await bodyText(page)), "premium on: locked screen for a Premium simulation, no 'Notify me'");
  await health(S, "locked screen");
  await shot(S, "locked-screen-1366-light");
  await page.goto(`${base}/simulation/wave-explorer`); await page.waitForSelector("[data-locked-content]");
  check(true, "premium on: the standalone /simulation/:id route is gated by the same policy");
  await page.goto(`${base}/`); await page.waitForSelector("h1"); await sleep(800);
  check(await page.locator("#plans").count() === 1, "premium on: landing Plans section renders (only now)");
  check(!/notify/i.test(await bodyText(page)), "premium on: still no 'Notify me'");
  await S.context.close();
  const S2 = await session({ role: "student", db: freshDb({ flagColumns: false, simTable: false }) }); S2.expectMissingTables = true;
  await S2.page.goto(`${base}/student/simulations/wave-explorer`); await S2.page.waitForSelector(".elab-sim, .sd-frame", { timeout: 20000 });
  check(true, "tables / columns missing (errors from the DB): the simulation simply opens, everything free");
  check(S2.errors.filter((e) => !/status of (400|404)/.test(e)).length === 0, `tables missing: no console errors other than the expected 400/404 for the absent objects ${S2.errors.slice(0, 2).join(" | ")}`);
  await S2.context.close();
}

// ================================================================ 5. admin page
console.log("\n== /admin/simulations ==");
for (const size of SIZES) for (const theme of THEMES) {
  const S = await session({ role: "admin", theme, size, db: freshDb() }); const { page } = S; const t = tag(size, theme);
  await page.goto(`${base}/admin/simulations`); await page.waitForSelector("[data-sim-table]"); await sleep(600);
  await health(S, `admin simulations ${t}`);
  check(/Everything is currently free for everyone/.test(await bodyText(page)), `admin ${t}: banner "Everything is currently free for everyone"`);
  if (size[0] === 1366 && theme === "light") {
    await shot(S, "admin-simulations-1366-light");
    check(await page.locator("[data-sim-row]").count() === 27, "admin: 27 live simulations listed");
    const sw = page.locator("[data-switch=premium-enabled]");
    check(await sw.getAttribute("aria-checked") === "false" && !(await sw.isDisabled()), "admin: Premium switch is OFF and enabled when the DB settings exist");
    const lock = page.locator("#lock-vsepr-explorer-3d");
    check(await lock.getAttribute("aria-pressed") === "false" && await lock.getAttribute("title") === "Lock for Premium", "admin: default is unlocked (free); tooltip says 'Lock for Premium'");
    check(await page.locator("select[id^='tier-']").count() === 0, "admin: the Access-level dropdowns are gone");
    check(await lock.evaluate((el) => { const r = el.getBoundingClientRect(); return r.width >= 32 && r.height >= 32; }), "admin: lock button is a usable tap target (>=32px)");
    await lock.click(); await sleep(500);
    const w = S.db.log.find((l) => l.table === "simulation_access");
    check(w && w.body.sim_id === "vsepr-explorer-3d" && w.body.tier === "premium" && w.body.featured === true, `admin: locking upserts {sim_id,tier:'premium',featured} (${JSON.stringify(w?.body)})`);
    check(await lock.getAttribute("aria-pressed") === "true" && await lock.getAttribute("title") === "Unlock (free)", "admin: pressed state + tooltip flip to 'Unlock (free)'");
    check(/Locks only take effect when Premium is switched on/.test(await bodyText(page)) && /open to everyone while Premium is off/.test(await bodyText(page)), "admin: helper says locks only matter once Premium is on / everything is free now");
    await shot(S, "admin-simulations-1366-light-locked");
    await page.locator("button[aria-label^='Remove VSEPR Explorer']").click(); await sleep(400);
    const f = S.db.log.filter((l) => l.table === "simulation_access").at(-1);
    check(f.body.featured === false && f.body.tier === "premium", `admin: Featured star toggles and keeps the tier (${JSON.stringify(f.body)})`);
    await page.locator("[data-switch=require-login]").click(); await sleep(400);
    check(S.db.flags.require_login_for_simulations === true, "admin: 'Require login' switch writes require_login_for_simulations");
    await page.locator("[data-switch=require-login]").click(); await sleep(300);
    await sw.click(); await page.waitForSelector("[role=dialog]");
    check(await page.locator("[role=dialog]").innerText().then((x) => /Turn Premium ON/.test(x)), "admin: turning Premium on asks for confirmation");
    await page.locator("[role=dialog] button", { hasText: "Cancel" }).click(); await sleep(200);
    check(S.db.flags.premium_enabled === false, "admin: cancelling leaves Premium off");
    await sw.click(); await page.locator("[role=dialog] button", { hasText: "Turn on" }).click(); await sleep(600);
    check(S.db.flags.premium_enabled === true && await page.locator("[data-banner=premium-on]").count() === 1, "admin: confirming switches Premium on and the banner changes");
    await sw.click(); await sleep(500);
    check(S.db.flags.premium_enabled === false && await page.locator("[data-banner=all-free]").count() === 1, "admin: switching it off restores the 'everything free' banner");
  }
  await S.context.close();
}
{
  const S = await session({ role: "admin", db: freshDb({ flagColumns: false, simTable: false }) }); S.expectMissingTables = true; const { page } = S;
  await page.goto(`${base}/admin/simulations`); await page.waitForSelector("[data-sim-table]"); await sleep(600);
  check(await page.locator("[data-notice=config-missing]").count() === 1 && await page.locator("[data-notice=table-missing]").count() === 1, "admin (tables not created): both notices shown");
  const enabled = await page.evaluate(() => [...document.querySelectorAll("[data-sim-table] select, [data-sim-table] button, [data-switch]")].filter((e) => !e.disabled).length);
  check(enabled === 0, `admin (tables not created): every control is disabled (${enabled} enabled)`);
  await health(S, "admin simulations (tables missing)");
  await shot(S, "admin-simulations-tables-missing");
  await S.context.close();
}

await browser.close();
if (server) server.kill();
if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${checks - problems.length}/${checks} checks passed  (screenshots: ${out})`);
if (problems.length) { console.log("FAILURES:\n - " + problems.join("\n - ")); process.exitCode = 1; }
