// Headless-Chromium check of the TEACHER sign-up fields (School name + Professional field) and their profile-page display/edit.
// Usage: node scripts/verify-teacher-signup-fields.mjs [outDir]
// Same technique as scripts/verify-auth-signup-confirmation.mjs: builds the app into a temp dir WITH fake Supabase env vars,
// serves it with `vite preview`, answers every Supabase call via page.route (NO live Supabase).
// Viewports: 320x640, 390x844, 1366x768, 1920x1080; light + dark. Screenshots are written for human review.
// Honest limits: mocked network (no real signUp, trigger, RLS or email); Chromium only; only geometry, contrast of the error
// text, labels/ARIA, focus and the request payloads are asserted - visual polish is judged from the screenshots.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";

const free = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const cwd = new URL("..", import.meta.url).pathname;
const tmp = process.env.TMPDIR || "/tmp";
const out = process.argv[2] || `${tmp}/teacher-signup-shots`;
const dist = `${tmp}/teacher-signup-dist-${process.pid}`;
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UID = "00000000-0000-0000-0000-000000000001";
const profileFor = (role, extra = {}) => ({ id: UID, email: "ada@example.com", full_name: "Ada Test", role, status: "active", level: null, curriculum: "IB Diploma Programme", school: "Greenfield International School", country: null, grade_or_class: "DP1", ...extra });
const sessionFor = (meta) => ({ access_token: "mock-access", refresh_token: "mock-refresh", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: UID, aud: "authenticated", email: "ada@example.com", role: "authenticated", identities: [{ id: "i" }], user_metadata: meta, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

async function installMock(page, meta) {
  const db = { signUps: [], userUpdates: [], profilePatches: [] };
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const m = req.method();
    const h = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
    const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", headers: h, body: JSON.stringify(b) });
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: h });
    const single = /pgrst\.object/.test(req.headers().accept ?? "");
    const wrap = (rows) => (single ? json(rows[0]) : json(rows));
    const path = url.pathname; const body = () => { try { return req.postDataJSON(); } catch { return null; } };
    if (path.startsWith("/auth/v1/signup")) { db.signUps.push(body()); return json({ id: UID, aud: "authenticated", email: "ada@example.com", identities: [{ id: "i" }], user_metadata: body()?.data ?? {}, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" }); }
    if (path.startsWith("/auth/v1/user")) { if (m === "PUT") { db.userUpdates.push(body()); return json(sessionFor({ ...meta, ...(body()?.data ?? {}) }).user); } return json(sessionFor(meta).user); }
    if (path.startsWith("/auth/v1/")) return json(sessionFor(meta));
    const mt = path.match(/^\/rest\/v1\/([a-z_]+)$/); if (!mt) return json([]);
    if (mt[1] === "profiles") {
      if (m === "PATCH") { db.profilePatches.push(body()); return wrap([{ ...profileFor("teacher"), ...body() }]); }
      return wrap([profileFor("teacher")]);
    }
    if (mt[1] === "platform_settings" || mt[1] === "platform_settings_public") return wrap([{ id: 1, premium_enabled: false, require_login_for_simulations: false, allow_student_registration: true, allow_teacher_registration: true }]);
    return json([]);
  });
  return db;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] });
const goto = async (page, path, theme) => { await page.goto(`${base}${path}`); await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme); };

// WCAG contrast of an element's text against its effective background (colours normalised through a canvas pixel).
async function contrast(page, selector) {
  return page.evaluate((sel) => {
    const px = (css) => { const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d"); x.clearRect(0, 0, 1, 1); x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const el = document.querySelector(sel); if (!el) return null;
    const fg = px(getComputedStyle(el).color);
    let bg = [255, 255, 255, 1];
    for (let n = el; n; n = n.parentElement) { const c = px(getComputedStyle(n).backgroundColor); if (c[3] > 0.5) { bg = c; break; } }
    const [a, b] = [lum(fg), lum(bg)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, selector);
}
async function geometry(page, tag) {
  const g = await page.evaluate(() => {
    const vw = window.innerWidth; const clipped = [];
    // The signed-in teacher top bar (Class Planner / Simulations / ...) is pre-existing site chrome, not part of this feature:
    // it is excluded from the clipping list and from the overflow figure, which is measured on the page content instead.
    for (const el of document.querySelectorAll("main button, main a[href], main input, main select, main textarea, main label, main dd, main dt, form button, form input, form select, form label")) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || el.closest(".sr-only")) continue;
      if (r.left < -1 || r.right > vw + 1) clipped.push(`${el.tagName.toLowerCase()}:${(el.textContent || el.id || "").trim().slice(0, 28)}`);
    }
    const main = document.querySelector("main"); const overflowX = Math.max(0, ...[...(main ?? document.body).querySelectorAll("*")].filter((e) => !e.closest(".sr-only")).map((e) => e.getBoundingClientRect().right - vw));
    return { overflowX: Math.round(overflowX), clipped };
  });
  check(g.overflowX <= 0, `${tag}: no horizontal page overflow (${g.overflowX})`);
  check(g.clipped.length === 0, `${tag}: nothing clipped outside the viewport ${g.clipped.slice(0, 3).join("; ")}`);
}
async function session({ meta = {}, w, h, theme, name, signedIn }, fn) {
  const tag = `${name}-${theme}-${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([t, sess, si]) => { try { localStorage.setItem("e-lab:theme", t); if (si) localStorage.setItem("sb-mock-elab-auth-token", JSON.stringify(sess)); } catch { /* ignore */ } }, [theme, sessionFor(meta), signedIn]);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  const db = await installMock(page, meta);
  console.log(`\n== ${tag} ==`);
  const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png`, fullPage: true });
  try { await fn({ page, db, tag, shot }); } catch (e) { check(false, `${tag}: scenario threw ${e.message.split("\n")[0]}`); }
  check(errors.length === 0, `${tag}: no console/page errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}
const labelOk = async (page, id, re) => /./.test(await page.textContent(`label[for="${id}"]`)) && re.test(await page.textContent(`label[for="${id}"]`));

try {
  for (const theme of ["light", "dark"]) for (const [w, h] of [[320, 640], [390, 844], [1366, 768], [1920, 1080]]) {
    // ---------------------------------------------------------------- teacher sign-up
    await session({ w, h, theme, name: "signup-teacher", signedIn: false }, async ({ page, db, tag, shot }) => {
      await goto(page, "/auth?tab=create-account&role=teacher", theme);
      await page.waitForSelector("#su-school");
      check(await labelOk(page, "su-school", /School name.*required/) && await labelOk(page, "su-prof-field", /Professional field.*required/), `${tag}: both labels are associated and say required`);
      check(await page.getByLabel(/School name/).count() === 1 && await page.getByLabel(/Professional field/).count() === 1, `${tag}: reachable by accessible label`);
      await geometry(page, `${tag} form`); await shot("0-form");
      await page.fill("#su-name", "Ada Lovelace"); await page.fill("#su-email", "ada@example.com");
      await page.fill("#su-password", "longenough1"); await page.fill("#su-confirm", "longenough1");
      await page.click('button[type="submit"]');
      await page.waitForSelector("#su-school-error");
      check(await page.evaluate(() => document.activeElement?.id) === "su-school", `${tag}: focus moves to the first invalid field`);
      check(await page.getAttribute("#su-school", "aria-invalid") === "true" && await page.getAttribute("#su-school", "aria-describedby") === "su-school-error", `${tag}: aria-invalid + aria-describedby`);
      check(/Enter your school name\./.test(await page.textContent("#su-school-error")) && /Choose your professional field\./.test(await page.textContent("#su-prof-field-error")), `${tag}: both validation messages shown`);
      const cr = await contrast(page, "#su-school-error"); check(cr && cr >= 4.5, `${tag}: error text contrast ${cr?.toFixed(3)} >= 4.5`);
      check(db.signUps.length === 0, `${tag}: nothing sent while invalid`);
      await geometry(page, `${tag} errors`); await shot("1-errors");
      await page.fill("#su-school", "   Greenfield   International School  ");
      await page.selectOption("#su-prof-field", "other");
      check(await page.isVisible("#su-prof-other"), `${tag}: Other reveals the optional free-text field`);
      await page.fill("#su-prof-other", "Examiner");
      await geometry(page, `${tag} filled`); await shot("2-filled");
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="signup-confirmation"]');
      const d = db.signUps[0]?.data ?? {};
      check(d.school === "Greenfield International School" && d.professional_field === "other" && d.professional_field_other === "Examiner", `${tag}: payload ${JSON.stringify({ s: d.school, f: d.professional_field, o: d.professional_field_other })}`);
      check(d.role === "teacher" && Array.isArray(d.curricula) && d.curriculum === "IB Diploma Programme", `${tag}: role + curriculum metadata unchanged`);
      check(await page.textContent("h1") === "Check your email", `${tag}: 'Check your email' flow intact`);
    });
    // ---------------------------------------------------------------- student sign-up unchanged
    await session({ w, h, theme, name: "signup-student", signedIn: false }, async ({ page, db, tag, shot }) => {
      await goto(page, "/auth?tab=create-account&role=student", theme);
      await page.waitForSelector("#su-school");
      check(await page.locator("#su-prof-field").count() === 0 && (await page.textContent('label[for="su-school"]')).trim() === "School", `${tag}: student form has no teacher fields; School stays optional`);
      await geometry(page, `${tag} form`);
      await page.fill("#su-name", "Stu Dent"); await page.fill("#su-email", "stu@example.com"); await page.fill("#su-password", "longenough1"); await page.fill("#su-confirm", "longenough1");
      await page.click('button[type="submit"]'); await page.waitForSelector('[data-testid="signup-confirmation"]');
      const d = db.signUps[0]?.data ?? {};
      check(d.role === "student" && !("professional_field" in d) && d.school === "", `${tag}: student payload has no teacher keys`);
      if (w === 1366 || w === 320) await shot("0-student");
    });
    // ---------------------------------------------------------------- teacher profile
    await session({ meta: { curricula: ["ib-dp"], curriculum: "IB Diploma Programme", professional_field: "head-of-department" }, w, h, theme, name: "profile-teacher", signedIn: true }, async ({ page, db, tag, shot }) => {
      await goto(page, "/teacher/profile", theme);
      await page.waitForSelector('[data-testid="curriculum-chips"]');
      const rows = await page.$$eval("dl > div", (l) => Object.fromEntries(l.map((r) => [r.querySelector("dt").textContent, r.querySelector("dd").textContent.replace(/\s+/g, " ").trim()])));
      check(rows["School"] === "Greenfield International School" && rows["Professional field"] === "Head of Department / Faculty", `${tag}: view shows both (${rows["School"]} | ${rows["Professional field"]})`);
      await geometry(page, `${tag} view`); await shot("0-view");
      await page.click('button:has-text("Edit Profile")'); await page.waitForSelector("#pc-prof-field");
      check(await page.inputValue("#pc-prof-field") === "head-of-department" && await page.inputValue("#pc-school") === "Greenfield International School", `${tag}: edit form prefilled`);
      await page.fill("#pc-school", ""); await page.click('button:has-text("Save changes")');
      await page.waitForSelector("#pc-school-error");
      check(await page.evaluate(() => document.activeElement?.id) === "pc-school" && db.profilePatches.length === 0, `${tag}: clearing school is blocked, focus on it`);
      await geometry(page, `${tag} edit errors`); await shot("1-edit-error");
      await page.fill("#pc-school", "New Horizons School"); await page.selectOption("#pc-prof-field", "tutor");
      await page.click('button:has-text("Save changes")'); await sleep(600);
      check(db.userUpdates.at(-1)?.data?.professional_field === "tutor", `${tag}: professional field saved to user metadata (${JSON.stringify(db.userUpdates.at(-1)?.data)})`);
      check(db.profilePatches.at(-1)?.school === "New Horizons School", `${tag}: school saved to profiles.school`);
      check(/Tutor \/ private educator/.test(await page.textContent("dl")), `${tag}: view updates after saving`);
      await shot("2-saved");
    });
  }
} finally {
  await browser.close(); server.kill(); fs.rmSync(dist, { recursive: true, force: true });
}
console.log(`\n${checks - bad.length}/${checks} checks passed. Screenshots: ${out}`);
if (bad.length) { console.log("FAILURES:\n - " + bad.join("\n - ")); process.exitCode = 1; }
